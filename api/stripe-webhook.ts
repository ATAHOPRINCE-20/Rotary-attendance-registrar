import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://phczqgytpbisjngwttnb.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable: any) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    const rawBody = await buffer(req);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2025-02-24.acacia" as any,
    });

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // Fallback parse if signature checking is unconfigured during dev
      event = JSON.parse(rawBody.toString());
    }
  } catch (err: any) {
    console.error("[Stripe Webhook Verification Error]:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};

    const {
      organizationId,
      memberId,
      duesCategoryId,
      eventId,
      fullName,
      email,
      amount,
      currency,
      category,
      paymentType,
    } = metadata;

    const receiptNumber = `CARD-${Date.now().toString().slice(-8)}`;

    try {
      // 1. If this was a member dues payment, update member_dues_balances
      if (memberId && duesCategoryId) {
        const { data: currentDue } = await supabase
          .from("member_dues_balances")
          .select("*")
          .eq("member_id", memberId)
          .eq("dues_category_id", duesCategoryId)
          .maybeSingle();

        if (currentDue) {
          const numAmount = Number(amount || currentDue.amount_due);
          const newPaid = Number(currentDue.amount_paid) + numAmount;
          const dueAmount = Number(currentDue.amount_due);
          const newStatus = newPaid >= dueAmount ? "paid" : "partially_paid";

          await supabase
            .from("member_dues_balances")
            .update({
              amount_paid: newPaid,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentDue.id);
        }
      }

      // 2. Insert transaction record into donations table
      await supabase.from("donations").insert({
        organization_id: organizationId || null,
        event_id: eventId || null,
        full_name: fullName || session.customer_details?.name || "Card Payer",
        email: email || session.customer_details?.email || null,
        amount: Number(amount) || (session.amount_total ? session.amount_total / 100 : 0),
        currency: (currency || session.currency || "USD").toUpperCase(),
        category: category || "Stripe Card Payment",
        payment_method: "stripe_card",
        status: "completed",
        receipt_number: receiptNumber,
      });

      console.log(`[Stripe Webhook Fulfilling]: Card payment completed for ${fullName} (${category})`);
    } catch (dbErr) {
      console.error("[Stripe Fulfillment Database Error]:", dbErr);
    }
  }

  return res.status(200).json({ received: true });
}
