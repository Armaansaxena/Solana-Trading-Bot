import pkg from "pg";
const { Pool } = pkg;
import * as dotenv from "dotenv";

dotenv.config();

async function check() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
        console.log("🔍 Checking database columns for table 'User'...");
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'User'
        `);
        
        if (res.rows.length === 0) {
            // Try lowercase if uppercase fails
            const res2 = await pool.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'user'
            `);
            console.table(res2.rows);
        } else {
            console.table(res.rows);
        }

        console.log("\n🔍 Checking if 'Wallet' table exists...");
        const walletRes = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'Wallet' OR table_name = 'wallet'
            );
        `);
        console.log("Wallet table exists:", walletRes.rows[0].exists);

    } catch (err) {
        console.error("❌ Error checking DB:", err);
    } finally {
        await pool.end();
    }
}

check();
