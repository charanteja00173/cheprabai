const workerCode = `
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  self.onmessage = async (e) => {
    const { type, id, payload } = e.data;
    try {
      if (type === "deriveKey") {
        const { secret, roomId } = payload;
        const baseKey = await self.crypto.subtle.importKey(
          "raw",
          encoder.encode(secret),
          "PBKDF2",
          false,
          ["deriveKey"]
        );
        const saltValue = roomId ? "secure-room-" + roomId : "secure-room";
        const key = await self.crypto.subtle.deriveKey(
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
        const exported = await self.crypto.subtle.exportKey("raw", key);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
        self.postMessage({ id, success: true, result: base64 });
      } else if (type === "encrypt") {
        const { keyBase64, text } = payload;
        const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
        const key = await self.crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["encrypt"]);
        const iv = self.crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await self.crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text));
        self.postMessage({
          id,
          success: true,
          result: {
            iv: Array.from(iv),
            data: Array.from(new Uint8Array(encrypted))
          }
        });
      } else if (type === "decrypt") {
        const { keyBase64, iv, data } = payload;
        const rawKey = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
        const key = await self.crypto.subtle.importKey("raw", rawKey, "AES-GCM", true, ["decrypt"]);
        const decrypted = await self.crypto.subtle.decrypt(
          { name: "AES-GCM", iv: new Uint8Array(iv) },
          key,
          new Uint8Array(data)
        );
        self.postMessage({ id, success: true, result: decoder.decode(decrypted) });
      }
    } catch (err) {
      self.postMessage({ id, success: false, error: err.message || String(err) });
    }
  };
`;

let workerInstance = null;
const pendingPromises = new Map();
let messageIdSeq = 0;

function getWorker() {
  if (typeof window === "undefined") return null;
  if (!workerInstance) {
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    workerInstance = new Worker(url);
    workerInstance.onmessage = (e) => {
      const { id, success, result, error } = e.data;
      const promise = pendingPromises.get(id);
      if (promise) {
        pendingPromises.delete(id);
        if (success) {
          promise.resolve(result);
        } else {
          promise.reject(new Error(error));
        }
      }
    };
  }
  return workerInstance;
}

function runInWorker(type, payload) {
  const worker = getWorker();
  if (!worker) return Promise.reject(new Error("Worker not available"));
  const id = ++messageIdSeq;
  return new Promise((resolve, reject) => {
    pendingPromises.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
  });
}

export function workerDeriveKey(secret, roomId) {
  return runInWorker("deriveKey", { secret, roomId });
}

export function workerEncrypt(keyBase64, text) {
  return runInWorker("encrypt", { keyBase64, text });
}

export function workerDecrypt(keyBase64, iv, data) {
  return runInWorker("decrypt", { keyBase64, iv, data });
}
