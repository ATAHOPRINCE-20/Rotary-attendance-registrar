import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Withdrawal } from "../types/database";
import { sanitizeRequiredInput, sanitizeInput } from "../lib/constants";

export interface BankProduct {
  name: string;
  code: string;
  category: string;
  has_price_list: boolean;
  has_choice_list: boolean;
  billable: boolean;
}

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

export function useBankProducts() {
  return useQuery({
    queryKey: ["relworx-bank-products"],
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/validate-bank-transfer", {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load bank products");
      }
      const data = await response.json();
      return (data.products || []) as BankProduct[];
    },
  });
}

export interface ValidateBankTransferPayload {
  organizationId: string;
  accountNo: string;
  amount: number;
  productCode: string;
  accountName: string;
  contactPhone: string;
}

export interface BankTransferValidationResult {
  success: boolean;
  validation_reference: string;
  charge: string;
  customer_name: string;
  gross_amount?: number;
  net_amount?: number;
  balance: string;
}

export function useValidateBankTransfer() {
  return useMutation({
    mutationFn: async (payload: ValidateBankTransferPayload): Promise<BankTransferValidationResult> => {
      const sanitizedPayload = {
        organizationId: payload.organizationId,
        accountNo: sanitizeRequiredInput(payload.accountNo),
        amount: payload.amount,
        productCode: sanitizeRequiredInput(payload.productCode),
        accountName: sanitizeRequiredInput(payload.accountName),
        contactPhone: sanitizeRequiredInput(payload.contactPhone),
      };

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/validate-bank-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(sanitizedPayload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to validate bank account details.");
      }

      return result as BankTransferValidationResult;
    },
  });
}

export interface RequestWithdrawalPayload {
  organizationId: string;
  amount: number;
  phone?: string;
  recipientName?: string;
  payoutMethod?: "mobile_money" | "bank_transfer";
  bankCode?: string;
  bankName?: string;
  accountNumber?: string;
  validationReference?: string;
  chargeAmount?: number;
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RequestWithdrawalPayload) => {
      const sanitizedPayload = {
        organizationId: payload.organizationId,
        amount: payload.amount,
        phone: payload.phone ? sanitizeInput(payload.phone) : "",
        recipientName: payload.recipientName ? sanitizeInput(payload.recipientName) : "",
        payoutMethod: payload.payoutMethod || "mobile_money",
        bankCode: payload.bankCode ? sanitizeInput(payload.bankCode) : undefined,
        bankName: payload.bankName ? sanitizeInput(payload.bankName) : undefined,
        accountNumber: payload.accountNumber ? sanitizeInput(payload.accountNumber) : undefined,
        validationReference: payload.validationReference ? sanitizeInput(payload.validationReference) : undefined,
        chargeAmount: payload.chargeAmount,
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
    onSuccess: (_data, variables) => {
      // Invalidate queries to trigger live UI updates
      qc.invalidateQueries({ queryKey: ["org-withdrawals", variables.organizationId] });
      qc.invalidateQueries({ queryKey: ["org-donations", variables.organizationId] });
    },
  });
}
