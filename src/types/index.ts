export interface SessionData {
    waitingForAddress?: boolean;
    waitingForAmount?: boolean;
    receiverAddress?: string;
    sendAmount?: number;
    waitingForSwapAmount?: boolean;
    swapFromToken?: string;
    swapToToken?: string;
    // Launch wizard
    launchStep?: "name" | "symbol" | "supply" | "description" | "confirm";
    tokenName?: string;
    tokenSymbol?: string;
    tokenSupply?: number;
    tokenDescription?: string;
}