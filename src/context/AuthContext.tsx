import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile, Organization } from "../types/database";

interface AuthContextValue {
  session:      Session | null;
  user:         User | null;
  profile:      Profile | null;
  organization: Organization | null;
  loading:      boolean;
  signIn:       (email: string, password: string) => Promise<{ error: string | null }>;
  signUp:       (email: string, password: string, fullName: string) => Promise<{ error: string | null; session: Session | null }>;
  signOut:      () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession]       = useState<Session | null>(null);
  const [user, setUser]             = useState<User | null>(null);
  const [profile, setProfile]       = useState<Profile | null>(null);
  const [organization, setOrg]      = useState<Organization | null>(null);
  const [loading, setLoading]       = useState(true);

  async function loadProfile(userId: string) {
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profErr) {
      // 406 = RLS blocked; PGRST116 = no row found — both are expected on first-ever signup
      console.warn("[AuthContext] loadProfile error:", profErr.code, profErr.message);
    }

    if (prof) {
      setProfile(prof);
      if (prof.organization_id) {
        const { data: org, error: orgErr } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", prof.organization_id)
          .single();
        if (org) {
          const orgData = { ...org };
          if (!orgData.logo_url) {
            orgData.logo_url = "/logo.jpg";
          }
          setOrg(orgData);
        } else {
          setOrg(null);
        }
      }
    } else {
      setProfile(null);
      setOrg(null);
    }
  }


  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false));
      } else {
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
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { error: error.message, session: null };
    return { error: null, session: data.session };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setOrg(null);
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, organization, loading,
      signIn, signUp, signOut, refreshProfile,
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
