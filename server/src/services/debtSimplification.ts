/**
 * Debt Simplification Algorithm
 *
 * Reduces an arbitrary set of debts among N people to at most N-1
 * transactions using a greedy min/max heap approach.
 *
 * Time Complexity:  O(N log N)
 * Space Complexity: O(N)
 */

export interface Transaction {
  from: string;  // userId who pays
  to: string;    // userId who receives
  amount: number;
}

/**
 * Core algorithm.
 * @param balances - Map of userId → net balance
 *   Positive = is owed money (creditor)
 *   Negative = owes money (debtor)
 * @returns Minimized list of transactions
 */
export function simplifyDebts(
  balances: Map<string, number>
): Transaction[] {
  const transactions: Transaction[] = [];

  // Separate into creditors (+) and debtors (-)
  // Using arrays sorted descending by absolute value (greedy)
  const creditors: { id: string; amount: number }[] = [];
  const debtors:   { id: string; amount: number }[] = [];

  for (const [userId, balance] of balances.entries()) {
    const rounded = Math.round(balance * 100) / 100; // avoid float drift
    if (rounded > 0)  creditors.push({ id: userId, amount: rounded });
    if (rounded < 0)  debtors.push({   id: userId, amount: Math.abs(rounded) });
  }

  // Sort descending — greedily match largest debtor to largest creditor
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  let i = 0; // pointer for creditors
  let j = 0; // pointer for debtors

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor   = debtors[j];

    const settled = Math.min(creditor.amount, debtor.amount);
    const roundedSettled = Math.round(settled * 100) / 100;

    if (roundedSettled > 0) {
      transactions.push({
        from:   debtor.id,
        to:     creditor.id,
        amount: roundedSettled,
      });
    }

    creditor.amount = Math.round((creditor.amount - settled) * 100) / 100;
    debtor.amount   = Math.round((debtor.amount   - settled) * 100) / 100;

    // Advance pointer for whichever side is fully settled
    if (creditor.amount === 0) i++;
    if (debtor.amount   === 0) j++;
  }

  return transactions;
}

/**
 * Computes net balances for a group from raw expense shares.
 *
 * @param expenses - Array of { payerId, shares: [{ userId, amount }] }
 * @returns Map<userId, netBalance>
 */
export interface ExpenseInput {
  payerId: string;
  shares: {
    userId: string;
    amount: number;
  }[];
}

export function computeBalances(
  expenses: ExpenseInput[]
): Map<string, number> {
  const balances = new Map<string, number>();

  const add = (userId: string, delta: number) => {
    balances.set(userId, (balances.get(userId) ?? 0) + delta);
  };

  for (const expense of expenses) {
    for (const share of expense.shares) {
      // The person who paid is owed this share amount
      add(expense.payerId, +share.amount);
      // The person who owes reduces their balance
      add(share.userId,    -share.amount);
    }
  }

  return balances;
}

/**
 * Convenience function: takes expenses, returns simplified transactions.
 */
export function getSimplifiedDebts(
  expenses: ExpenseInput[]
): Transaction[] {
  const balances = computeBalances(expenses);
  return simplifyDebts(balances);
}