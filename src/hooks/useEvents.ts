import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Event } from "../types/database";

// ─── Fetch events for the admin's org ────────────────────────────────────────
export function useAdminEvents(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["admin-events", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organization_id", organizationId!)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });
}

// ─── Fetch published events for a specific org (attendee view) ────────────────
export function usePublicEvents(organizationId: string | undefined) {
  return useQuery({
    queryKey: ["public-events", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organization_id", organizationId!)
        .eq("status", "published")
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });
}

// ─── Fetch single event ───────────────────────────────────────────────────────
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data as Event;
    },
  });
}

// ─── Create event ─────────────────────────────────────────────────────────────
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Event, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase.from("events").insert(payload).select().single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-events"] }),
  });
}

// ─── Update event ─────────────────────────────────────────────────────────────
export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data, error } = await supabase
        .from("events").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: (ev) => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      qc.invalidateQueries({ queryKey: ["event", ev.id] });
    },
  });
}

// ─── Delete event ─────────────────────────────────────────────────────────────
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-events"] }),
  });
}

// ─── Registration count per event ────────────────────────────────────────────
export function useEventRegistrationCount(eventId: string | undefined) {
  return useQuery({
    queryKey: ["reg-count", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
