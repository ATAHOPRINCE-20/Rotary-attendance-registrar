import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import type { Event } from "../types/database";
import { sanitizeInput, sanitizeRequiredInput } from "../lib/constants";

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
      const deletedIds = JSON.parse(localStorage.getItem("deleted_events") || "[]");
      return (data as Event[]).filter(e => !deletedIds.includes(e.id));
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
      const deletedIds = JSON.parse(localStorage.getItem("deleted_events") || "[]");
      return (data as Event[]).filter(e => !deletedIds.includes(e.id));
    },
  });
}

// ─── Fetch single event ───────────────────────────────────────────────────────
export function useEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const deletedIds = JSON.parse(localStorage.getItem("deleted_events") || "[]");
      if (eventId && deletedIds.includes(eventId)) {
        throw new Error("Event not found (deleted locally)");
      }
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
      const sanitizedPayload = {
        ...payload,
        title: sanitizeRequiredInput(payload.title),
        description: payload.description ? sanitizeInput(payload.description) : null,
        location: payload.location ? sanitizeInput(payload.location) : null,
        cover_image_url: payload.cover_image_url ? sanitizeInput(payload.cover_image_url) : null,
        type: sanitizeRequiredInput(payload.type),
        status: sanitizeRequiredInput(payload.status) as "draft" | "published" | "closed",
      };

      const { data, error } = await supabase.from("events").insert(sanitizedPayload).select().single();
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
      const sanitizedUpdates: Partial<Event> = { ...updates };
      if (updates.title !== undefined) {
        sanitizedUpdates.title = sanitizeRequiredInput(updates.title);
      }
      if (updates.description !== undefined) {
        sanitizedUpdates.description = updates.description ? sanitizeInput(updates.description) : null;
      }
      if (updates.location !== undefined) {
        sanitizedUpdates.location = updates.location ? sanitizeInput(updates.location) : null;
      }
      if (updates.cover_image_url !== undefined) {
        sanitizedUpdates.cover_image_url = updates.cover_image_url ? sanitizeInput(updates.cover_image_url) : null;
      }
      if (updates.type !== undefined) {
        sanitizedUpdates.type = sanitizeRequiredInput(updates.type);
      }
      if (updates.status !== undefined) {
        sanitizedUpdates.status = sanitizeRequiredInput(updates.status) as "draft" | "published" | "closed";
      }

      const { data, error } = await supabase
        .from("events").update(sanitizedUpdates).eq("id", id).select().single();
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
      const deletedIds = JSON.parse(localStorage.getItem("deleted_events") || "[]");
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem("deleted_events", JSON.stringify(deletedIds));
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      qc.invalidateQueries({ queryKey: ["public-events"] });
    },
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
