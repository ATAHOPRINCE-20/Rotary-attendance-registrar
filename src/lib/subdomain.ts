/**
 * Extracts the tenant subdomain from the current hostname.
 * Examples:
 * - ntinda.agoroll.com -> "ntinda"
 * - www.agoroll.com -> null
 * - agoroll.com -> null
 * - ntinda.localhost -> "ntinda"
 * - localhost -> null
 */
export function getSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;
  const parts = hostname.split(".");

  // Skip IP addresses
  if (/^[0-9.]+$/.test(hostname)) return null;

  // Localhost (e.g. ntinda.localhost:5173)
  if (hostname.includes("localhost")) {
    if (parts.length > 1 && parts[0] !== "localhost" && parts[0] !== "www") {
      return parts[0];
    }
    return null;
  }

  // Vercel deployment domain (e.g. ntinda.rotary-ntinda.vercel.app)
  const isVercelSubdomain = hostname.endsWith("vercel.app");
  const minPartsRequired = isVercelSubdomain ? 4 : 3;

  if (parts.length >= minPartsRequired) {
    const subdomain = parts[0];
    // Exclude common platform subdomains
    if (!["www", "admin", "api", "portal"].includes(subdomain.toLowerCase())) {
      return subdomain;
    }
  }

  return null;
}

/**
 * Generates the base path for navigation links within the tenant flow.
 * If on a subdomain, it returns "" (links are relative to root /).
 * If on the main domain, it returns "/org/:slug".
 */
export function getTenantBase(slug?: string): string {
  const subdomain = getSubdomain();
  if (subdomain) {
    return "";
  }
  return slug ? `/org/${slug}` : "";
}

/**
 * Resolves a full, absolute URL to a tenant's route, adapting to subdomain structure.
 * Examples:
 * - getTenantUrl("ntinda", "/register") -> "https://ntinda.agoroll.com/register" (if on agoroll.com)
 * - getTenantUrl("ntinda", "/register") -> "http://ntinda.localhost:5173/register" (if on localhost:5173)
 * - getTenantUrl("ntinda", "/register") -> "https://rotary-ntinda.vercel.app/org/ntinda/register" (fallback)
 */
export function getTenantUrl(slug: string, path: string = ""): string {
  if (typeof window === "undefined") return "";

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : "";

  // Ensure path starts with a leading slash for subdomains
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  const subPath = cleanPath.substring(1);

  // If localhost
  if (hostname.includes("localhost")) {
    const subdomain = getSubdomain();
    if (subdomain) {
      return `${protocol}//${slug}.localhost${port}${cleanPath}`;
    } else {
      return `${protocol}//${hostname}${port}/org/${slug}/${subPath}`;
    }
  }

  // If custom domain agoroll.com
  if (hostname.endsWith("agoroll.com")) {
    const subdomain = getSubdomain();
    if (subdomain) {
      return `https://${slug}.agoroll.com${cleanPath}`;
    } else {
      return `https://${hostname}${port}/org/${slug}/${subPath}`;
    }
  }

  // If Vercel deployment has wildcard subdomain active
  if (hostname.endsWith("vercel.app")) {
    const parts = hostname.split(".");
    if (parts.length >= 4) {
      const parentDomain = parts.slice(1).join(".");
      return `https://${slug}.${parentDomain}${cleanPath}`;
    }
  }

  // Fallback to subpath URL
  return `${protocol}//${hostname}${port}/org/${slug}/${subPath}`;
}
