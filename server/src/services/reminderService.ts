import prisma from "../lib/prisma";
import { calculateGroupBalances } from "./balanceService";

export interface SimulatedReminder {
  groupId: string;
  groupName: string;
  toUser: {
    id: string;
    name: string;
    email: string;
  };
  amountOwed: number;
  message: string;
  sentAt: string;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function simulatePendingDebtReminders(
  requesterUserId: string,
  groupId?: string
): Promise<SimulatedReminder[]> {
  const memberships = await prisma.groupMember.findMany({
    where: groupId
      ? {
          groupId,
          userId: requesterUserId,
        }
      : {
          userId: requesterUserId,
        },
    include: {
      group: {
        select: { id: true, name: true },
      },
    },
  });

  const reminders: SimulatedReminder[] = [];

  for (const membership of memberships as { groupId: string; group: { id: string; name: string } }[]) {
    const balances = await calculateGroupBalances(membership.groupId);

    for (const balance of balances.balances) {
      if (balance.netBalance >= 0) {
        continue;
      }

      reminders.push({
        groupId: membership.group.id,
        groupName: membership.group.name,
        toUser: balance.user,
        amountOwed: round2(Math.abs(balance.netBalance)),
        message: `Reminder: You owe $${round2(Math.abs(balance.netBalance))} in ${membership.group.name}`,
        sentAt: new Date().toISOString(),
      });
    }
  }

  return reminders;
}
