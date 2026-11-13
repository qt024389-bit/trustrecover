import assert from "node:assert/strict";

const BASE = "http://localhost:3000";

async function runTests() {
  console.log("=== TRUSTRECOVER AUTOMATED API TEST SUITE ===");

  // Test 1: Invalid txHash -> 400
  const r1 = await fetch(`${BASE}/api/verify-tx?txHash=0x12345`);
  const j1 = await r1.json();
  assert.equal(r1.status, 400);
  assert.equal(j1.error.code, "INVALID_HASH");
  console.log("[PASS] Test 1: Invalid txHash rejected (400 INVALID_HASH)");

  // Test 2: Non-existent txHash -> 404
  const r2 = await fetch(`${BASE}/api/verify-tx?txHash=${"0x" + "0".repeat(64)}`);
  const j2 = await r2.json();
  assert.equal(r2.status, 404);
  assert.equal(j2.error.code, "TX_NOT_FOUND");
  console.log("[PASS] Test 2: Non-existent txHash rejected (404 TX_NOT_FOUND)");

  // Test 3: Real Avalanche Fuji txHash -> 200
  const r3 = await fetch(
    `${BASE}/api/verify-tx?txHash=0x75e0dcfadff069af83e0c15369da717d5cfad1e358f2e56f54296f263492e8df`
  );
  const j3 = await r3.json();
  assert.equal(r3.status, 200);
  assert.equal(j3.data.verifiedOnChain, true);
  assert.equal(j3.data.network.chainId, 43113);
  console.log("[PASS] Test 3: Real Fuji transaction verified (200 Chain ID 43113)");

  // Test 4: On-Chain Smart Contract Registry -> 200
  const r4 = await fetch(`${BASE}/api/registry/cases`);
  const j4 = await r4.json();
  assert.equal(r4.status, 200);
  assert.equal(j4.success, true);
  assert.ok(j4.totalCases >= 1, "Expected at least 1 anchored case on Fuji");
  console.log(`[PASS] Test 4: Smart Contract Registry live (${j4.totalCases} anchored case(s))`);

  // Test 5: Dispute Analyze validation -> 400
  const r5 = await fetch(`${BASE}/api/dispute/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHash: "0x123", userClaim: "ngan" }),
  });
  const j5 = await r5.json();
  assert.equal(r5.status, 400);
  assert.equal(j5.error.code, "INVALID_USER_CLAIM");
  console.log("[PASS] Test 5: Dispute Analyze input validation (400 INVALID_USER_CLAIM)");

  console.log("=== ALL 5 TESTS PASSED! ===");
}

runTests().catch((err) => {
  console.error("[FAIL]", err);
  process.exit(1);
});