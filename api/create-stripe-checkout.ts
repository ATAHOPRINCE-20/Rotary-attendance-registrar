import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { rateLimitMiddleware } from "./_rate-limit";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://phczqgytpbisjngwttnb.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const isRateLimited = await rateLimitMiddleware(req, res, 15, 60);
  if (isRateLimited) return;

  try {
    const {
      organizationId,
      memberId,
      duesCategoryId,
      eventId,
      fullName,
      email,
      amount,
      currency = "USD",
      category = "Contribution",
      paymentType = "donation",
      successUrl,
      cancelUrl,
    } = req.body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required." });
    }

    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required." });
    }

    // 1. Fetch organization custom Stripe key if configured
    let stripeKey = process.env.STRIPE_SECRET_KEY;
    
    const { data: orgPayments } = await supabase
      .from("organization_payments")
      .select("api_key")
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (orgPayments?.api_key && orgPayments.api_key.startsWith("sk_")) {
      stripeKey = orgPayments.api_key;
    }

    if (!stripeKey) {
      return res.status(500).json({
        error: "Stripe API Key is not configured. Please add your STRIPE_SECRET_KEY to .env or organization payment settings."
      });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-02-24.acacia" as any,
    });

    const host = req.headers.host ? `https://${req.headers.host}` : "http://localhost:5173";
    const defaultSuccessUrl = `${host}/member/dashboard?payment=success&type=${paymentType}`;
    const defaultCancelUrl = `${host}/member/dashboard?payment=cancelled`;

    // Stripe amounts are in smallest currency unit (cents/subunits)
    const unitAmount = Math.round(Number(amount) * 100);

    // 2. Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: (currency || "USD").toLowerCase(),
            product_data: {
              name: category,
              description: `Payment for ${fullName || "Club Member"} (${category})`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: email || undefined,
      metadata: {
        organizationId: organizationId || "",
        memberId: memberId || "",
        duesCategoryId: duesCategoryId || "",
        eventId: eventId || "",
        fullName: fullName || "",
        email: email || "",
        amount: String(amount),
        currency: currency || "USD",
        category: category || "",
        paymentType: paymentType || "donation",
      },
      success_url: successUrl || defaultSuccessUrl,
      cancel_url: cancelUrl || defaultCancelUrl,
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (err: any) {
    console.error("[Stripe Checkout Error]:", err);
    return res.status(500).json({
      error: err.message || "Failed to create Stripe Checkout session."
    });
  }
}
