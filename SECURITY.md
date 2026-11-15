# Security & Audit Notes — TRUSTRECOVER

## 1. Smart Contract Security Controls
- **TrustRecoverRegistry v2 (`0xccED09099039A707fc5bda1274E647aC297B9D5F`):**
  - Access control via `onlyOwner` and `onlyReviewer` modifiers.
  - Zero-address (`address(0)`) and empty/oversized `caseId` & `bytes32(0)` validation.
  - Duplicate `caseId` protection on-chain.
- **TrustRecoverArbitration (`0xCc8E3699Bb55265f849bBC7120353ADbEed74EC1`):**
  - Economic anti-spam stake (`minStakeWei = 0.01 AVAX`) required on `submitDisputeWithStake`.
  - One-vote-per-reviewer enforcement via `require(!hasVoted[key][msg.sender])` and `onlyReviewer`.
  - Checks-Effects-Interactions (CEI) pattern in `releaseStake`: sets `c.stakeClaimed = true` before external `.call{value: amount}("")`.

## 2. Backend & AI Anti-Manipulation Controls
- All API keys (`GEMINI_API_KEY`) and RPC URLs are isolated server-side in `.env.local` (never exposed to browser bundle).
- Rate limiting (`15 requests/minute/IP`) and 25s request timeouts with model fallback.
- Evidence uploads capped at 5 files (`<= 5MB` each) with SHA-256 commitment hashing.
- Deterministic server-side score caps (`<= 25/100` without verified on-chain tx; `<= 40/100` with `CONTRADICTED` findings) prevent Prompt Injection overrides.