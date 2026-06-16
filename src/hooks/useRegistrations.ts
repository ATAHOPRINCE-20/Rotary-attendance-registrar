import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Registration } from "../types/database";

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
export function useOrgRegistrations() {
  return useQuery({
    queryKey: ["org-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("registrations")
        .select("*, events(title, date)")
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
      const { data, error } = await supabase
        .from("registrations")
        .insert({ ...payload, status: "pending" })
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
