import pinataSDK from "@pinata/sdk";
import * as dotenv from "dotenv";
dotenv.config({ override: true });

const apiKey = process.env.PINATA_API_KEY;
const secretKey = process.env.PINATA_SECRET_KEY;

if (!apiKey || !secretKey) {
    console.warn("⚠️ PINATA_API_KEY or PINATA_SECRET_KEY is missing from .env. IPFS uploads will fail.");
}

const pinata = new pinataSDK(apiKey || "", secretKey || "");

export async function uploadImageToIPFS(
    imageBuffer: Buffer,
    filename: string
): Promise<string> {
    try {
        const { Readable } = await import("stream");
        const stream = Readable.from(imageBuffer);
        (stream as any).path = filename;

        const result = await pinata.pinFileToIPFS(stream, {
            pinataMetadata: { name: filename },
        });

        return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    } catch (error) {
        console.error("IPFS image upload error:", error);
        throw error;
    }
}

export async function uploadMetadataToIPFS(metadata: {
    name: string;
    symbol: string;
    description: string;
    image: string;
}): Promise<string> {
    try {
        const result = await pinata.pinJSONToIPFS(metadata, {
            pinataMetadata: { name: `${metadata.symbol}-metadata` },
        });

        return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
    } catch (error) {
        console.error("IPFS metadata upload error:", error);
        throw error;
    }
}