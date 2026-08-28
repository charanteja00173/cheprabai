import { workerDeriveKey, workerEncrypt, workerDecrypt } from "./cryptoWorker";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export async function generateRandomSenderKey() {
  return await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable
    ["encrypt", "decrypt"]
  );
}

export async function exportKey(key) {
  const exported = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importKey(base64Str) {
  const binaryString = atob(base64Str);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  );
}

export async function generateKeyFromSecret(secret, roomId) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const saltValue = roomId ? `secure-room-${roomId}` : "secure-room";

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(saltValue),
      iterations: 100000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(key, message) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(message)
  );

  return {
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(encrypted))
  };
}

export async function decryptMessage(key, payload) {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    new Uint8Array(payload.data)
  );

  return decoder.decode(decrypted);
}


export async function encryptBinary(key, buffer) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    buffer
  );

  return {
    iv: iv.buffer,
    data: encrypted
  };
}

export async function decryptBinary(key, payload) {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(payload.iv) },
    key,
    payload.data
  );
}

export async function workerGenerateKeyFromSecret(secret, roomId) {
  const keyBase64 = await workerDeriveKey(secret, roomId);
  return await importKey(keyBase64);
}

export async function workerEncryptMessage(key, message) {
  const keyBase64 = await exportKey(key);
  return await workerEncrypt(keyBase64, message);
}

export async function workerDecryptMessage(key, payload) {
  const keyBase64 = await exportKey(key);
  return await workerDecrypt(keyBase64, payload.iv, payload.data);
}

