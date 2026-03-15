import { Markup } from "telegraf";

export const mainKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('✨ Generate Wallet', 'generate_wallet')],
    [
        Markup.button.callback('🔍 Public Key', 'show_public_key'),
        Markup.button.callback('💰 Balance', 'check_balance')
    ],
    [
        Markup.button.callback('💸 Send SOL', 'send_sol'),
        Markup.button.callback('🔑 Export Key', 'show_private_key')
    ],
    [
        Markup.button.callback('🔄 Swap', 'swap_menu'),
        Markup.button.callback('📊 Portfolio', 'portfolio')
    ],
    [
        Markup.button.callback('🚀 Launch Token', 'launch_menu'),
        Markup.button.callback('🤖 AI Assistant', 'ai_menu')
    ],
    [
        Markup.button.callback('🔔 Alerts', 'alerts_menu'),
        Markup.button.callback('📜 History', 'history_menu'),
    ],
    [
        Markup.button.callback('👥 Referral', 'referral_menu'),
        Markup.button.callback('👁️ Watchlist', 'watchlist_menu'),
        Markup.button.callback('⚙️ Settings', 'settings_menu')
    ]
]);

export const postWalletKeyboard = () => Markup.inlineKeyboard([
    [
        Markup.button.callback('💸 Send SOL', 'send_sol'),
        Markup.button.callback('💰 Balance', 'check_balance')
    ],
    [
        Markup.button.callback('🔄 Swap', 'swap_menu'),
        Markup.button.callback('📊 Portfolio', 'portfolio')
    ],
    [
        Markup.button.callback('🔍 Public Key', 'show_public_key'),
        Markup.button.callback('🔑 Export Key', 'show_private_key')
    ],
    [
        Markup.button.callback('🚀 Launch Token', 'launch_menu'),
        Markup.button.callback('🤖 AI Assistant', 'ai_menu')
    ],
    [
        Markup.button.callback('🔔 Alerts', 'alerts_menu'),
        Markup.button.callback('📜 History', 'history_menu'),
    ],
    [
        Markup.button.callback('👥 Referral', 'referral_menu'),
        Markup.button.callback('👁️ Watchlist', 'watchlist_menu'),
        Markup.button.callback('⚙️ Settings', 'settings_menu')
    ],
    [   Markup.button.callback('🏠 Main Menu', 'main_menu')]
]);

export const dangerKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('⚠️ YES, Show Private Key', 'confirm_show_private')],
    [Markup.button.callback('❌ Cancel', 'main_menu')]
]);

export const backToMenuKeyboard = () => Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Main Menu', 'main_menu')]
]);