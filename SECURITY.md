# Security Model: SolBot

SolBot is an **alpha** project. This document states what it protects, what it does not, and the known limits of the design. Do not use it with funds you cannot afford to lose.

## Design summary

- Users interact through Telegram. The backend (Node.js/TypeScript) creates and stores wallets on their behalf, so the bot is **custodial**: the server can sign for every wallet.
- Private keys are encrypted at rest with **AES-256-GCM** (authenticated encryption, random 96-bit nonce per record) before being written to PostgreSQL. Records written by the earlier AES-256-CBC code are still readable and are upgraded to GCM.
- The encryption key is supplied through the `ENCRYPTION_KEY_V2` environment variable (64 hex characters, 256 bits).
- On devnet/testnet the bot runs in simulation mode.

## What this protects against

- A copy of the database alone (backup leak, SQL read access) does not reveal private keys without the encryption key.
- Tampering with stored ciphertext is detected at decryption time (GCM authentication tag).
- Reusing a nonce across records is avoided by generating a fresh random nonce each time.

## What this does NOT protect against

- **Compromise of the running server.** An attacker who can read both the database and the process environment gets every key. There is a single master key for all users.
- **Operator access.** Anyone with production access to the environment and database can decrypt all wallets.
- **Telegram account takeover.** Whoever controls a user's Telegram account controls that user's bot wallets.
- **Loss of the encryption key.** Without it, stored keys are unrecoverable.

## Known limitations and planned work

- Replace the single env-var master key with a KMS or HSM-backed key (envelope encryption with per-user data keys), so a database dump plus env read is no longer enough.
- Bind ciphertexts to their wallet or user ID using the AAD parameter, so rows cannot be swapped.
- Add per-user spending limits and confirmation steps for large transfers.
- Add rate limiting and audit logging that never records keys or secrets.
- Review how the AI assistant is connected to trading actions, to guard against prompt injection triggering transfers.
- Rotate the master key periodically using the version-detection already built into `decrypt`.

## Reporting a vulnerability

Please open a private security advisory on this repository, or contact the maintainer through the email on the GitHub profile. Do not post exploit details in public issues.
