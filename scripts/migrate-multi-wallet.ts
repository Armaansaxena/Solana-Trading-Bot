import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pkg from "pg";
const { Pool } = pkg;
import * as dotenv from "dotenv";

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function migrate() {
    console.log("🚀 Starting Multi-Wallet Migration...");

    try {
        // 1. Fetch all existing users with old key columns
        const users = await (prisma.user as any).findMany({
            where: {
                publicKey: { not: null },
                encryptedKey: { not: null },
                iv: { not: null }
            }
        });

        console.log(`📊 Found ${users.length} users to migrate.`);

        for (const user of users) {
            console.log(`⏳ Migrating user ${user.telegramId}...`);

            // 2. Create the new Wallet record
            const wallet = await prisma.wallet.create({
                data: {
                    userId: user.id,
                    publicKey: user.publicKey,
                    encryptedKey: user.encryptedKey,
                    iv: user.iv,
                    name: "Main Wallet"
                }
            });

            // 3. Set this as the active wallet for the user
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    activeWalletId: wallet.id
                }
            });

            console.log(`✅ Successfully migrated ${user.telegramId} to multi-wallet.`);
        }

        console.log("🎉 Migration completed successfully!");
    } catch (error) {
        console.error("❌ Migration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

migrate();
