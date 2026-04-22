import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { calculateGroupBalances } from "../services/balanceService";

export async function getUserBalances(req: AuthRequest, res: Response) {
  const requestedUserId = String(req.params.userId);
  const authUserId = req.userId;

  if (!authUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (authUserId !== requestedUserId) {
    res.status(403).json({ error: "You can only view your own balances" });
    return;
  }

  try {
    const memberships = await prisma.groupMember.findMany({
      where: { userId: requestedUserId },
      include: {
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const balancesByGroup = await Promise.all(
      memberships.map(async (membership: { groupId: string; group: { id: string; name: string } }) => {
        const groupBalances = await calculateGroupBalances(membership.groupId);
        const userBalance = groupBalances.balances.find(
          (balance) => balance.user.id === requestedUserId
        );

        const net = Number(userBalance?.netBalance ?? 0);

        return {
          group: membership.group,
          oweAmount: net < 0 ? Math.abs(net) : 0,
          owedAmount: net > 0 ? net : 0,
          netBalance: net,
        };
      })
    );

    const totals = balancesByGroup.reduce(
      (
        acc: { totalOweAmount: number; totalOwedAmount: number },
        item: { oweAmount: number; owedAmount: number }
      ) => {
        acc.totalOweAmount += item.oweAmount;
        acc.totalOwedAmount += item.owedAmount;
        return acc;
      },
      { totalOweAmount: 0, totalOwedAmount: 0 }
    );

    res.json({
      userId: requestedUserId,
      groups: balancesByGroup,
      ...totals,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user balances" });
  }
}
