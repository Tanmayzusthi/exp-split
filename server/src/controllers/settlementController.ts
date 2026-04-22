import { Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { getSimplifiedDebts } from "../services/debtSimplification";
import {
  createSettlement,
  SettlementValidationError,
} from "../services/settlementService";

const CreateSettlementSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: z.number().positive(),
  groupId: z.string().min(1),
});

export async function getSettlements(req: AuthRequest, res: Response) {
  const { groupId } = req.params;
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this group" });
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  const simplified = getSimplifiedDebts(
    expenses.map((e: any) => ({
      payerId: e.paidById,
      shares: e.shares.map((s: any) => ({
        userId: s.userId,
        amount: Number(s.amount),
      })),
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

  return res.json({ groupId, settlements: enriched });
}

export async function recordSettlement(req: AuthRequest, res: Response) {
  const parsed = CreateSettlementSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const authUserId = req.userId;

  if (!authUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { fromUserId, toUserId, amount, groupId } = parsed.data;

  if (fromUserId !== authUserId) {
    return res.status(403).json({
      error: "You can only record settlements from your account",
    });
  }

  try {
    const settlement = await createSettlement({
      fromUserId,
      toUserId,
      amount,
      groupId,
    });

    return res.status(201).json(settlement);
  } catch (error) {
    if (error instanceof SettlementValidationError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error(error);
    return res.status(500).json({ error: "Failed to record settlement" });
  }
}