import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Campaign } from "../types/database";

export function useCampaigns(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, events(title)")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as (Campaign & { events: { title: string } | null })[];
    },
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Campaign, "id" | "created_at" | "sent_count" | "opened_count">) => {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...payload, sent_count: 0, opened_count: 0 })
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useUpdateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from("campaigns")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}
