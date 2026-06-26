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
  signUp:         (email: string, password: string, fullName: string) => Promise<{ error: string | null; session: Session | null }>;
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
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

  const loadingUserRef = useRef<string | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

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
          .single();

        if (profErr) {
          console.warn("[AuthContext] loadProfile error:", profErr.code, profErr.message);
          // PGRST116 = row not found → genuinely new user, no profile yet
          if (profErr.code === "PGRST116") {
            setProfile(null);
            setOrg(null);
          } else {
            // Network/RLS/timeout error — do NOT clear profile. Flag error so
            // ProtectedRoute shows a retry prompt instead of going to /org-setup.
            setProfileError(true);
          }
          return;
        }

        if (prof) {
          setProfileError(false);
          setProfile(prof);
          if (prof.organization_id) {
            const { data: org } = await supabase
              .from("organizations")
              .select("*")
              .eq("id", prof.organization_id)
              .single();
            if (org) {
              const orgData = { ...org };
              if (!orgData.logo_url) orgData.logo_url = "/logo.jpg";
              setOrg(orgData);
            } else {
              setOrg(null);
            }
          }
        } else {
          setProfile(null);
          setOrg(null);
        }
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

  async function signUp(email: string, password: string, fullName: string) {
    setLoading(true);
    const sanitizedName = sanitizeRequiredInput(fullName);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: sanitizedName } },
    });
    if (error) {
      setLoading(false);
      return { error: error.message, session: null };
    }
    if (data.session?.user) {
      setSession(data.session);
      setUser(data.session.user);
      await loadProfile(data.session.user.id);
    }
    setLoading(false);
    return { error: null, session: data.session };
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
