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
import { getSubdomain } from "../lib/subdomain";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { slug: urlSlug } = useParams<{ slug?: string }>();
  const [organization, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const activeSlug = getSubdomain() || urlSlug;

  useEffect(() => {
    if (!activeSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);

    supabase
      .from("organizations")
      .select("*")
      .eq("slug", activeSlug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
        } else {
          const orgData = { ...data };
          if (!orgData.logo_url) {
            orgData.logo_url = "/assets/rotary_gold_logo.png";
          }
          setOrg(orgData);
        }
        setLoading(false);
      });
  }, [activeSlug]);

  return (
    <TenantContext.Provider value={{ organization, loading, notFound }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
