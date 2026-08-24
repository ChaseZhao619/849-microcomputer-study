"use client";

export type AiVaultConfig = {
  provider: "qwen" | "openai" | "deepseek";
  model: string;
  apiKey: string;
};

type VaultEnvelope = {
  salt: number[];
  iv: number[];
  ciphertext: number[];
  provider: AiVaultConfig["provider"];
  model: string;
};

function openVaultDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("micro849-private", 3);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("secrets"))
        request.result.createObjectStore("secrets");
      if (!request.result.objectStoreNames.contains("ink-drafts"))
        request.result.createObjectStore("ink-drafts");
      if (!request.result.objectStoreNames.contains("answer-blobs"))
        request.result.createObjectStore("answer-blobs");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deriveKey(passphrase: string, salt: Uint8Array) {
  return crypto.subtle
    .importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, [
      "deriveKey",
    ])
    .then((material) =>
      crypto.subtle.deriveKey(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          salt: salt as BufferSource,
          iterations: 310_000,
        },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      ),
    );
}

export async function saveAiVault(config: AiVaultConfig, passphrase: string) {
  if (passphrase.length < 8) throw new Error("解锁口令至少需要8个字符");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(config)),
    ),
  );
  const envelope: VaultEnvelope = {
    salt: [...salt],
    iv: [...iv],
    ciphertext: [...ciphertext],
    provider: config.provider,
    model: config.model,
  };
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("secrets", "readwrite")
      .objectStore("secrets")
      .put(envelope, "ai-vault");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function unlockAiVault(
  passphrase: string,
): Promise<AiVaultConfig> {
  const db = await openVaultDb();
  const envelope = await new Promise<VaultEnvelope | undefined>(
    (resolve, reject) => {
      const request = db
        .transaction("secrets")
        .objectStore("secrets")
        .get("ai-vault");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  if (!envelope) throw new Error("这台设备还没有保存AI配置");
  try {
    const key = await deriveKey(passphrase, new Uint8Array(envelope.salt));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(envelope.iv) },
      key,
      new Uint8Array(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("解锁口令不正确");
  }
}

export async function readAiVaultHint() {
  const db = await openVaultDb();
  const envelope = await new Promise<VaultEnvelope | undefined>(
    (resolve, reject) => {
      const request = db
        .transaction("secrets")
        .objectStore("secrets")
        .get("ai-vault");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    },
  );
  db.close();
  return envelope
    ? { provider: envelope.provider, model: envelope.model }
    : null;
}

export async function clearAiVault() {
  const db = await openVaultDb();
  await new Promise<void>((resolve, reject) => {
    const request = db
      .transaction("secrets", "readwrite")
      .objectStore("secrets")
      .delete("ai-vault");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}
