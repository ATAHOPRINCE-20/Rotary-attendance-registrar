/**
 * Utility to map database or authentication errors into short, informative, 
 * and user-friendly error messages.
 */
export function getFriendlyErrorMessage(err: any): string {
  if (!err) return "An unexpected error occurred.";

  let code = "";
  let message = "";
  let details = "";

  if (typeof err === "string") {
    message = err;
  } else if (typeof err === "object") {
    code = err.code || "";
    message = err.message || "";
    details = err.details || "";
  }

  const msgLower = message.toLowerCase();
  const detailsLower = details.toLowerCase();

  // 1. Postgres Unique Constraint Violations (Postgres code 23505)
  if (code === "23505" || msgLower.includes("unique constraint") || msgLower.includes("duplicate key")) {
    if (
      msgLower.includes("organizations_slug_key") ||
      msgLower.includes("organizations_name_key") ||
      detailsLower.includes("slug") ||
      detailsLower.includes("name")
    ) {
      return "This club is already registered.";
    }
    if (msgLower.includes("members_email_key") || detailsLower.includes("email")) {
      return "A member with this email is already registered.";
    }
    if (msgLower.includes("registrations_qr_ref_key")) {
      return "Registration conflict. Please try again.";
    }
    return "This record already exists.";
  }

  // 2. Database Row-Level Security (RLS) Violations (Postgres code 42501)
  if (code === "42501" || msgLower.includes("row-level security") || msgLower.includes("violates row-level security")) {
    return "Access denied. You do not have permission.";
  }

  // 3. Supabase Auth Errors
  if (msgLower.includes("invalid login credentials") || msgLower.includes("invalid credentials")) {
    return "Incorrect email or password.";
  }
  if (msgLower.includes("user already registered") || msgLower.includes("already registered")) {
    return "An account with this email already exists.";
  }
  if (msgLower.includes("email not confirmed") || msgLower.includes("confirm your email")) {
    return "Please verify your email to log in.";
  }
  if (msgLower.includes("email link is invalid") || msgLower.includes("link has expired") || msgLower.includes("token has expired")) {
    return "The verification link is invalid or expired.";
  }
  if (msgLower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (msgLower.includes("invalid email") || msgLower.includes("must be a valid email")) {
    return "Please enter a valid email address.";
  }

  // 4. Network and Connection Failures
  if (msgLower.includes("failed to fetch") || msgLower.includes("network") || msgLower.includes("timeout")) {
    return "Network error. Please check your connection.";
  }

  // Fallback to the original error message if it's brief, otherwise return a default
  if (message && message.length < 100) {
    return message;
  }

  return "An unexpected error occurred.";
}
