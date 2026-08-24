type SiteRuntimeEnv = {
  DB?: D1Database;
  ANSWER_ASSETS?: R2Bucket;
  ADMIN_BRIDGE_SECRET?: string;
  ADMIN_EMAIL?: string;
};

export function getRuntimeEnv(): SiteRuntimeEnv {
  return (
    globalThis as typeof globalThis & { __SITE_ENV__?: SiteRuntimeEnv }
  ).__SITE_ENV__ ?? {};
}

export function requireRuntimeSecret(
  key: "ADMIN_BRIDGE_SECRET" | "ADMIN_EMAIL",
) {
  const value = getRuntimeEnv()[key];
  if (!value) throw new Error(`Missing required runtime setting: ${key}`);
  return value;
}
