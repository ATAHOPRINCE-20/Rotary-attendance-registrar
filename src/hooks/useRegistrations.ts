import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Registration } from "../types/database";
import { sanitizeInput, sanitizeRequiredInput } from "../lib/constants";

// ─── All registrations for an event (admin) ───────────────────────────────────
export function useEventRegistrations(eventId: string | undefined) {
  return useQuery({
    queryKey: ["registrations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Registration[];
    },
  });
}

// ─── All registrations for an org (admin dashboard) ──────────────────────────
export function useOrgRegistrations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["org-registrations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, events(title, date)")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
}

// ─── Look up a registration by QR ref (attendee confirmation) ─────────────────
export function useRegistrationByQR(qrRef: string | undefined) {
  return useQuery({
    queryKey: ["registration-qr", qrRef],
    enabled: !!qrRef,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, events(title, date, location, cover_image_url)")
        .eq("qr_ref", qrRef!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ─── Submit registration (public, no auth) ────────────────────────────────────
export function useSubmitRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Registration, "id" | "qr_ref" | "created_at" | "status" | "checked_in_at">) => {
      const sanitizedVisits = payload.visits
        ? payload.visits
            .map(v => ({
              club_name: sanitizeRequiredInput(v.club_name),
              date: sanitizeRequiredInput(v.date),
            }))
            .filter(v => v.club_name !== "")
        : null;

      const sanitizedMakeups = payload.makeups
        ? payload.makeups
            .map(m => ({
              club_name: sanitizeRequiredInput(m.club_name),
              date: sanitizeRequiredInput(m.date),
            }))
            .filter(m => m.club_name !== "")
        : null;

      const sanitizedPayload = {
        ...payload,
        full_name: sanitizeRequiredInput(payload.full_name),
        email: sanitizeRequiredInput(payload.email),
        phone: payload.phone ? sanitizeInput(payload.phone) : null,
        club_name: payload.club_name ? sanitizeInput(payload.club_name) : null,
        district: payload.district ? sanitizeInput(payload.district) : null,
        buddy_group: payload.buddy_group ? sanitizeInput(payload.buddy_group) : null,
        occupation: payload.occupation ? sanitizeInput(payload.occupation) : null,
        organization_name: payload.organization_name ? sanitizeInput(payload.organization_name) : null,
        comments: payload.comments ? sanitizeInput(payload.comments) : null,
        visits: sanitizedVisits,
        makeups: sanitizedMakeups,
      };

      // Check for duplicate registration before inserting
      let checkQuery = supabase
        .from("registrations")
        .select("id, email, phone, member_id")
        .eq("event_id", payload.event_id);

      if (sanitizedPayload.member_id) {
        checkQuery = checkQuery.eq("member_id", sanitizedPayload.member_id);
      } else {
        checkQuery = checkQuery.ilike("full_name", sanitizedPayload.full_name);
      }

      const { data: existingRegs, error: checkErr } = await checkQuery;
      if (checkErr) throw checkErr;

      if (existingRegs && existingRegs.length > 0) {
        if (sanitizedPayload.member_id) {
          throw new Error("This member is already registered for this event.");
        }
        const isDuplicate = existingRegs.some(r => 
          (sanitizedPayload.email && r.email?.toLowerCase() === sanitizedPayload.email.toLowerCase()) ||
          (sanitizedPayload.phone && r.phone === sanitizedPayload.phone)
        );
        if (isDuplicate) {
          throw new Error("This person is already registered for this event.");
        }
      }

      const { data: reg, error } = await supabase
        .from("registrations")
        .insert({
          ...sanitizedPayload,
          status: "checked-in",
          checked_in_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;

      // Trigger automatic welcome WhatsApp message
      try {
        const [eventRes, orgRes] = await Promise.all([
          supabase.from("events").select("title").eq("id", reg.event_id).single(),
          supabase.from("organizations").select("name, whatsapp_webhook_url, whatsapp_welcome_template").eq("id", reg.organization_id).single()
        ]);

        const eventTitle = eventRes.data?.title || "Event";
        const orgName = orgRes.data?.name || "Rotary Club";
        const webhookUrl = orgRes.data?.whatsapp_webhook_url;
        const customTemplate = orgRes.data?.whatsapp_welcome_template;

        // Construct welcoming message content
        let welcomeMessage = "";
        if (customTemplate && customTemplate.trim()) {
          welcomeMessage = customTemplate
            .replace(/{full_name}/g, reg.full_name)
            .replace(/{event_title}/g, eventTitle)
            .replace(/{qr_ref}/g, reg.qr_ref)
            .replace(/{org_name}/g, orgName);
        } else {
          welcomeMessage = `Welcome to *${orgName}*!\n\nDear *${reg.full_name}*, thank you for registering for *${eventTitle}*.\n\nYour Registration Code is: *${reg.qr_ref}*.\n\nWe look forward to hosting you!`;
        }

        // 1. Insert campaign log row to Supabase so it shows up in Comms history
        await supabase.from("campaigns").insert({
          organization_id: reg.organization_id,
          event_id: reg.event_id,
          name: `Auto WhatsApp Welcome (${reg.full_name})`,
          channel: "whatsapp",
          audience: reg.full_name,
          message: welcomeMessage,
          status: "sent",
          sent_count: 1,
          sent_at: new Date().toISOString()
        });

        // 2. HTTP POST dispatch (direct on localhost, proxied in production to bypass CORS/mixed-content blocks)
        if (webhookUrl && webhookUrl.trim() && reg.phone) {
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

          if (isLocalhost) {
            // On localhost, we can fetch the HTTP VPS directly since browsers allow mixed content in development
            fetch(webhookUrl.trim(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                phone: reg.phone,
                message: welcomeMessage
              })
            }).catch((err) => {
              console.error("Failed to post directly to WhatsApp gateway on localhost:", err);
            });
          } else {
            // In production (HTTPS), route via secure Vercel API proxy to bypass browser mixed-content blocks
            fetch("/api/send-whatsapp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                webhookUrl: webhookUrl.trim(),
                phone: reg.phone,
                message: welcomeMessage
              })
            }).catch((err) => {
              console.error("Failed to proxy whatsapp welcome message in production:", err);
            });
          }
        }
      } catch (triggerErr) {
        console.error("Error in automated welcome WhatsApp flow:", triggerErr);
      }

      return reg as Registration;
    },
    onSuccess: (reg) => {
      qc.invalidateQueries({ queryKey: ["registrations", reg.event_id] });
      qc.invalidateQueries({ queryKey: ["reg-count", reg.event_id] });
    },
  });
}

// ─── Check in an attendee (admin) ─────────────────────────────────────────────
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { data, error } = await supabase
        .from("registrations")
        .update({ status: "checked-in", checked_in_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data: data as Registration, eventId };
    },
    onSuccess: ({ eventId }) => {
      qc.invalidateQueries({ queryKey: ["registrations", eventId] });
    },
  });
}
