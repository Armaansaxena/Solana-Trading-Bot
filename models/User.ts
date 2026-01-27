import { Schema, model } from "mongoose";

interface IUser {
  telegramId: number;
  publicKey: string;
  encryptedKey: string;
  iv: string; // Used for decryption
}

const userSchema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true },
  publicKey: { type: String, required: true },
  encryptedKey: { type: String, required: true },
  iv: { type: String, required: true },
});

export const User = model<IUser>("User", userSchema);