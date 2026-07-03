import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const parts = trimmed.split("=");
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join("=").trim().replace(/^['"]|['"]$/g, "");
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Error: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not defined in your .env file.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function clearDonations() {
  console.log("🔄 Starting cleanup of donations and withdrawals...");
  try {
    // 1. Clear Donations
    console.log("⏳ Clearing donations table...");
    const { error: donError } = await supabase
      .from("donations")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (donError) throw donError;
    console.log("✅ Donations table cleared!");

    // 2. Clear Withdrawals
    console.log("⏳ Clearing withdrawals table...");
    const { error: withError } = await supabase
      .from("withdrawals")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (withError) {
      console.log("⚠️ Note: Withdrawals table was not cleared (it may not exist yet or has no rows).");
    } else {
      console.log("✅ Withdrawals table cleared!");
    }

    console.log("🎉 Database cleanup complete!");
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message || err);
    process.exit(1);
  }
}

clearDonations();
