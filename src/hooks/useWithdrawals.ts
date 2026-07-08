import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Withdrawal } from "../types/database";
import { sanitizeRequiredInput, sanitizeInput } from "../lib/constants";

export function useOrgWithdrawals(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["org-withdrawals", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Withdrawal[];
    },
  });
}

interface RequestWithdrawalPayload {
  organizationId: string;
  amount: number;
  phone: string;
  recipientName: string;
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RequestWithdrawalPayload) => {
      const sanitizedPayload = {
        organizationId: payload.organizationId,
        amount: payload.amount,
        phone: sanitizeRequiredInput(payload.phone),
        recipientName: payload.recipientName ? sanitizeInput(payload.recipientName) : "",
      };

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sanitizedPayload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to process withdrawal.");
      }

      return result;
    },
    onSuccess: (data, variables) => {
      // Invalidate queries to trigger live UI updates
      qc.invalidateQueries({ queryKey: ["org-withdrawals", variables.organizationId] });
      qc.invalidateQueries({ queryKey: ["org-donations", variables.organizationId] });
    },
  });
}
