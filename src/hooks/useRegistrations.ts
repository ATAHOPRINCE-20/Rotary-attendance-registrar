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

      const { data, error } = await supabase
        .from("registrations")
        .insert({
          ...sanitizedPayload,
          status: "checked-in",
          checked_in_at: new Date().toISOString()
        })
        .select()
        .single();
      if (error) throw error;
      return data as Registration;
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
