import { Organization } from "../types/database";

export interface LicenseStatus {
  tier: "free" | "standard" | "premium" | "trial";
  isExpired: boolean;
  daysRemaining: number;
  features: {
    buddyGroups: boolean;
    donations: boolean;
    whatsappComms: boolean;
    pdfExport: boolean;
    analytics: boolean;
  };
  limits: {
    maxMembers: number;
    maxEvents: number;
  };
}

export function getLicenseStatus(org: Organization | null): LicenseStatus {
  if (!org) {
    return {
      tier: "free",
      isExpired: false,
      daysRemaining: 0,
      features: { buddyGroups: false, donations: false, whatsappComms: false, pdfExport: false, analytics: false },
      limits: { maxMembers: 50, maxEvents: 2 }
    };
  }

  const tier = org.subscription_tier || "free";
  
  // Expiry check
  const expiresAt = org.subscription_expires_at;
  const isExpired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

  let daysRemaining = 0;
  if (expiresAt && (tier === "trial" || tier === "standard" || tier === "premium")) {
    daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // Trial, Standard and Premium get all features
  const hasFullAccess = !isExpired && (tier === "standard" || tier === "premium" || tier === "trial");

  return {
    tier: tier as "free" | "standard" | "premium" | "trial",
    isExpired,
    daysRemaining,
    features: {
      buddyGroups: hasFullAccess,
      donations: hasFullAccess,
      whatsappComms: hasFullAccess,
      pdfExport: hasFullAccess,
      analytics: hasFullAccess,
    },
    limits: {
      maxMembers: hasFullAccess ? Infinity : 50,
      maxEvents: hasFullAccess ? Infinity : 2,
    }
  };
}
