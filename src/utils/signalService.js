import { KeyHelper, SessionBuilder, SessionCipher, SignalProtocolAddress } from "@privacyresearch/libsignal-protocol-typescript";
import { InMemorySignalProtocolStore } from "./SignalStore";

function bufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToBuffer(base64) {
    if (typeof base64 === 'object' && base64 !== null && base64.type === 'Buffer') {
        return new Uint8Array(base64.data).buffer;
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

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
            identityKey: bufferToBase64(this.identityKeyPair.pubKey),
            preKey: {
                keyId: preKey.keyId,
                publicKey: bufferToBase64(preKey.keyPair.pubKey)
            },
            signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: bufferToBase64(signedPreKey.keyPair.pubKey),
                signature: bufferToBase64(signedPreKey.signature)
            }
        };
    }

    async establishSession(remoteUserId, preKeyBundle) {
        const remoteAddress = new SignalProtocolAddress(remoteUserId, 1);
        const builder = new SessionBuilder(this.store, remoteAddress);

        await builder.processPreKey({
            registrationId: preKeyBundle.registrationId,
            identityKey: base64ToBuffer(preKeyBundle.identityKey),
            preKey: {
                keyId: preKeyBundle.preKey.keyId,
                publicKey: base64ToBuffer(preKeyBundle.preKey.publicKey),
            },
            signedPreKey: {
                keyId: preKeyBundle.signedPreKey.keyId,
                publicKey: base64ToBuffer(preKeyBundle.signedPreKey.publicKey),
                signature: base64ToBuffer(preKeyBundle.signedPreKey.signature),
            },
        });
    }

    async encryptMessage(remoteUserId, message) {
        const remoteAddress = new SignalProtocolAddress(remoteUserId, 1);
        const cipher = new SessionCipher(this.store, remoteAddress);
        const encoded = new TextEncoder().encode(message);
        return await cipher.encrypt(encoded.buffer);
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
