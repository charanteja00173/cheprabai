import { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } from "@privacyresearch/libsignal-protocol-typescript";
import { InMemorySignalProtocolStore } from "./SignalStore";

class SignalService {
    constructor() {
        this.store = new InMemorySignalProtocolStore();
        this.registrationId = null;
        this.identityKeyPair = null;
        this.address = null;
    }

    async initialize(userId) {
        this.address = new SignalProtocolAddress(userId, 1);
        
        // Generate Identity
        this.registrationId = KeyHelper.generateRegistrationId();
        this.identityKeyPair = await KeyHelper.generateIdentityKeyPair();
        
        await this.store.put('registrationId', this.registrationId);
        await this.store.put('identityKey', this.identityKeyPair);
        
        // Generate PreKeys
        const preKey = await KeyHelper.generatePreKey(this.registrationId);
        await this.store.storePreKey(preKey.keyId, preKey.keyPair);
        
        const signedPreKey = await KeyHelper.generateSignedPreKey(this.identityKeyPair, this.registrationId);
        await this.store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

        return {
            registrationId: this.registrationId,
            identityKey: this.identityKeyPair.pubKey,
            preKey: {
                keyId: preKey.keyId,
                publicKey: preKey.keyPair.pubKey
            },
            signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: signedPreKey.keyPair.pubKey,
                signature: signedPreKey.signature
            }
        };
    }

    async establishSession(remoteUserId, preKeyBundle) {
        const remoteAddress = new SignalProtocolAddress(remoteUserId, 1);
        const builder = new SessionBuilder(this.store, remoteAddress);
        
        await builder.processPreKey({
            registrationId: preKeyBundle.registrationId,
            identityKey: preKeyBundle.identityKey,
            preKeyId: preKeyBundle.preKey.keyId,
            preKey: preKeyBundle.preKey.publicKey,
            signedPreKeyId: preKeyBundle.signedPreKey.keyId,
            signedPreKey: preKeyBundle.signedPreKey.publicKey,
            signature: preKeyBundle.signedPreKey.signature
        });
    }

    async encryptMessage(remoteUserId, message) {
        const remoteAddress = new SignalProtocolAddress(remoteUserId, 1);
        const cipher = new SessionCipher(this.store, remoteAddress);
        const buffer = new TextEncoder().encode(message);
        return await cipher.encrypt(buffer);
    }

    async decryptMessage(remoteUserId, ciphertext) {
        const remoteAddress = new SignalProtocolAddress(remoteUserId, 1);
        const cipher = new SessionCipher(this.store, remoteAddress);
        
        let plaintextBuffer;
        if (ciphertext.type === 3) {
            plaintextBuffer = await cipher.decryptPreKeyWhisperMessage(ciphertext.body, "binary");
        } else {
            plaintextBuffer = await cipher.decryptWhisperMessage(ciphertext.body, "binary");
        }
        
        return new TextDecoder().decode(new Uint8Array(plaintextBuffer));
    }
}

export const signalService = new SignalService();
