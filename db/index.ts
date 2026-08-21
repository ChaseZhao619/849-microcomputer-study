import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

type SiteRuntime = typeof globalThis & { __SITE_ENV__?: { DB?: D1Database } };

function runtimeDb() {
  return (globalThis as SiteRuntime).__SITE_ENV__?.DB;
}

export function getDb() {
  const binding = runtimeDb();
  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(binding, { schema });
}

export function getD1() {
  const binding = runtimeDb();
  if (!binding) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return binding;
}
