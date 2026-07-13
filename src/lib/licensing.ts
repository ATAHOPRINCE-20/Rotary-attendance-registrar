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

  // Let's define a 14-day trial for new clubs from their registration date (created_at)
  const createdDate = new Date(org.created_at).getTime();
  const trialDuration = 14 * 24 * 60 * 60 * 1000;
  const trialExpiryDate = createdDate + trialDuration;
  const isTrialActive = Date.now() < trialExpiryDate && tier === "free";

  let daysRemaining = 0;
  if (tier === "standard" || tier === "premium") {
    if (expiresAt) {
      daysRemaining = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    }
  } else if (isTrialActive) {
    daysRemaining = Math.max(0, Math.ceil((trialExpiryDate - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  // Trial, Standard and Premium get all features
  const hasFullAccess = !isExpired && (tier === "standard" || tier === "premium" || isTrialActive);

  return {
    tier: isTrialActive ? "trial" : (tier as any),
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
