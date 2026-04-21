import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { getSimplifiedDebts } from "../services/debtSimplification";

export async function getSettlements(req: AuthRequest, res: Response) {
  const { groupId } = req.params;
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  const simplified = getSimplifiedDebts(
    expenses.map((e: any) => ({
      payerId: e.paidById,
      shares: e.shares.map((s: any) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  );

  const userIds = [...new Set(simplified.flatMap((t) => [t.from, t.to]))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

  const enriched = simplified.map((t) => ({
    from: userMap[t.from],
    to: userMap[t.to],
    amount: t.amount,
  }));

  res.json({ groupId, settlements: enriched });
}

export async function recordSettlement(req: AuthRequest, res: Response) {
  const { groupId } = req.params;
  const { toUserId, amount } = req.body;
  const fromUserId = req.userId;

  if (!fromUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const settlement = await prisma.settlement.create({
    data: { groupId, fromUserId, toUserId, amount },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
    },
  });

  res.status(201).json(settlement);
}
