import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Member, Organization } from "../types/database";

interface MemberAuthContextValue {
  session:              Session | null;
  user:                 User | null;
  member:               Member | null;
  organization:         Organization | null;
  loading:              boolean;
  impersonatedMemberId: string | null;
  impersonateMember:    (memberId: string | null) => void;
  signOut:              () => Promise<void>;
  refreshMember:        () => Promise<void>;
}

const MemberAuthContext = createContext<MemberAuthContextValue | null>(null);

export function MemberAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [user, setUser]                 = useState<User | null>(null);
  const [member, setMember]             = useState<Member | null>(null);
  const [organization, setOrg]          = useState<Organization | null>(null);
  const [loading, setLoading]           = useState(true);
  const [impersonatedMemberId, setImpersonatedMemberId] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("impersonated_member_id") : null
  );

  const loadingUserRef = useRef<string | null>(null);

  function impersonateMember(memberId: string | null) {
    if (typeof window !== "undefined") {
      if (memberId) {
        sessionStorage.setItem("impersonated_member_id", memberId);
      } else {
        sessionStorage.removeItem("impersonated_member_id");
      }
    }
    setImpersonatedMemberId(memberId);
  }

  async function loadMember(userId: string, force = false): Promise<void> {
    if (!force && loadingUserRef.current === userId) {
      return;
    }

    loadingUserRef.current = userId;
    setLoading(true);

    try {
      let memData: Member | null = null;

      // 1. Check if Admin Impersonation mode is active first
      const activeImpersonatedId = impersonatedMemberId || (typeof window !== "undefined" ? sessionStorage.getItem("impersonated_member_id") : null);

      if (activeImpersonatedId) {
        const { data: impMem } = await supabase
          .from("members")
          .select("*")
          .eq("id", activeImpersonatedId)
          .maybeSingle();

        if (impMem) {
          memData = impMem;
        }
      }

      // 2. If not impersonating or impersonation target not found, fetch by user ID
      if (!memData && userId && userId !== "impersonated") {
        const { data: userMem } = await supabase
          .from("members")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (userMem) memData = userMem;
      }

      // 3. Fallback: Check by user email or phone number
      if (!memData && userId && userId !== "impersonated") {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser?.email) {
          const { data: emailMem } = await supabase
            .from("members")
            .select("*")
            .ilike("email", currentUser.email.trim())
            .maybeSingle();

          if (emailMem) {
            memData = emailMem;
            await supabase
              .from("members")
              .update({ user_id: userId })
              .eq("id", emailMem.id);
          }
        }

        if (!memData && currentUser?.phone) {
          const digits = currentUser.phone.replace(/\D/g, "");
          if (digits.length >= 9) {
            const suffix = digits.substring(digits.length - 9);
            const { data: phoneMem } = await supabase
              .from("members")
              .select("*")
              .like("phone", `%${suffix}`)
              .maybeSingle();

            if (phoneMem) {
              memData = phoneMem;
              await supabase
                .from("members")
                .update({ user_id: userId })
                .eq("id", phoneMem.id);
            }
          }
        }
      }

      if (!memData && userId && userId !== "impersonated") {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser) {
          let fallbackOrgId = currentUser.user_metadata?.organization_id || "";
          if (!fallbackOrgId) {
            const { data: firstOrg } = await supabase
              .from("organizations")
              .select("id")
              .limit(1)
              .maybeSingle();
            if (firstOrg) fallbackOrgId = firstOrg.id;
          }

          memData = {
            id: currentUser.id,
            organization_id: fallbackOrgId,
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Club Member",
            email: currentUser.email || "",
            phone: currentUser.phone || "",
            user_id: currentUser.id,
            status: "active",
            buddy_group: null,
            updated_at: currentUser.created_at || new Date().toISOString(),
          } as unknown as Member;
        }
      }

      if (memData) {
        setMember(memData);

        // Fetch organization details
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
      setLoading(false);
    }
  }

  async function refreshMember() {
    if (user || impersonatedMemberId) await loadMember(user?.id || "impersonated", true);
  }

  useEffect(() => {
    // Safety timer to prevent staying loading forever
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 3000);

    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user || impersonatedMemberId) {
        loadMember(session?.user?.id || "impersonated", true).finally(() => {
          clearTimeout(safetyTimer);
          setLoading(false);
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
        if (session?.user || impersonatedMemberId) {
          await loadMember(session?.user?.id || "impersonated", true);
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
  }, [impersonatedMemberId]);

  async function signOut() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("impersonated_member_id");
      localStorage.removeItem("session_login_time");
      localStorage.removeItem("last_user_activity");
    }
    setImpersonatedMemberId(null);
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
      impersonatedMemberId,
      impersonateMember,
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
