import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const DEFAULT_SUPABASE_URL = "https://phczqgytpbisjngwttnb.supabase.co";
const DEFAULT_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoY3pxZ3l0cGJpc2puZ3d0dG5iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTYyNjI1MiwiZXhwIjoyMDk3MjAyMjUyfQ.pbldO9-Z-JYzO4O5yatXFerltXwxnm3vXnAwBc0GL9Y";

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY;
  return createClient(url, key);
}

function verifyRelworxSignature(
  webhookKey: string,
  timestamp: string,
  url: string,
  params: Record<string, any>,
  receivedSignature: string
): boolean {
  if (!receivedSignature || !webhookKey) return true; // Accept if unconfigured during dev

  try {
    let signedData = url + timestamp;
    const sortedKeys = Object.keys(params).sort();

    for (const k of sortedKeys) {
      signedData += String(k) + String(params[k]);
    }

    const calculatedSig = crypto
      .createHmac("sha256", webhookKey)
      .update(signedData)
      .digest("hex");

    return calculatedSig === receivedSignature;
  } catch (err) {
    console.error("[Relworx Sig Verification Error]:", err);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow GET and POST
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const supabase = getSupabase();
  const host = req.headers.host ? `https://${req.headers.host}` : "https://www.agoroll.com";

  // Parse parameters from POST or GET query
  const body = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body) : req.body) : {};
  const query = req.query || {};

  const status = String(body.status || query.status || "success").toLowerCase();
  const internalReference = String(body.internal_reference || body.customer_reference || query.reference || query.internal_reference || "");
  const signature = String(req.headers["x-relworx-signature"] || body.relworx_signature || query.relworx_signature || "");
  const timestamp = String(req.headers["x-relworx-timestamp"] || body.relworx_timestamp || query.relworx_timestamp || "");

  const webhookKey = process.env.RELWORX_WEBHOOK_KEY || process.env.RELWORX_API_KEY || "";

  // Signature validation (if key is set)
  if (webhookKey && signature) {
    const requestUrl = `${host}/api/relworx-auto-return`;
    const checkParams = {
      status: body.status || query.status || "success",
      customer_reference: body.customer_reference || "",
      internal_reference: body.internal_reference || internalReference,
    };
    const isValid = verifyRelworxSignature(webhookKey, timestamp, requestUrl, checkParams, signature);
    if (!isValid) {
      console.warn("[Relworx Auto-Return Warning]: Signature verification mismatched");
    }
  }

  // Update Database status if reference exists
  if (internalReference) {
    try {
      const finalStatus = (status === "success" || status === "completed") ? "completed" : "failed";
      
      const { data: donation } = await supabase
        .from("donations")
        .select("*")
        .eq("receipt_number", internalReference)
        .maybeSingle();

      if (donation) {
        await supabase
          .from("donations")
          .update({ status: finalStatus })
          .eq("id", donation.id);

        // Update member dues balances if member dues
        if (finalStatus === "completed" && donation.member_id && donation.dues_category_id) {
          const { data: dueRec } = await supabase
            .from("member_dues_balances")
            .select("*")
            .eq("member_id", donation.member_id)
            .eq("dues_category_id", donation.dues_category_id)
            .maybeSingle();

          if (dueRec) {
            const newPaid = Number(dueRec.amount_paid) + Number(donation.amount);
            const dueAmount = Number(dueRec.amount_due);
            const newStatus = newPaid >= dueAmount ? "paid" : "partially_paid";

            await supabase
              .from("member_dues_balances")
              .update({
                amount_paid: newPaid,
                status: newStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", dueRec.id);
          }
        }
      }
    } catch (dbErr) {
      console.error("[Relworx Auto Return DB Update Error]:", dbErr);
    }
  }

  // Determine redirection URL
  const targetUrl = `${host}/payment-result?reference=${encodeURIComponent(internalReference)}&status=${encodeURIComponent(status)}`;

  // If request comes from POST (Relworx auto return browser form submit), respond with HTTP 303 Redirect to frontend
  if (req.method === "POST") {
    res.setHeader("Location", targetUrl);
    return res.status(303).end();
  }

  return res.redirect(303, targetUrl);
}
