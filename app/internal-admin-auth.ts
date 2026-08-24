import { getD1 } from "../db";
import { requireRuntimeSecret } from "./runtime-env";

const encoder = new TextEncoder();
const MAX_CLOCK_SKEW_SECONDS = 300;

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1)
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

export type VerifiedAdminRequest = {
  actorEmail: string;
  bodyText: string;
};

export async function verifyInternalAdminRequest(
  request: Request,
): Promise<VerifiedAdminRequest> {
  const timestamp = request.headers.get("x-849-admin-timestamp") ?? "";
  const nonce = request.headers.get("x-849-admin-nonce") ?? "";
  const signature = request.headers.get("x-849-admin-signature") ?? "";
  const actorEmail = (
    request.headers.get("x-849-admin-actor") ?? ""
  ).toLowerCase();
  const timestampNumber = Number(timestamp);
  if (
    !Number.isInteger(timestampNumber) ||
    Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) >
      MAX_CLOCK_SKEW_SECONDS ||
    !/^[a-f0-9-]{16,80}$/i.test(nonce) ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    throw new Error("UNAUTHORIZED_ADMIN_REQUEST");

  const allowedEmail = requireRuntimeSecret("ADMIN_EMAIL").toLowerCase();
  if (actorEmail !== allowedEmail)
    throw new Error("UNAUTHORIZED_ADMIN_REQUEST");

  const bodyText = ["GET", "HEAD"].includes(request.method)
    ? ""
    : await request.clone().text();
  const url = new URL(request.url);
  const canonical = [
    request.method.toUpperCase(),
    `${url.pathname}${url.search}`,
    timestamp,
    nonce,
    actorEmail,
    await sha256(bodyText),
  ].join("\n");
  const expected = await hmac(
    requireRuntimeSecret("ADMIN_BRIDGE_SECRET"),
    canonical,
  );
  if (!constantTimeEqual(expected, signature.toLowerCase()))
    throw new Error("UNAUTHORIZED_ADMIN_REQUEST");

  const d1 = getD1();
  const now = new Date().toISOString();
  await d1
    .prepare("DELETE FROM admin_request_nonces WHERE expires_at < ?")
    .bind(now)
    .run();
  const inserted = await d1
    .prepare(
      "INSERT OR IGNORE INTO admin_request_nonces (nonce, actor_email, created_at, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(
      nonce,
      actorEmail,
      now,
      new Date((timestampNumber + 600) * 1000).toISOString(),
    )
    .run();
  if (Number(inserted.meta.changes ?? 0) !== 1)
    throw new Error("REPLAYED_ADMIN_REQUEST");
  return { actorEmail, bodyText };
}

export function adminNoStore(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("x-content-type-options", "nosniff");
  return Response.json(data, { ...init, headers });
}

export function adminError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  const status =
    code === "REPLAYED_ADMIN_REQUEST"
      ? 409
      : code === "UNAUTHORIZED_ADMIN_REQUEST"
        ? 401
        : 500;
  return adminNoStore(
    {
      error:
        status === 409
          ? "管理请求已处理，请刷新后重试"
          : status === 401
            ? "管理请求未获授权"
            : "管理数据读取失败",
      code:
        status === 409
          ? "ADMIN_REQUEST_REPLAYED"
          : status === 401
            ? "ADMIN_UNAUTHORIZED"
            : "ADMIN_INTERNAL_ERROR",
    },
    { status },
  );
}
