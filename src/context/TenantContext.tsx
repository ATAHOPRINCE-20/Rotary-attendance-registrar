import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "react-router";
import { supabase } from "../lib/supabase";
import type { Organization } from "../types/database";

interface TenantContextValue {
  organization: Organization | null;
  loading:      boolean;
  notFound:     boolean;
}

const TenantContext = createContext<TenantContextValue>({
  organization: null,
  loading: true,
  notFound: false,
});

/**
 * TenantProvider resolves the current organization from the :slug URL param.
 * Used in all public (attendee-facing) routes under /org/:slug.
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [organization, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);

    supabase
      .from("organizations")
      .select("*")
      .eq("slug", slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          const orgData = { ...data };
          if (!orgData.logo_url) {
            orgData.logo_url = "/logo.jpg";
          }
          setOrg(orgData);
        }
        setLoading(false);
      });
  }, [slug]);

  return (
    <TenantContext.Provider value={{ organization, loading, notFound }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
