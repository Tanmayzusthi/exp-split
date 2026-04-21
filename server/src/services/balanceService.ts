import prisma from "../lib/prisma";
import {
  computeBalances,
  simplifyDebts,
  type ExpenseInput,
  type Transaction,
} from "./debtSimplification";

interface UserSummary {
  id: string;
  name: string;
  email: string;
}

interface UserBalance {
  user: UserSummary;
  netBalance: number;
}

interface BalanceTransaction {
  from: UserSummary;
  to: UserSummary;
  amount: number;
}

export interface GroupBalanceResult {
  groupId: string;
  balances: UserBalance[];
  simplifiedSettlements: BalanceTransaction[];
  // Kept for backward compatibility with clients already using `transactions`
  transactions: BalanceTransaction[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const unknownUser = (id: string): UserSummary => ({ id, name: "Unknown", email: "" });

function formatSettlements(
  settlements: Transaction[],
  userMap: Map<string, UserSummary>
): BalanceTransaction[] {
  return settlements.map((transaction) => ({
    from: userMap.get(transaction.from) ?? unknownUser(transaction.from),
    to: userMap.get(transaction.to) ?? unknownUser(transaction.to),
    amount: round2(transaction.amount),
  }));
}

export async function calculateGroupBalances(
  groupId: string
): Promise<GroupBalanceResult> {
  const [members, expenses] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { groupId },
      include: {
        shares: {
          select: {
            userId: true,
            amount: true,
          },
        },
      },
    }),
  ]);

  const userMap = new Map<string, UserSummary>(
    members.map((member: { user: UserSummary }) => [member.user.id, member.user])
  );

  const expenseInputs: ExpenseInput[] = expenses.map(
    (expense: { paidById: string; shares: { userId: string; amount: number }[] }) => ({
      payerId: String(expense.paidById),
      shares: expense.shares.map((share: { userId: string; amount: number }) => ({
        userId: share.userId,
        amount: Number(share.amount),
      })),
    })
  );

  const computedBalances = computeBalances(expenseInputs);

  // Ensure every current member appears in balances even if balance is zero.
  for (const memberId of userMap.keys()) {
    if (!computedBalances.has(memberId)) {
      computedBalances.set(memberId, 0);
    }
  }

  const simplified = simplifyDebts(computedBalances);

  const balances: UserBalance[] = Array.from(computedBalances.entries()).map(
    ([userId, net]) => ({
      user: userMap.get(userId) ?? unknownUser(userId),
      netBalance: round2(net),
    })
  );

  const simplifiedSettlements = formatSettlements(simplified, userMap);

  return {
    groupId,
    balances,
    simplifiedSettlements,
    // Alias to avoid breaking existing API consumers.
    transactions: simplifiedSettlements,
  };
}
