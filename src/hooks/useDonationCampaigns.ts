import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Database } from "../types/database";
import { sanitizeRequiredInput, sanitizeInput } from "../lib/constants";

export interface DonationCampaign {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  goal_amount: number;
  is_active: boolean;
  created_at: string;
}

export function useDonationCampaigns(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["donation-campaigns", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      // Fetch campaigns along with sum of completed donations for each campaign
      const { data: campaigns, error: campaignsError } = await supabase
        .from("donation_campaigns")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      const { data: donations, error: donationsError } = await supabase
        .from("donations")
        .select("amount, campaign_id, status")
        .eq("organization_id", organizationId!)
        .eq("status", "completed");

      if (donationsError) throw donationsError;

      return (campaigns as DonationCampaign[]).map(c => {
        const raised = donations
          ?.filter(d => d.campaign_id === c.id)
          .reduce((sum, d) => sum + Number(d.amount), 0) ?? 0;
        return {
          ...c,
          amount_raised: raised
        };
      });
    },
  });
}

export function useActiveDonationCampaigns(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["active-donation-campaigns", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donation_campaigns")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DonationCampaign[];
    },
  });
}

export function useCreateDonationCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<DonationCampaign, "id" | "created_at">
    ) => {
      const sanitizedPayload = {
        ...payload,
        title: sanitizeRequiredInput(payload.title),
        description: payload.description ? sanitizeInput(payload.description) : null,
        goal_amount: Number(payload.goal_amount) || 0,
      };

      const { data, error } = await supabase
        .from("donation_campaigns")
        .insert(sanitizedPayload)
        .select()
        .single();

      if (error) throw error;
      return data as DonationCampaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["donation-campaigns"] });
      qc.invalidateQueries({ queryKey: ["active-donation-campaigns"] });
    },
  });
}

export function useUpdateDonationCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Partial<DonationCampaign> & { id: string }
    ) => {
      const sanitizedPayload = {
        ...payload,
        title: payload.title ? sanitizeRequiredInput(payload.title) : undefined,
        description: payload.description !== undefined ? (payload.description ? sanitizeInput(payload.description) : null) : undefined,
        goal_amount: payload.goal_amount !== undefined ? Number(payload.goal_amount) || 0 : undefined,
      };

      const { data, error } = await supabase
        .from("donation_campaigns")
        .update(sanitizedPayload)
        .eq("id", payload.id)
        .select()
        .single();

      if (error) throw error;
      return data as DonationCampaign;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["donation-campaigns"] });
      qc.invalidateQueries({ queryKey: ["active-donation-campaigns"] });
    },
  });
}

export function useDeleteDonationCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("donation_campaigns")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["donation-campaigns"] });
      qc.invalidateQueries({ queryKey: ["active-donation-campaigns"] });
    },
  });
}
