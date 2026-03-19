import * as dotenv from "dotenv";
dotenv.config({ path: process.cwd() + "/.env" });

import { Keypair, PublicKey, Transaction, sendAndConfirmTransaction, Connection } from "@solana/web3.js";
import { createCreateMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bs58 from "bs58";
import * as crypto from "crypto";

const MINT_ADDRESS = "9v2GVeHJcgS6rzQeSBDyT6XmiL3gcJfYGvm78pUwEoYV";
const TELEGRAM_ID = "1531188039";
const TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function decrypt(iv: string, encryptedText: string): string {
    const key = process.env.ENCRYPTION_KEY!;
    const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(key), Buffer.from(iv, "hex"));
    let decrypted = decipher.update(Buffer.from(encryptedText, "hex"));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

async function addMetadata() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
    const prisma = new PrismaClient({ adapter });
    const connection = new Connection("https://api.devnet.solana.com", "confirmed");

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(TELEGRAM_ID) } });
    if (!user) throw new Error("User not found");

    const decryptedKey = decrypt(user.iv, user.encryptedKey);
    const keypair = Keypair.fromSecretKey(bs58.decode(decryptedKey));

    const [metadataPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), TOKEN_METADATA_PROGRAM_ID.toBuffer(), new PublicKey(MINT_ADDRESS).toBuffer()],
        TOKEN_METADATA_PROGRAM_ID
    );

    const transaction = new Transaction().add(
        createCreateMetadataAccountV3Instruction(
            {
                metadata: metadataPDA,
                mint: new PublicKey(MINT_ADDRESS),
                mintAuthority: keypair.publicKey,
                payer: keypair.publicKey,
                updateAuthority: keypair.publicKey,
            },
            {
                createMetadataAccountArgsV3: {
                    data: {
                        name: "ArmEthSol Token",
                        symbol: "AETS",
                        uri: "https://raw.githubusercontent.com/Armaansaxena/Solana-Trading-Bot/main/token-metadata.json",
                        sellerFeeBasisPoints: 0,
                        creators: null,
                        collection: null,
                        uses: null,
                    },
                    isMutable: true,
                    collectionDetails: null,
                },
            }
        )
    );

    await sendAndConfirmTransaction(connection, transaction, [keypair]);
    console.log("✅ Metadata added!");
    console.log(`View: https://solscan.io/token/${MINT_ADDRESS}?cluster=devnet`);
    await prisma.$disconnect();
}

addMetadata().catch(console.error);