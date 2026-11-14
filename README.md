# TRUSTRECOVER — AI-Powered DeFi Dispute Intelligence & Recovery

Built for **Avalanche Team1 Vietnam UniHack 2026**.

> **Core Principles**: AI investigates • Evidence is verified • Avalanche anchors an auditable case history • Human reviewers validate outcomes.

## Architecture & Modules
1. **Avalanche Fuji Verification Engine (`lib/avalanche/verifyTransaction.ts`)**:
   - Connects directly to Avalanche Fuji Testnet (Chain ID `43113`) via `ethers.js` v6 RPC.
   - Reads real transaction receipts, status, block numbers, gas usage, and decodes ERC-20 (`Transfer`, `Approval`) event logs.
2. **Unified AI Dispute Pipeline (`lib/dispute/geminiPipeline.ts`)**:
   - **AskPay (Transaction Intelligence)**: Explains verified on-chain facts and flags unverified claims.
   - **DoubtStamp (Evidence Consistency Analysis)**: Cross-checks user claims and uploaded evidence (including multimodal images/PDFs and SHA-256 commitment hashes) against real Fuji on-chain data, classifying findings as `VERIFIED`, `CONTRADICTED`, `INSUFFICIENT`, or `UNVERIFIABLE`.
   - **LEGALMIND (Recovery Intelligence)**: Produces prioritized technical checklists, missing-evidence steps, and legal reference scopes with mandatory disclaimers (never promises fund recovery or blockchain reversal).
3. **Immutable Audit Trail on Avalanche Fuji (`contracts/TrustRecoverRegistry.sol`)**:
   - Deployed Contract Address (Fuji Testnet): [`0xccED09099039A707fc5bda1274E647aC297B9D5F`](https://testnet.snowtrace.io/address/0xccED09099039A707fc5bda1274E647aC297B9D5F)
   - Human Reviewers sign via MetaMask/Core Wallet to anchor `caseId`, `txHash`, `reportHash`, and `verdict` on-chain.

## Local Setup
1. Install dependencies: `npm install`
2. Create `.env.local` (never commit):
   - `AVALANCHE_FUJI_RPC_URL=[https://api.avax-test.network/ext/bc/C/rpc](https://api.avax-test.network/ext/bc/C/rpc)`
   - `AVALANCHE_FUJI_CHAIN_ID=43113`
   - `GEMINI_API_KEY=your_gemini_api_key`
   - `GEMINI_MODEL=gemini-3.6-flash`
3. Run development server: `npm run dev`
4. Run automated API tests (while dev server is running): `node scripts/test-api.mjs`