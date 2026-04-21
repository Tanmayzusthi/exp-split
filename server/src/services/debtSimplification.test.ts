import { getSimplifiedDebts, computeBalances, simplifyDebts } from "./debtSimplification";

// --- Test 1: Basic 3-person split ---
// Alice paid $90, Bob owes $30, Carol owes $30, Alice owes $30
const test1 = getSimplifiedDebts([
  {
    payerId: "alice",
    shares: [
      { userId: "alice", amount: 30 },
      { userId: "bob",   amount: 30 },
      { userId: "carol", amount: 30 },
    ],
  },
]);
console.log("Test 1 — Basic split:");
console.log(test1);
// Expected: bob→alice $30, carol→alice $30 (2 transactions)

// --- Test 2: Chain debt (A owes B, B owes C → simplify to A owes C) ---
const test2 = getSimplifiedDebts([
  {
    payerId: "B",
    shares: [{ userId: "A", amount: 50 }, { userId: "B", amount: 0 }],
  },
  {
    payerId: "C",
    shares: [{ userId: "B", amount: 50 }, { userId: "C", amount: 0 }],
  },
]);
console.log("\nTest 2 — Chain debt:");
console.log(test2);
// Ideal: A→C $50 (1 transaction instead of 2)

// --- Test 3: Already settled ---
const test3 = getSimplifiedDebts([]);
console.log("\nTest 3 — Empty:");
console.log(test3); // Expected: []

// --- Test 4: Mutual debts cancel ---
const test4 = getSimplifiedDebts([
  {
    payerId: "alice",
    shares: [{ userId: "bob", amount: 100 }, { userId: "alice", amount: 0 }],
  },
  {
    payerId: "bob",
    shares: [{ userId: "alice", amount: 100 }, { userId: "bob", amount: 0 }],
  },
]);
console.log("\nTest 4 — Mutual cancel:");
console.log(test4); // Expected: [] (net zero)