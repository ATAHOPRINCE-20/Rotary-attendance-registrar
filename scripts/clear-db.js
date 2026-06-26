import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Manual environment loader to avoid extra dependencies
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
// Service role key is required to bypass RLS policies and delete records
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error("❌ Error: VITE_SUPABASE_URL is not defined in your .env file.");
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.log("⚠️  Warning: SUPABASE_SERVICE_ROLE_KEY is not defined in your .env file.");
  console.log("To run this script locally, add SUPABASE_SERVICE_ROLE_KEY=your_key to your .env file.");
  console.log("Or copy and run these statements in your Supabase Dashboard SQL Editor:\n");
  console.log("TRUNCATE TABLE donations CASCADE;");
  console.log("TRUNCATE TABLE registrations CASCADE;");
  console.log("TRUNCATE TABLE campaigns CASCADE;");
  console.log("TRUNCATE TABLE events CASCADE;\n");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
  },
});

async function clearDatabase() {
  console.log("🔄 Starting database cleanup...");

  try {
    // 1. Delete Donations
    console.log("⏳ Clearing donations table...");
    const { error: donError } = await supabase.from("donations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (donError) throw donError;

    // 2. Delete Registrations
    console.log("⏳ Clearing registrations table...");
    const { error: regError } = await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (regError) throw regError;

    // 3. Delete Campaigns
    console.log("⏳ Clearing campaigns table...");
    const { error: campError } = await supabase.from("campaigns").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (campError) throw campError;

    // 4. Delete Events
    console.log("⏳ Clearing events table...");
    const { error: evError } = await supabase.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (evError) throw evError;

    console.log("✅ Database cleared successfully! Keep your user accounts and organization configuration.");
  } catch (err) {
    console.error("❌ Cleanup failed:", err.message || err);
    process.exit(1);
  }
}

clearDatabase();
