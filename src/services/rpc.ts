import { Connection } from "@solana/web3.js";
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { redis } from "./redis";

dotenv.config({ override: true });

/**
 * DYNAMIC NETWORK DETECTION
 */
export async function getNetworkType(): Promise<"mainnet" | "devnet"> {
    try {
        const liveType = await redis.get<string>("global:network_type");
        if (liveType === "mainnet" || liveType === "devnet") {
            return liveType;
        }
    } catch (e) {}
    return (process.env.NETWORK_TYPE as "mainnet" | "devnet") || "devnet";
}

export async function setNetworkType(type: "mainnet" | "devnet") {
    await redis.set("global:network_type", type);
    for (const key in providerCache) {
        delete providerCache[key];
    }
    await updateLatencies("solana");
    await updateLatencies("ethereum");
    await updateLatencies("base");
    console.log(`🌐 Network globally switched to: ${type.toUpperCase()}`);
}

// --- RPC LISTS ---
export function getSolanaRPCs(isDevnet: boolean) {
    return [
        isDevnet ? process.env.SOLANA_DEVNET_RPC : process.env.SOLANA_MAINNET_RPC,
        isDevnet ? "https://api.devnet.solana.com" : "https://api.mainnet-beta.solana.com",
    ].filter(Boolean) as string[];
}

export function getEVMNetworks(isDevnet: boolean) {
    return {
        ethereum: {
            chainId: isDevnet ? 11155111 : 1,
            rpcs: [
                isDevnet ? process.env.ETH_DEVNET_RPC : process.env.ETH_MAINNET_RPC,
                isDevnet ? "https://rpc2.sepolia.org" : "https://eth.llamarpc.com",
            ].filter(Boolean) as string[]
        },
        base: {
            chainId: isDevnet ? 84532 : 8453,
            rpcs: [
                isDevnet ? process.env.BASE_DEVNET_RPC : process.env.BASE_MAINNET_RPC,
                isDevnet ? "https://sepolia.base.org" : "https://mainnet.base.org",
            ].filter(Boolean) as string[]
        }
    };
}

// For backward compatibility with files that import it directly
export const EVM_NETWORKS = getEVMNetworks(process.env.NETWORK_TYPE === "mainnet" ? false : true);

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
    const isDevnet = (await getNetworkType()) === "devnet";
    const networks = getEVMNetworks(isDevnet);
    const rpcs = chain === "solana" ? getSolanaRPCs(isDevnet) : networks[chain].rpcs;
    const chainId = chain === "solana" ? undefined : networks[chain].chainId;
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
        delete providerCache[chain];
        const fastest = latencies[chain][0];
        if (fastest && fastest.latency < 9999) {
            console.log(`⚡ Fastest ${chain} RPC: ${fastest.url} (${fastest.latency}ms)`);
        }
    }
}

// Background updates
setInterval(async () => {
    await updateLatencies("solana");
    await updateLatencies("ethereum");
    await updateLatencies("base");
}, 300000);

// Initial ping
updateLatencies("solana");
updateLatencies("ethereum");
updateLatencies("base");

// --- PUBLIC EXPORTS ---

export async function getSolanaConnection() {
    if (providerCache.solana) return providerCache.solana;
    
    const isDevnet = (await getNetworkType()) === "devnet";
    const rpcs = getSolanaRPCs(isDevnet);
    
    const url = (latencies.solana.length > 0 && latencies.solana[0] && latencies.solana[0].latency < 9999)
        ? latencies.solana[0].url 
        : rpcs[0];
    
    providerCache.solana = new Connection(url!, "confirmed");
    return providerCache.solana;
}

export async function getEVMProvider(chain: "ethereum" | "base") {
    if (providerCache[chain]) return providerCache[chain];

    const isDevnet = (await getNetworkType()) === "devnet";
    const networks = getEVMNetworks(isDevnet);
    const { chainId } = networks[chain];
    
    const sortedRpcs = (latencies[chain].length > 0 && latencies[chain][0] && latencies[chain][0].latency < 9999)
        ? latencies[chain].map(l => l.url)
        : networks[chain].rpcs;

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

export let connection: Connection;
getSolanaConnection().then(c => connection = c);
