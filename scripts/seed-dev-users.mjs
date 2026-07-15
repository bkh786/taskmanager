// One-off dev seed: creates one account per role so auth/RBAC can be tested
// end to end. Safe to re-run (skips rows that already exist) and safe to
// delete later -- this is throwaway dev fixture data, not production seed.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import WebSocket from "ws";

// @supabase/supabase-js always constructs a RealtimeClient, which needs a
// global WebSocket ctor. Node 20 doesn't have one built in (Node 22+ does);
// this script never uses realtime, so a polyfill is enough to unblock init.
globalThis.WebSocket ??= WebSocket;

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] ??= m[2];
}

const DEV_PASSWORD = "DevPass123!";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function ensureAuthUser(email) {
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEV_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  // Org + master_admin
  let { data: org } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", "acme")
    .maybeSingle();
  if (!org) {
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: "Acme Corporation", slug: "acme" })
      .select()
      .single();
    if (error) throw error;
    org = data;
  }
  console.log("org:", org.id);

  const adminId = await ensureAuthUser("admin@acme.com");
  const managerId = await ensureAuthUser("sana.malik@acme.com");
  const userId = await ensureAuthUser("ava.chen@acme.com");
  const ownerId = await ensureAuthUser("owner@platform.com");

  const rows = [
    {
      id: adminId,
      org_id: org.id,
      system_role: "master_admin",
      full_name: "Priya Nair",
      email: "admin@acme.com",
    },
    {
      id: managerId,
      org_id: org.id,
      system_role: "reporting_manager",
      full_name: "Sana Malik",
      email: "sana.malik@acme.com",
    },
    {
      id: userId,
      org_id: org.id,
      system_role: "user",
      full_name: "Ava Chen",
      email: "ava.chen@acme.com",
      reports_to: managerId,
    },
    {
      id: ownerId,
      org_id: null,
      system_role: "platform_owner",
      full_name: "Root Owner",
      email: "owner@platform.com",
    },
  ];

  const { error } = await admin.from("app_users").upsert(rows, { onConflict: "id" });
  if (error) throw error;

  console.log("Seeded accounts (password for all:", DEV_PASSWORD, ")");
  for (const r of rows) console.log(" -", r.email, "/", r.system_role);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
