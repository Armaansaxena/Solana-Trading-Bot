import { Schema, model } from "mongoose";

interface IUser {
  telegramId: number;
  publicKey: string;
  encryptedKey: string;
  iv: string; // Initialization vector for decryption
  createdAt?: Date;
  updatedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    telegramId: { 
      type: Number, 
      required: true, 
      unique: true,
      index: true // Add index for faster queries
    },
    publicKey: { 
      type: String, 
      required: true 
    },
    encryptedKey: { 
      type: String, 
      required: true 
    },
    iv: { 
      type: String, 
      required: true 
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

export const User = model<IUser>("User", userSchema);