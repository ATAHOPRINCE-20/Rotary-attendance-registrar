import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile, Organization } from "../types/database";
import { sanitizeRequiredInput } from "../lib/constants";

interface AuthContextValue {
  session:        Session | null;
  user:           User | null;
  profile:        Profile | null;
  organization:   Organization | null;
  loading:        boolean;
  profileLoading: boolean;
  profileError:   boolean;
  signIn:         (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: (orgId?: string | null, role?: string | null) => Promise<{ error: string | null }>;
  signUp:         (email: string, password: string, fullName: string, orgId?: string | null, role?: string | null) => Promise<{ error: string | null; session: Session | null }>;
  resendVerificationEmail: (email: string) => Promise<void>;
  sendMemberInvite: (email: string) => Promise<{ error: string | null }>;
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
  impersonatedOrgId: string | null;
  impersonateOrganization: (orgId: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]               = useState<Session | null>(null);
  const [user, setUser]                     = useState<User | null>(null);
  const [profile, setProfile]               = useState<Profile | null>(null);
  const [organization, setOrg]              = useState<Organization | null>(null);
  const [loading, setLoading]               = useState(true);
  // Separate flag: true while loadProfile() is in-flight for a logged-in user
  const [profileLoading, setProfileLoading] = useState(false);
  // True only when a network/server error prevented the profile from loading
  const [profileError, setProfileError]     = useState(false);

  const [impersonatedOrgId, setImpersonatedOrgId] = useState<string | null>(
    typeof window !== "undefined" ? sessionStorage.getItem("impersonated_org_id") : null
  );

  const loadingUserRef = useRef<string | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  function impersonateOrganization(orgId: string | null) {
    if (orgId) {
      sessionStorage.setItem("impersonated_org_id", orgId);
    } else {
      sessionStorage.removeItem("impersonated_org_id");
    }
    setImpersonatedOrgId(orgId);
  }

  async function loadProfile(userId: string, force = false): Promise<void> {
    if (!force && loadingUserRef.current === userId && loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    loadingUserRef.current = userId;
    setProfileError(false);
    setProfileLoading(true);

    const promise = (async () => {
      try {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (profErr) {
          console.warn("[AuthContext] loadProfile error:", profErr.code, profErr.message);
        }

        if (!prof) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();

          // 1. Check if user is a registered Club Member in the members table
          if (currentUser?.email) {
            const { data: memberRecord } = await supabase
              .from("members")
              .select("*")
              .or(`user_id.eq.${userId},email.ilike.${currentUser.email}`)
              .maybeSingle();

            if (memberRecord) {
              // Auto-link user_id to members table for seamless RLS & future logins
              if (!memberRecord.user_id) {
                await supabase
                  .from("members")
                  .update({ user_id: userId })
                  .eq("id", memberRecord.id);
              }

              const memberProfile: Profile = {
                id: userId,
                organization_id: memberRecord.organization_id,
                full_name: memberRecord.full_name,
                role: "member",
                avatar_url: null,
                created_at: memberRecord.created_at,
              };

              setProfileError(false);
              setProfile(memberProfile);

              const { data: org } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", memberRecord.organization_id)
                .maybeSingle();

              if (org) {
                const orgData = { ...org };
                if (!orgData.logo_url) orgData.logo_url = "/assets/rotary_gold_logo.png";
                setOrg(orgData);
              } else {
                setOrg(null);
              }
              return;
            }
          }

          // 2. Check for pending organization invite
          const inviteOrgId = currentUser?.user_metadata?.organization_id || localStorage.getItem("pending_org_id");
          const inviteRole = currentUser?.user_metadata?.role || localStorage.getItem("pending_role") || "staff";
          
          const isMember = currentUser?.user_metadata?.is_member === true;
          if (inviteOrgId && !isMember) {
            localStorage.removeItem("pending_org_id");
            localStorage.removeItem("pending_role");
            const { data: newProf, error: insertErr } = await supabase
              .from("profiles")
              .insert({
                id: userId,
                organization_id: inviteOrgId,
                full_name: currentUser?.user_metadata?.full_name || "New Staff",
                role: inviteRole,
              })
              .select()
              .maybeSingle();
            
            if (!insertErr && newProf) {
              setProfileError(false);
              setProfile(newProf);
              const { data: org } = await supabase
                .from("organizations")
                .select("*")
                .eq("id", inviteOrgId)
                .maybeSingle();
              if (org) {
                const orgData = { ...org };
                if (!orgData.logo_url) orgData.logo_url = "/assets/rotary_gold_logo.png";
                setOrg(orgData);
              } else {
                setOrg(null);
              }
              return;
            } else {
              console.error("[AuthContext] Auto-insert profile error:", insertErr);
            }
          }
          setProfile(null);
          setOrg(null);
          setProfileError(false);
          return;
        }

        if (prof) {
          setProfileError(false);
          setProfile(prof);
          const activeOrgId = impersonatedOrgId || prof.organization_id;
          if (activeOrgId) {
            const { data: org } = await supabase
              .from("organizations")
              .select("*")
              .eq("id", activeOrgId)
              .maybeSingle();
            if (org) {
              const orgData = { ...org };
              if (!orgData.logo_url) orgData.logo_url = "/assets/rotary_gold_logo.png";
              setOrg(orgData);
            } else {
              setOrg(null);
            }
          }
        }
      } catch (e) {
        console.error("[AuthContext] loadProfile exception:", e);
      } finally {
        if (loadingUserRef.current === userId) {
          setProfileLoading(false);
          setLoading(false);
        }
      }
    })();

    loadPromiseRef.current = promise;
    return promise;
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, true);
  }

  useEffect(() => {
    // Safety net: never stay in loading state longer than 8 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => {
          clearTimeout(safetyTimer);
        });
      } else {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setOrg(null);
          setProfileLoading(false);
          setLoading(false);
          setImpersonatedOrgId(null);
          sessionStorage.removeItem("impersonated_org_id");
          loadingUserRef.current = null;
          loadPromiseRef.current = null;
        }
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function syncImpersonation() {
      const activeOrgId = impersonatedOrgId || profile?.organization_id;
      if (activeOrgId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", activeOrgId)
          .maybeSingle();
        if (org) {
          const orgData = { ...org };
          if (!orgData.logo_url) orgData.logo_url = "/assets/rotary_gold_logo.png";
          setOrg(orgData);
        } else {
          setOrg(null);
        }
      } else {
        setOrg(null);
      }
    }
    if (profile) {
      syncImpersonation();
    }
  }, [impersonatedOrgId, profile]);

  async function signIn(email: string, password: string) {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await loadProfile(data.session.user.id);
    }
    setLoading(false);
    return { error: null };
  }

  async function signInWithGoogle(orgId?: string | null, role?: string | null) {
    setLoading(true);
    if (orgId) {
      localStorage.setItem("pending_org_id", orgId);
      localStorage.setItem("pending_role", role || "staff");
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/admin/dashboard`,
      }
    });

    if (error) {
      setLoading(false);
      return { error: error.message };
    }
    return { error: null };
  }

  async function signUp(email: string, password: string, fullName: string, orgId?: string | null, role?: string | null) {
    setLoading(true);
    const sanitizedName = sanitizeRequiredInput(fullName);
    const metadata: any = { full_name: sanitizedName };
    if (orgId) {
      metadata.organization_id = orgId;
      metadata.role = role || "staff";
    }
    let data: any = null;
    let error: any = null;

    try {
      const res = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: metadata,
          emailRedirectTo: `${window.location.origin}/admin`
        },
      });
      data = res.data;
      error = res.error;
    } catch (e: any) {
      console.error("[AuthContext] signUp exception:", e);
      error = e;
    }

    if (error && (error.status === 422 || error.message?.toLowerCase().includes("redirect"))) {
      try {
        console.warn("[AuthContext] Redirect URL not whitelisted, retrying default signup...");
        const retry = await supabase.auth.signUp({
          email,
          password,
          options: { data: metadata },
        });
        data = retry.data;
        error = retry.error;
      } catch (retryErr: any) {
        error = retryErr;
      }
    }

    if (error) {
      setLoading(false);
      const userMessage = error.status === 500 || error.message?.includes("500") || String(error).includes("500")
        ? "Supabase Email Server Error (500). Please disable Custom SMTP in Supabase Dashboard -> Authentication -> Providers -> Email to test signup."
        : error.message || "Signup failed.";
      return { error: userMessage, session: null };
    }
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await loadProfile(data.session.user.id);
    }
    setLoading(false);
    return { error: null, session: data.session };
  }

  async function resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/admin`
      }
    });
    if (error) throw error;
  }

  async function sendMemberInvite(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return { error: "Email address is required." };
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/member/setup-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setOrg(null);
    setLoading(false);
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, organization, loading, profileLoading, profileError,
      signIn, signInWithGoogle, signUp, resendVerificationEmail, sendMemberInvite, signOut, refreshProfile,
      impersonatedOrgId, impersonateOrganization,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
