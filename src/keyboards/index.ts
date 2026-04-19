import { Markup } from "telegraf";

/**
 * NEW Simplified V3 UI (4 Main Buttons)
 */
export const mainKeyboard = (activeChain: string = "solana") => {
    const chainEmoji = activeChain === "solana" ? "🟣" : activeChain === "ethereum" ? "🔹" : "🔵";
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('💳 Wallet', 'wallet_menu'),
            Markup.button.callback('🔄 Swap', 'swap_menu')
        ],
        [
            Markup.button.callback('📊 Portfolio', 'portfolio'),
            Markup.button.callback('🛠️ Tools', 'tools_menu')
        ],
        [
            Markup.button.callback(`${chainEmoji} Network: ${activeChain.toUpperCase()}`, 'switch_chain_menu')
        ]
    ]);
};

/**
 * Wallet Management Menu
 */
export const walletKeyboard = (activeChain: string = "solana") => {
    const asset = (activeChain === "ethereum" || activeChain === "base") ? "ETH" : "SOL";
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('💰 Balance', 'check_balance'),
            Markup.button.callback(`💸 Send ${asset}`, 'send_token')
        ],
        [
            Markup.button.callback('🔍 Public Key', 'show_public_key'),
            Markup.button.callback('🔑 Export Key', 'show_private_key')
        ],
        [
            Markup.button.callback('🔄 Switch Wallet', 'switch_wallet_menu'),
            Markup.button.callback('🏠 Back', 'main_menu')
        ]
    ]);
};

/**
 * Tools & Features Menu (Simplified)
 */
export const toolsKeyboard = () => Markup.inlineKeyboard([
    [
        Markup.button.callback('🚀 Launch', 'launch_menu'),
        Markup.button.callback('🤖 AI', 'ai_menu')
    ],
    [
        Markup.button.callback('🔔 Alerts', 'alerts_menu'),
        Markup.button.callback('📜 More', 'more_tools_menu'),
    ],
    [Markup.button.callback('🏠 Back', 'main_menu')]
]);

/**
 * Secondary Tools Menu
 */
export const moreToolsKeyboard = () => Markup.inlineKeyboard([
    [
        Markup.button.callback('📜 History', 'history_menu'),
        Markup.button.callback('👥 Referral', 'referral_menu')
    ],
    [
        Markup.button.callback('👁️ Watchlist', 'watchlist_menu'),
        Markup.button.callback('⚙️ Settings', 'settings_menu')
    ],
    [Markup.button.callback('🔙 Back', 'tools_menu')]
]);

export const dangerKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('⚠️ YES, Show Private Key', 'confirm_show_private')],
    [Markup.button.callback('❌ Cancel', 'wallet_menu')]
]);

export const backToMenuKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
]);

// Keep for compatibility during transition
export const postWalletKeyboard = () => walletKeyboard();
