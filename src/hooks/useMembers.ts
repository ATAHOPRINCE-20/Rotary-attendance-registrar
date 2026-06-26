import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Member } from "../types/database";
import { sanitizeInput, sanitizeRequiredInput } from "../lib/constants";

// Fetch all members of an organization, ordered alphabetically by full name
export function useOrgMembers(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["members", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data as Member[];
    },
  });
}

// Create a single member profile
export function useCreateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Member, "id" | "created_at" | "updated_at">) => {
      const sanitizedPayload = {
        ...payload,
        full_name: sanitizeRequiredInput(payload.full_name),
        email: payload.email ? sanitizeInput(payload.email) : null,
        phone: payload.phone ? sanitizeInput(payload.phone) : null,
        buddy_group: payload.buddy_group ? sanitizeInput(payload.buddy_group) : null,
      };

      const { data, error } = await supabase
        .from("members")
        .insert(sanitizedPayload)
        .select()
        .single();
      if (error) throw error;
      return data as Member;
    },
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: ["members", member.organization_id] });
    },
  });
}

// Update an existing member profile
export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<Member> & { id: string }) => {
      const sanitizedPayload: Partial<Member> = { ...payload };
      if (payload.full_name !== undefined) {
        sanitizedPayload.full_name = sanitizeRequiredInput(payload.full_name);
      }
      if (payload.email !== undefined) {
        sanitizedPayload.email = payload.email ? sanitizeInput(payload.email) : null;
      }
      if (payload.phone !== undefined) {
        sanitizedPayload.phone = payload.phone ? sanitizeInput(payload.phone) : null;
      }
      if (payload.buddy_group !== undefined) {
        sanitizedPayload.buddy_group = payload.buddy_group ? sanitizeInput(payload.buddy_group) : null;
      }

      const { data, error } = await supabase
        .from("members")
        .update(sanitizedPayload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Member;
    },
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: ["members", member.organization_id] });
    },
  });
}

// Delete a member profile
export function useDeleteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, organizationId }: { id: string; organizationId: string }) => {
      const { error } = await supabase
        .from("members")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { id, organizationId };
    },
    onSuccess: ({ organizationId }) => {
      qc.invalidateQueries({ queryKey: ["members", organizationId] });
    },
  });
}

// Bulk import a list of members via CSV upload
export function useBulkImportMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      organizationId,
      members,
    }: {
      organizationId: string;
      members: Omit<Member, "id" | "organization_id" | "created_at" | "updated_at">[];
    }) => {
      const payload = members.map((m) => ({
        ...m,
        full_name: sanitizeRequiredInput(m.full_name),
        email: m.email ? sanitizeInput(m.email) : null,
        phone: m.phone ? sanitizeInput(m.phone) : null,
        buddy_group: m.buddy_group ? sanitizeInput(m.buddy_group) : null,
        organization_id: organizationId,
      }));

      // Supabase standard bulk insert
      const { data, error } = await supabase
        .from("members")
        .insert(payload)
        .select();

      if (error) throw error;
      return { organizationId, data };
    },
    onSuccess: ({ organizationId }) => {
      qc.invalidateQueries({ queryKey: ["members", organizationId] });
    },
  });
}
