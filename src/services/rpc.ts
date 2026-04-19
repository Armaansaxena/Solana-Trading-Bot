import { Connection } from "@solana/web3.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ override: true });

const isDevnet = process.env.NETWORK_TYPE === "devnet";

// --- RPC LISTS ---
export const SOLANA_RPCS = [
    isDevnet ? process.env.SOLANA_DEVNET_RPC : process.env.SOLANA_MAINNET_RPC,
    isDevnet ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com",
    "https://solana-mainnet.rpc.extrnode.com",
].filter(Boolean) as string[];

export const EVM_NETWORKS = {
    ethereum: {
        chainId: isDevnet ? 11155111 : 1,
        rpcs: [
            isDevnet ? process.env.ETH_DEVNET_RPC : process.env.ETH_MAINNET_RPC,
            isDevnet ? "https://rpc2.sepolia.org" : "https://eth.llamarpc.com",
            isDevnet ? "https://eth-sepolia.publicnode.com" : "https://cloudflare-eth.com",
        ].filter(Boolean) as string[]
    },
    base: {
        chainId: isDevnet ? 84532 : 8453,
        rpcs: [
            isDevnet ? process.env.BASE_DEVNET_RPC : process.env.BASE_MAINNET_RPC,
            isDevnet ? "https://sepolia.base.org" : "https://mainnet.base.org",
            isDevnet ? "https://base-sepolia.publicnode.com" : "https://base.llamarpc.com",
        ].filter(Boolean) as string[]
    }
};

// --- ADAPTIVE RPC LOGIC ---
interface RPCLatency {
    url: string;
    latency: number;
}

const latencies: Record<"solana" | "ethereum" | "base", RPCLatency[]> = {
    solana: [],
    ethereum: [],
    base: []
};

const providerCache: Record<string, any> = {};

async function updateLatencies(chain: "solana" | "ethereum" | "base") {
    const rpcs = chain === "solana" ? SOLANA_RPCS : EVM_NETWORKS[chain].rpcs;
    const chainId = chain === "solana" ? undefined : EVM_NETWORKS[chain].chainId;
    const results: RPCLatency[] = [];

    for (const url of rpcs) {
        if (!url) continue;
        const start = Date.now();
        try {
            if (chain === "solana") {
                const conn = new Connection(url);
                await Promise.race([
                    conn.getSlot(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
                ]);
            } else {
                // Pass chainId to avoid network detection errors
                const tempProvider = new ethers.JsonRpcProvider(url, chainId, { staticNetwork: true });
                await Promise.race([
                    tempProvider.getBlockNumber(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 2000))
                ]);
            }
            results.push({ url, latency: Date.now() - start });
        } catch (e) {
            results.push({ url, latency: 9999 });
        }
    }
    
    latencies[chain] = results.sort((a, b) => a.latency - b.latency);
    
    if (latencies[chain].length > 0) {
        delete providerCache[chain]; // Refresh provider on next call
        const fastest = latencies[chain][0];
        if (fastest) {
            console.log(`⚡ Fastest ${chain} RPC: ${fastest.url} (${fastest.latency}ms)`);
        }
    }
}

// Update every 5m
setInterval(() => {
    updateLatencies("solana");
    updateLatencies("ethereum");
    updateLatencies("base");
}, 300000);

// Initial ping
updateLatencies("solana");
updateLatencies("ethereum");
updateLatencies("base");

// --- PUBLIC EXPORTS ---

export function getSolanaConnection() {
    if (providerCache.solana) return providerCache.solana;
    
    const url = (latencies.solana.length > 0 && latencies.solana[0] && latencies.solana[0].latency < 9999)
        ? latencies.solana[0].url 
        : SOLANA_RPCS[0];
    
    providerCache.solana = new Connection(url!, "confirmed");
    return providerCache.solana;
}

export function getEVMProvider(chain: "ethereum" | "base") {
    if (providerCache[chain]) return providerCache[chain];

    const { chainId } = EVM_NETWORKS[chain];
    const sortedRpcs = latencies[chain].length > 0 
        ? latencies[chain].map(l => l.url)
        : EVM_NETWORKS[chain].rpcs;

    const providerConfigs = sortedRpcs.map(url => ({
        provider: new ethers.JsonRpcProvider(url, chainId, { 
            staticNetwork: true,
            batchMaxCount: 1
        }),
        stallTimeout: 500,
        weight: 1,
        priority: 1
    }));
    
    providerCache[chain] = new ethers.FallbackProvider(providerConfigs, chainId, {
        quorum: 1
    });

    return providerCache[chain];
}

// Keep export connection for backward compatibility (defaults to fastest Solana)
export const connection = getSolanaConnection();
