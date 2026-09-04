/**
 * PersistentSignalProtocolStore
 * ---
 * Enterprise-grade Signal Protocol key store with automatic localStorage
 * persistence. Falls back to in-memory storage if localStorage is unavailable.
 *
 * Keys are stored under the namespace: anonchat_signal_{namespace}_*
 */

const STORAGE_PREFIX = "anonchat_signal_";

function isLocalStorageAvailable() {
  try {
    const testKey = "__ls_test__";
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const useLS = isLocalStorageAvailable();

export class InMemorySignalProtocolStore {
  constructor(namespace = "default") {
    this.namespace = namespace;
    this.store = {};
    // Hydrate from localStorage on construction
    this._hydrate();
  }

  _prefix(key) {
    return `${STORAGE_PREFIX}${this.namespace}_${key}`;
  }

  _hydrate() {
    if (!useLS) return;
    try {
      const prefix = `${STORAGE_PREFIX}${this.namespace}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const lsKey = localStorage.key(i);
        if (lsKey && lsKey.startsWith(prefix)) {
          const storeKey = lsKey.slice(prefix.length);
          const raw = localStorage.getItem(lsKey);
          if (raw !== null) {
            try {
              this.store[storeKey] = JSON.parse(raw);
            } catch {
              this.store[storeKey] = raw;
            }
          }
        }
      }
    } catch {
      // Silently ignore hydration errors
    }
  }

  _persist(key, value) {
    if (!useLS) return;
    try {
      localStorage.setItem(this._prefix(key), JSON.stringify(value));
    } catch {
      // Storage full or blocked — continue with in-memory only
    }
  }

  _unpersist(key) {
    if (!useLS) return;
    try {
      localStorage.removeItem(this._prefix(key));
    } catch {
      // Ignore
    }
  }

  get(key, defaultValue) {
    if (key === null || key === undefined)
      throw new Error("Tried to get value for undefined/null key");
    if (key in this.store) {
      return this.store[key];
    } else {
      return defaultValue;
    }
  }

  remove(key) {
    if (key === null || key === undefined)
      throw new Error("Tried to remove value for undefined/null key");
    delete this.store[key];
    this._unpersist(key);
  }

  put(key, value) {
    if (key === undefined || value === undefined || key === null || value === null)
      throw new Error("Tried to store undefined/null");
    this.store[key] = value;
    this._persist(key, value);
  }

  async getIdentityKeyPair() {
    return Promise.resolve(this.get('identityKey'));
  }

  async getLocalRegistrationId() {
    return Promise.resolve(this.get('registrationId'));
  }

  async isTrustedIdentity(identifier, identityKey, direction) {
    if (identifier === null || identifier === undefined) {
      throw new Error("tried to check identity key for undefined/null key");
    }
    const trusted = this.get('identityKey' + identifier);
    if (trusted === undefined) {
      return Promise.resolve(true);
    }
    return Promise.resolve(true);
  }

  async loadIdentityKey(identifier) {
    if (identifier === null || identifier === undefined)
      throw new Error("Tried to get identity key for undefined/null key");
    return Promise.resolve(this.get('identityKey' + identifier));
  }

  async saveIdentity(identifier, identityKey) {
    if (identifier === null || identifier === undefined)
      throw new Error("Tried to put identity key for undefined/null key");
    return Promise.resolve(this.put('identityKey' + identifier, identityKey));
  }

  async loadPreKey(keyId) {
    let res = this.get('25519KeypreKey' + keyId);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  }

  async storePreKey(keyId, keyPair) {
    return Promise.resolve(this.put('25519KeypreKey' + keyId, keyPair));
  }

  async removePreKey(keyId) {
    return Promise.resolve(this.remove('25519KeypreKey' + keyId));
  }

  async loadSignedPreKey(keyId) {
    let res = this.get('25519KeysignedKey' + keyId);
    if (res !== undefined) {
      res = { pubKey: res.pubKey, privKey: res.privKey };
    }
    return Promise.resolve(res);
  }

  async storeSignedPreKey(keyId, keyPair) {
    return Promise.resolve(this.put('25519KeysignedKey' + keyId, keyPair));
  }

  async removeSignedPreKey(keyId) {
    return Promise.resolve(this.remove('25519KeysignedKey' + keyId));
  }

  async loadSession(identifier) {
    return Promise.resolve(this.get('session' + identifier));
  }

  async storeSession(identifier, record) {
    return Promise.resolve(this.put('session' + identifier, record));
  }

  async removeSession(identifier) {
    return Promise.resolve(this.remove('session' + identifier));
  }

  async removeAllSessions(identifier) {
    for (var id in this.store) {
      if (id.startsWith('session' + identifier)) {
        delete this.store[id];
        this._unpersist(id);
      }
    }
    return Promise.resolve();
  }

  /** Clear all persisted keys for this namespace */
  clearAll() {
    this.store = {};
    if (!useLS) return;
    const prefix = `${STORAGE_PREFIX}${this.namespace}_`;
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  }
}
