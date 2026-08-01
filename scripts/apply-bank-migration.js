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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("Supabase URL:", supabaseUrl);
console.log("Service Role Key available:", !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

async function run() {
  try {
    const { data, error } = await supabase.from("withdrawals").select("id, account_number, payout_method").limit(1);
    if (error) {
      console.log("❌ Column check error:", error.message);
      console.log("\n⚠️ The Supabase 'withdrawals' table is missing the required bank transfer columns.");
      console.log("Please run the following SQL script in your Supabase SQL Editor:\n");
      const sqlScript = fs.readFileSync(path.resolve(__dirname, "../supabase/add_bank_transfers_to_withdrawals.sql"), "utf-8");
      console.log(sqlScript);
    } else {
      console.log("✅ Bank transfer columns exist on 'withdrawals' table!");
    }
  } catch (e) {
    console.error("Error:", e);
  }
}

run();
