// ─── Brand Colours ───────────────────────────────────────────────────────────
export const GOLD  = "#F7A81B";
export const NAVY  = "#17458F";
export const BLUE  = "#0067C8";
export const WHITE = "#FFFFFF";
export const GREEN = "#48BB78";

// ─── App Config ──────────────────────────────────────────────────────────────
export const APP_NAME    = "RotaryConnect";
export const APP_URL     = import.meta.env.VITE_APP_URL ?? window.location.origin;

// ─── Event Types ─────────────────────────────────────────────────────────────
export const EVENT_TYPES = ["Gala", "Conference", "Service", "Fellowship", "General"] as const;
export type EventType = typeof EVENT_TYPES[number];

// ─── Donation Categories ─────────────────────────────────────────────────────
export const DONATION_CATEGORIES = [
  { id: "community",    label: "Community Service Projects" },
  { id: "sponsorship",  label: "Event Sponsorship" },
  { id: "development",  label: "Club Development" },
  { id: "general",      label: "General Contribution" },
] as const;

// ─── Payment Methods ─────────────────────────────────────────────────────────
export const PAYMENT_METHODS = [
  { id: "mobile", label: "Mobile Money" },
  { id: "card",   label: "Credit Card" },
  { id: "bank",   label: "Bank Transfer" },
] as const;

// ─── Admin Roles ─────────────────────────────────────────────────────────────
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN:       "admin",
  STAFF:       "staff",
} as const;
