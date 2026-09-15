import crypto, { KeyObject } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// Generate a 256-bit KeyObject from ENCRYPTION_SECRET.
// Throws at call-time if the environment variable is missing or insufficient.
function getEncryptionKey(): KeyObject {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error(
            'ENCRYPTION_SECRET environment variable is missing or too short (must be at least 32 characters). ' +
            'Set it in your .env file before starting the server.'
        );
    }
    // Truncate to exactly 32 bytes, wrap as KeyObject so it satisfies all Node.js crypto overloads
    const keyBytes = new Uint8Array(Buffer.from(secret.slice(0, 32), 'utf8'));
    return crypto.createSecretKey(keyBytes);
}

export function encryptKey(text: string): string {
    if (!text) return text;
    const rawIv = crypto.randomBytes(IV_LENGTH);
    const iv = new Uint8Array(rawIv);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Format: iv:authTag:encryptedText
    return `${rawIv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptKey(encryptedData: string): string {
    if (!encryptedData) return encryptedData;
    if (!encryptedData.includes(':')) {
        // Legacy or unencrypted key — return as-is
        return encryptedData;
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = new Uint8Array(Buffer.from(parts[0], 'hex'));
    const authTag = new Uint8Array(Buffer.from(parts[1], 'hex'));
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

export function maskKey(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '••••••••';
    // Example: AIza••••••••1234
    return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
}
