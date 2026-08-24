type SiteRuntime = typeof globalThis & {
  __SITE_ENV__?: { ANSWER_ASSETS?: R2Bucket };
};

export function getAnswerAssets() {
  const binding = (globalThis as SiteRuntime).__SITE_ENV__?.ANSWER_ASSETS;
  if (!binding)
    throw new Error("Cloudflare R2 binding `ANSWER_ASSETS` is unavailable.");
  return binding;
}
