import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanMaster, type PlanRow } from "@/components/platform/plan-master";

export default async function PlanMasterPage() {
  await requireRole(["platform_owner"]);
  const admin = createAdminClient();
  const [{ data: plans }, { data: orgs }] = await Promise.all([
    admin.from("plans").select("*").order("price"),
    admin.from("organizations").select("plan_id"),
  ]);
  const counts = new Map<string, number>();
  for (const o of orgs ?? []) if (o.plan_id) counts.set(o.plan_id, (counts.get(o.plan_id) ?? 0) + 1);
  const rows: PlanRow[] = (plans ?? []).map((p) => ({ ...p, tenantCount: counts.get(p.id) ?? 0 }));
  return <PlanMaster plans={rows} />;
}
