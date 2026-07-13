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
    mutationFn: async (payload: Omit<Registration, "id" | "qr_ref" | "created_at" | "status" | "checked_in_at"> & { status?: "checked-in" | "apology" }) => {
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

      // ── Strict email duplicate guard ────────────────────────────────────────
      // Only skip the check for synthetic fallback emails (member-{uuid}@...) used
      // when a club member has no email on file. Real emails are always checked.
      const isRealEmail = !sanitizedPayload.email.match(/^member-[a-f0-9\-]+@/);
      if (isRealEmail) {
        const { data: emailDupeCheck, error: emailCheckErr } = await supabase
          .from("registrations")
          .select("id")
          .eq("event_id", payload.event_id)
          .ilike("email", sanitizedPayload.email)
          .limit(1);

        if (emailCheckErr) throw emailCheckErr;

        if (emailDupeCheck && emailDupeCheck.length > 0) {
          throw new Error(
            "This email address is already registered for this event. Each person may only register once."
          );
        }
      }

      // ── member_id duplicate guard (for club members) ─────────────────────────
      if (sanitizedPayload.member_id) {
        const { data: memberDupeCheck, error: memberCheckErr } = await supabase
          .from("registrations")
          .select("id")
          .eq("event_id", payload.event_id)
          .eq("member_id", sanitizedPayload.member_id)
          .limit(1);

        if (memberCheckErr) throw memberCheckErr;

        if (memberDupeCheck && memberDupeCheck.length > 0) {
          throw new Error("This member is already registered for this event.");
        }
      }


      const { data: reg, error } = await supabase
        .from("registrations")
        .insert({
          ...sanitizedPayload,
          status: payload.status || "checked-in",
          checked_in_at: (payload.status || "checked-in") === "checked-in" ? new Date().toISOString() : null
        })
        .select()
        .single();
      if (error) throw error;

      // Trigger automatic welcome WhatsApp message
      try {
        const [eventRes, orgRes] = await Promise.all([
          supabase.from("events").select("title").eq("id", reg.event_id).single(),
          supabase.from("organizations").select("name, whatsapp_welcome_template").eq("id", reg.organization_id).single()
        ]);

        const eventTitle = eventRes.data?.title || "Event";
        const orgName = orgRes.data?.name || "Rotary Club";
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

        // 2. HTTP POST dispatch (always proxied via backend to bypass CORS/mixed-content blocks)
        if (reg.phone) {
          const GATEWAY_BASE_URL = "http://ugpay.tech:3000";
          const webhookUrl = `${GATEWAY_BASE_URL}/send-whatsapp/${reg.organization_id}`;
          
          fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              webhookUrl: webhookUrl,
              phone: reg.phone,
              message: welcomeMessage
            })
          }).catch((err) => {
            console.error("Failed to proxy whatsapp welcome message:", err);
          });
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

// ─── Update registration (public, edit) ────────────────────────────────────
export function useUpdateRegistration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { qr_ref: string } & Partial<Omit<Registration, "id" | "created_at" | "status" | "checked_in_at" | "qr_ref">>) => {
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

      const sanitizedPayload: any = {
        ...payload,
      };

      if (payload.full_name !== undefined) sanitizedPayload.full_name = sanitizeRequiredInput(payload.full_name);
      if (payload.email !== undefined) sanitizedPayload.email = sanitizeRequiredInput(payload.email);
      if (payload.phone !== undefined) sanitizedPayload.phone = payload.phone ? sanitizeInput(payload.phone) : null;
      if (payload.club_name !== undefined) sanitizedPayload.club_name = payload.club_name ? sanitizeInput(payload.club_name) : null;
      if (payload.district !== undefined) sanitizedPayload.district = payload.district ? sanitizeInput(payload.district) : null;
      if (payload.buddy_group !== undefined) sanitizedPayload.buddy_group = payload.buddy_group ? sanitizeInput(payload.buddy_group) : null;
      if (payload.occupation !== undefined) sanitizedPayload.occupation = payload.occupation ? sanitizeInput(payload.occupation) : null;
      if (payload.organization_name !== undefined) sanitizedPayload.organization_name = payload.organization_name ? sanitizeInput(payload.organization_name) : null;
      if (payload.comments !== undefined) sanitizedPayload.comments = payload.comments ? sanitizeInput(payload.comments) : null;
      if (payload.visits !== undefined) sanitizedPayload.visits = sanitizedVisits;
      if (payload.makeups !== undefined) sanitizedPayload.makeups = sanitizedMakeups;
      
      delete sanitizedPayload.qr_ref;

      // ── Strict email duplicate guard ────────────────────────────────────────
      if (sanitizedPayload.email) {
        const isRealEmail = !sanitizedPayload.email.match(/^member-[a-f0-9\-]+@/);
        if (isRealEmail) {
          const { data: emailDupeCheck, error: emailCheckErr } = await supabase
            .from("registrations")
            .select("qr_ref")
            .eq("event_id", payload.event_id)
            .ilike("email", sanitizedPayload.email)
            .neq("qr_ref", payload.qr_ref)
            .limit(1);

          if (emailCheckErr) throw emailCheckErr;

          if (emailDupeCheck && emailDupeCheck.length > 0) {
            throw new Error(
              "This email address is already registered for this event. Each person may only register once."
            );
          }
        }
      }

      // ── member_id duplicate guard (for club members) ─────────────────────────
      if (sanitizedPayload.member_id) {
        const { data: memberDupeCheck, error: memberCheckErr } = await supabase
          .from("registrations")
          .select("qr_ref")
          .eq("event_id", payload.event_id)
          .eq("member_id", sanitizedPayload.member_id)
          .neq("qr_ref", payload.qr_ref)
          .limit(1);

        if (memberCheckErr) throw memberCheckErr;

        if (memberDupeCheck && memberDupeCheck.length > 0) {
          throw new Error("This member is already registered for this event.");
        }
      }

      const { data: reg, error } = await supabase
        .from("registrations")
        .update(sanitizedPayload)
        .eq("qr_ref", payload.qr_ref)
        .select()
        .single();
      
      if (error) throw error;

      return reg as Registration;
    },
    onSuccess: (reg) => {
      qc.invalidateQueries({ queryKey: ["registrations", reg.event_id] });
      qc.invalidateQueries({ queryKey: ["reg-count", reg.event_id] });
      qc.invalidateQueries({ queryKey: ["registration-qr", reg.qr_ref] });
    },
  });
}

// ─── Check in or update attendee status (admin) ──────────────────────────────
export function useCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, eventId, status = "checked-in" }: { id: string; eventId: string; status?: "checked-in" | "apology" | "pending" }) => {
      const updates: any = { status };
      if (status === "checked-in") {
        updates.checked_in_at = new Date().toISOString();
      } else {
        updates.checked_in_at = null;
      }

      const { data, error } = await supabase
        .from("registrations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return { data: data as Registration, eventId };
    },
    onSuccess: ({ eventId }) => {
      qc.invalidateQueries({ queryKey: ["registrations", eventId] });
      qc.invalidateQueries({ queryKey: ["org-registrations"] });
    },
  });
}
