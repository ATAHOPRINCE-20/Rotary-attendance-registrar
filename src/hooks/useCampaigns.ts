import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Campaign } from "../types/database";
import { sanitizeInput, sanitizeRequiredInput } from "../lib/constants";

export function useCampaigns(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["campaigns", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*, events(title)")
        .eq("organization_id", organizationId!)
        .not("name", "ilike", "%WhatsApp Welcome%")
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
      const sanitizedPayload = {
        ...payload,
        name: sanitizeRequiredInput(payload.name),
        message: payload.message ? sanitizeInput(payload.message) : null,
        audience: payload.audience ? sanitizeInput(payload.audience) : null,
      };

      const { data, error } = await supabase
        .from("campaigns")
        .insert({ ...sanitizedPayload, sent_count: 0, opened_count: 0 })
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
      const sanitizedUpdates: Partial<Campaign> = { ...updates };
      if (updates.name !== undefined) {
        sanitizedUpdates.name = sanitizeRequiredInput(updates.name);
      }
      if (updates.message !== undefined) {
        sanitizedUpdates.message = updates.message ? sanitizeInput(updates.message) : null;
      }
      if (updates.audience !== undefined) {
        sanitizedUpdates.audience = updates.audience ? sanitizeInput(updates.audience) : null;
      }

      const { data, error } = await supabase
        .from("campaigns")
        .update(sanitizedUpdates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Campaign;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("campaigns")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}
