import prisma from "../lib/prisma";
import { simplifyDebts, type Transaction } from "./debtSimplification";

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
  transactions: BalanceTransaction[];
}

const round2 = (value: number) => Math.round(value * 100) / 100;

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

  const balances = new Map<string, number>();
  for (const userId of userMap.keys()) {
    balances.set(userId, 0);
  }

  for (const expense of expenses) {
    const payerId = expense.paidById as string;

    if (!balances.has(payerId)) {
      balances.set(payerId, 0);
    }

    for (const share of expense.shares as { userId: string; amount: number }[]) {
      balances.set(payerId, (balances.get(payerId) ?? 0) + Number(share.amount));
      balances.set(
        share.userId,
        (balances.get(share.userId) ?? 0) - Number(share.amount)
      );
    }
  }

  const optimizedTransactions: Transaction[] = simplifyDebts(balances);

  const resultBalances: UserBalance[] = Array.from(balances.entries()).map(
    ([userId, net]) => ({
      user: userMap.get(userId) ?? { id: userId, name: "Unknown", email: "" },
      netBalance: round2(net),
    })
  );

  const resultTransactions: BalanceTransaction[] = optimizedTransactions.map(
    (transaction) => ({
      from: userMap.get(transaction.from) ?? {
        id: transaction.from,
        name: "Unknown",
        email: "",
      },
      to: userMap.get(transaction.to) ?? {
        id: transaction.to,
        name: "Unknown",
        email: "",
      },
      amount: round2(transaction.amount),
    })
  );

  return {
    groupId,
    balances: resultBalances,
    transactions: resultTransactions,
  };
}
