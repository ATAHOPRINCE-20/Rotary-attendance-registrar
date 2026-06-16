import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Donation } from "../types/database";

export function useOrgDonations() {
  return useQuery({
    queryKey: ["org-donations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donations")
        .select("*, events(title)")
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
      const { data, error } = await supabase
        .from("donations")
        .insert(payload)
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
