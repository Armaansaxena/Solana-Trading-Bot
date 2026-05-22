import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 characters long in your .env file!");
}

/**
 * Encrypts a string (like a private key) using AES-256-CBC
 */
export function encrypt(text: string) {
    const iv = crypto.randomBytes(16); // Generate a fresh Initialization Vector
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY!), iv);
    
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    return { 
        iv: iv.toString("hex"), 
        content: encrypted.toString("hex") 
    };
}

/**
 * Decrypts the stored hex string back into the original private key
 */
export function decrypt(iv: string, content: string) {
    const decipher = crypto.createDecipheriv(
        ALGORITHM, 
        Buffer.from(ENCRYPTION_KEY!), 
        Buffer.from(iv, "hex")
    );
    
    let decrypted = decipher.update(Buffer.from(content, "hex"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString();
}