import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Donation } from "../types/database";
import { sanitizeInput, sanitizeRequiredInput } from "../lib/constants";

export function useOrgDonations(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["org-donations", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*, events(title)")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Donation & { events: { title: string } | null })[];
    },
  });
}

export function useEventDonations(eventId: string | undefined) {
  return useQuery({
    queryKey: ["donations", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Donation[];
    },
  });
}

export function useSubmitDonation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<Donation, "id" | "receipt_number" | "created_at">
    ) => {
      const sanitizedPayload = {
        ...payload,
        full_name: payload.full_name ? sanitizeRequiredInput(payload.full_name) : "Anonymous",
        email: payload.email ? sanitizeInput(payload.email) : null,
        currency: sanitizeRequiredInput(payload.currency),
        category: payload.category ? sanitizeInput(payload.category) : null,
        payment_method: payload.payment_method ? sanitizeInput(payload.payment_method) : null,
      };

      const { data, error } = await supabase
        .from("donations")
        .insert(sanitizedPayload)
        .select()
        .single();
      if (error) throw error;
      return data as Donation;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["org-donations"] });
      if (d.event_id) qc.invalidateQueries({ queryKey: ["donations", d.event_id] });
    },
  });
}
