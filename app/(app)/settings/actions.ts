"use server";

import { encryptKey, decryptKey, maskKey } from "@/lib/crypto";

export async function encryptGeminiKey(key: string) {
    if (!key) return null;
    // If the key is already masked (contains bullet points or stars), don't encrypt again.
    // This means the user saved without changing the input.
    if (key.includes("•") || key.includes("*")) {
        return key;
    }
    return encryptKey(key);
}

export async function getMaskedGeminiKey(encryptedKey: string) {
    if (!encryptedKey) return "";
    try {
        const decrypted = decryptKey(encryptedKey);
        return maskKey(decrypted);
    } catch (error) {
        console.error("Failed to decrypt Gemini key:", error);
        // If decryption fails, just return a generic mask so the UI doesn't crash
        return "••••••••";
    }
}

export async function encryptResendKey(key: string) {
    if (!key) return null;
    if (key.includes("•") || key.includes("*")) {
        return key;
    }
    return encryptKey(key);
}

export async function getMaskedResendKey(encryptedKey: string) {
    if (!encryptedKey) return "";
    try {
        const decrypted = decryptKey(encryptedKey);
        return maskKey(decrypted);
    } catch (error) {
        console.error("Failed to decrypt Resend key:", error);
        return "••••••••";
    }
}
