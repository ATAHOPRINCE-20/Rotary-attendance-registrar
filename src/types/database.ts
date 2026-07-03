// ─── Database Types ───────────────────────────────────────────────────────────
// Matches the Supabase schema exactly

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at">;
        Update: Partial<Omit<Organization, "id" | "created_at">>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Event, "id" | "created_at">>;
      };
      registrations: {
        Row: Registration;
        Insert: Omit<Registration, "id" | "qr_ref" | "created_at">;
        Update: Partial<Omit<Registration, "id" | "created_at">>;
      };
      members: {
        Row: Member;
        Insert: Omit<Member, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Member, "id" | "created_at">>;
      };
      donations: {
        Row: Donation;
        Insert: Omit<Donation, "id" | "receipt_number" | "created_at">;
        Update: Partial<Omit<Donation, "id" | "created_at">>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Campaign, "id" | "created_at">;
        Update: Partial<Omit<Campaign, "id" | "created_at">>;
      };
      organization_payments: {
        Row: OrganizationPayments;
        Insert: Omit<OrganizationPayments, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<OrganizationPayments, "id" | "created_at">>;
      };
    };
    Functions: {
      my_org_id: { Args: Record<string, never>; Returns: string };
    };
  };
}

// ─── App-Level Types ──────────────────────────────────────────────────────────

export interface Organization {
  id:         string;
  name:       string;
  slug:       string;
  logo_url:   string | null;
  district:   string | null;
  country:    string | null;
  website:    string | null;
  created_at: string;
  buddy_groups?: string | null;
  whatsapp_webhook_url?: string | null;
  whatsapp_welcome_template?: string | null;
}

export interface Profile {
  id:              string;       // = auth.users.id
  organization_id: string;
  full_name:       string | null;
  role:            "super_admin" | "admin" | "staff";
  avatar_url:      string | null;
  created_at:      string;
}

export interface Event {
  id:              string;
  organization_id: string;
  title:           string;
  description:     string | null;
  date:            string;       // ISO timestamp
  end_date:        string | null;
  location:        string | null;
  capacity:        number | null;
  type:            string;
  cover_image_url: string | null;
  status:          "draft" | "published" | "closed";
  created_by:      string | null;
  created_at:      string;
  updated_at:      string;
  buddy_groups?:   string | null;
  buddy_group_of_the_day?: string | null;
  is_archived?:    boolean | null;
}

export interface Registration {
  id:                string;
  event_id:          string;
  organization_id:   string;
  full_name:         string;
  email:             string;
  phone:             string | null;
  is_member:         boolean;
  club_name:         string | null;
  district:          string | null;
  buddy_group:       string | null;
  occupation:        string | null;
  organization_name: string | null;
  comments:          string | null;
  status:            "pending" | "checked-in";
  qr_ref:            string;
  checked_in_at:     string | null;
  created_at:        string;
  member_id?:        string | null;
  visits?:           ClubActivity[] | null;
  makeups?:          ClubActivity[] | null;
}

export interface ClubActivity {
  club_name: string;
  date: string;
}

export interface Donation {
  id:              string;
  event_id:        string | null;
  organization_id: string;
  registration_id: string | null;
  full_name:       string | null;
  email:           string | null;
  amount:          number;
  currency:        string;
  category:        string | null;
  payment_method:  string | null;
  status:          "pending" | "completed" | "failed";
  receipt_number:  string;
  created_at:      string;
  phone_number?:   string | null;
}

export interface OrganizationPayments {
  id:              string;
  organization_id: string;
  api_key:         string | null;
  account_no:      string | null;
  is_sandbox:      boolean;
  created_at:      string;
  updated_at:      string;
}

export interface Campaign {
  id:              string;
  organization_id: string;
  event_id:        string | null;
  name:            string;
  channel:         "email" | "sms" | "whatsapp";
  audience:        string | null;
  message:         string | null;
  status:          "draft" | "scheduled" | "sent";
  sent_count:      number;
  opened_count:    number;
  scheduled_at:    string | null;
  sent_at:         string | null;
  created_by:      string | null;
  created_at:      string;
}

export interface Member {
  id:              string;
  organization_id: string;
  full_name:       string;
  email:           string | null;
  phone:           string | null;
  buddy_group:     string | null;
  created_at:      string;
  updated_at:      string;
}

// ─── Auth State ───────────────────────────────────────────────────────────────

export interface AuthUser {
  id:    string;
  email: string;
}

export interface AdminSession {
  user:         AuthUser;
  profile:      Profile;
  organization: Organization;
}
