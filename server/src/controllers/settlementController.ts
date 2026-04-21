import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/authenticate";
import { getSimplifiedDebts } from "../services/debtSimplification";

export async function getSettlements(req: AuthRequest, res: Response) {
  const { groupId } = req.params;
  const userId = req.userId!;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!membership) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  // Fetch all unsettled expenses with their shares
  const expenses = await prisma.expense.findMany({
    where:   { groupId, settled: false },
    include: { shares: true },
  });

  // Feed into your algorithm
  const simplified = getSimplifiedDebts(
    expenses.map((e) => ({
      payerId: e.payerId,
      shares:  e.shares.map((s) => ({ userId: s.userId, amount: Number(s.amount) })),
    }))
  );

  // Enrich with user names
  const userIds = [...new Set(simplified.flatMap((t) => [t.from, t.to]))];
  const users   = await prisma.user.findMany({
    where:  { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const enriched = simplified.map((t) => ({
    from:   userMap[t.from],
    to:     userMap[t.to],
    amount: t.amount,
  }));

  res.json({ groupId, settlements: enriched });
}

export async function recordSettlement(req: AuthRequest, res: Response) {
  const { groupId } = req.params;
  const { toUserId, amount } = req.body;
  const fromUserId = req.userId!;

  const settlement = await prisma.settlement.create({
    data: { groupId, fromUserId, toUserId, amount },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser:   { select: { id: true, name: true } },
    },
  });

  res.status(201).json(settlement);
}