export class InMemorySignalProtocolStore {
    constructor() {
        this.store = {};
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
    }

    put(key, value) {
        if (key === undefined || value === undefined || key === null || value === null)
            throw new Error("Tried to store undefined/null");
        this.store[key] = value;
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
        // return Promise.resolve(trusted === identityKey || trusted.byteLength === identityKey.byteLength); // simplified
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
            }
        }
        return Promise.resolve();
    }
}
