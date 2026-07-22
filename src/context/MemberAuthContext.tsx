import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Member, Organization } from "../types/database";

interface MemberAuthContextValue {
  session:      Session | null;
  user:         User | null;
  member:       Member | null;
  organization: Organization | null;
  loading:      boolean;
  signOut:      () => Promise<void>;
  refreshMember: () => Promise<void>;
}

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [member, setMember]             = useState<Member | null>(null);
  const [organization, setOrg]          = useState<Organization | null>(null);
  const [loading, setLoading]           = useState(true);

  const loadingUserRef = useRef<string | null>(null);

  async function loadMember(userId: string, force = false): Promise<void> {
    if (!force && loadingUserRef.current === userId) {
      return;
    }

    loadingUserRef.current = userId;
    setLoading(true);

    try {
      // 1. Fetch the member record associated with this user ID
      let { data: memData, error: memErr } = await supabase
        .from("members")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (memErr) {
        console.error("[MemberAuthContext] loadMember error:", memErr.message);
      }

      // Fallback: If not found by user_id, check by user email
      if (!memData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: emailMem } = await supabase
            .from("members")
            .select("*")
            .ilike("email", user.email)
            .maybeSingle();

          if (emailMem) {
            memData = emailMem;
            // Auto-link user_id for RLS and future loads
            await supabase
              .from("members")
              .update({ user_id: userId })
              .eq("id", emailMem.id);
          }
        }
      }

      if (memData) {
        setMember(memData);

        // 2. Fetch their organization details
        const { data: orgData, error: orgErr } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", memData.organization_id)
          .maybeSingle();

        if (!orgErr && orgData) {
          const org = { ...orgData };
          if (!org.logo_url) org.logo_url = "/assets/rotary_gold_logo.png";
          setOrg(org);
        } else {
          setOrg(null);
        }
      } else {
        setMember(null);
        setOrg(null);
      }
    } catch (err) {
      console.error("[MemberAuthContext] Exception loading member profile:", err);
    } finally {
      if (loadingUserRef.current === userId) {
        setLoading(false);
      }
    }
  }

  async function refreshMember() {
    if (user) await loadMember(user.id, true);
  }

  useEffect(() => {
    // Safety timer to prevent staying loading forever
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadMember(session.user.id).finally(() => {
          clearTimeout(safetyTimer);
        });
      } else {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    // Listen to changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadMember(session.user.id);
        } else {
          setMember(null);
          setOrg(null);
          setLoading(false);
          loadingUserRef.current = null;
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setMember(null);
    setOrg(null);
    setLoading(false);
  }

  return (
    <MemberAuthContext.Provider value={{
      session,
      user,
      member,
      organization,
      loading,
      signOut,
      refreshMember
    }}>
      {children}
    </MemberAuthContext.Provider>
  );
}

export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used inside <MemberAuthProvider>");
  return ctx;
}
