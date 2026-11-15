# TRUSTRECOVER — AI-Powered DeFi Dispute Intelligence & Recovery (Avalanche UniHack 2026)

> **AI investigates • Evidence is verified • Avalanche anchors an auditable case history • Human reviewers validate outcomes.**

- **Live Web App:** https://trustrecover.vercel.app
- **Registry v2 Contract (Avalanche Fuji 43113):** [`0xccED09099039A707fc5bda1274E647aC297B9D5F`](https://testnet.snowtrace.io/address/0xccED09099039A707fc5bda1274E647aC297B9D5F)
- **Arbitration Contract (Avalanche Fuji 43113):** [`0xCc8E3699Bb55265f849bBC7120353ADbEed74EC1`](https://testnet.snowtrace.io/address/0xCc8E3699Bb55265f849bBC7120353ADbEed74EC1)

## Core Architecture
1. **AskPay (Multi-Chain Avalanche Intelligence):** Queries live RPCs for **Avalanche Fuji C-Chain (`43113`)** and **Dispatch L1 Testnet (`779672`)**. Resolves Verified ABIs via Routescan API + proxy fallback (`transfer`, `approve`, `deposit`, `withdraw`), ERC-20 logs, and Avalanche Warp Messaging (`SendWarpMessage`).
2. **DoubtStamp (Multimodal Evidence & Anti-Tamper):** Supports up to 5 files (`<= 5MB`: TXT, JSON, CSV, MD, LOG, PDF, PNG, JPG, WEBP), computes SHA-256 file commitment hashes, and flags `VERIFIED`, `CONTRADICTED`, `INSUFFICIENT`, or `UNVERIFIABLE`.
3. **LEGALMIND (Recovery Guidance & Guardrails):** Generates prioritized investigative steps and missing-evidence checklists while enforcing strict legal/technical disclaimers (never promises fund recovery or blockchain reversal).
4. **Cross-Engine Consistency Check & Recovery Readiness Score:** Server-side deterministic verification with hard score caps (`<= 25/100` if no verified on-chain tx; `<= 40/100` if `CONTRADICTED` findings exist).
5. **On-Chain Arbitration & Registry:** Combines `TrustRecoverRegistry` v2 (`keccak256` anti-tamper report anchoring) and `TrustRecoverArbitration` (`0.01 AVAX` anti-spam stake, `onlyReviewer` voting, and automated `releaseStake`).

## Verified On-Chain Proof (Arbitration Full Flow: `TR-MWI3OZZN`)
- **Submit & Lock `0.01 AVAX`:** `0xc75d353848b9d4c5191395062eb8b3276c637b283818f3a6b6f7bcfc2bd9d9cb`
- **Reviewer Vote & Finalize:** `0xb2501fe28add22d73b48b1815a9fd90af37ba0ab173ba93bcc8dd27d8f84c655`
- **Release Stake:** `0x6354fe4f726d8af1c2c3a09564662c8036a2f92a70e207f439e002adf0538084`

## Automated Testing
- `node scripts/test-api.mjs` — API validation & RPC checks (`5/5 PASS`)
- `node scripts/benchmark-ai.mjs` — AI Accuracy, Multi-Chain L1 & Prompt Injection resistance (`5/5 PASS`)