import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminUserControls } from "../db/schema";

export async function accountAccess(userId: string) {
  const db = getDb();
  const [control] = await db
    .select({ status: adminUserControls.status })
    .from(adminUserControls)
    .where(eq(adminUserControls.userId, userId))
    .limit(1);
  return {
    db,
    suspended: control?.status === "suspended",
  };
}

export function suspendedAccountResponse() {
  return Response.json(
    {
      error: "该账户的云端能力已被管理员停用，本机练习仍可继续使用",
      code: "ACCOUNT_SUSPENDED",
    },
    {
      status: 403,
      headers: { "cache-control": "no-store" },
    },
  );
}
