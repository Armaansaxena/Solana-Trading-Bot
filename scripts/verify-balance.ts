import { getEVMBalance } from "../src/services/evm";

async function verifyAddress() {
    const address = "0x065656eb23a3bc33320EcA73Eb439e00005651aB";
    console.log(`🔍 Checking balance for: ${address}`);
    
    const ethBal = await getEVMBalance(address, "ethereum");
    const baseBal = await getEVMBalance(address, "base");
    
    console.log(`🔹 Ethereum Sepolia: ${ethBal} ETH`);
    console.log(`🔵 Base Sepolia: ${baseBal} ETH`);
    
    process.exit();
}

verifyAddress().catch(console.error);
