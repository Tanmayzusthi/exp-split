import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { calculateGroupBalances } from "../services/balanceService";

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string()).optional(),
});

export async function createGroup(req: AuthRequest, res: Response) {
  const parsed = CreateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, memberIds = [] } = parsed.data;
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const group = await prisma.group.create({
    data: {
      name,
      members: {
        create: [{ userId }, ...memberIds.map((id) => ({ userId: id }))],
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  res.status(201).json(group);
}

export async function getMyGroups(req: AuthRequest, res: Response) {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { expenses: true } },
    },
  });

  res.json(groups);
}

export async function getGroupById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      expenses: { include: { shares: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(group);
}

export async function getGroupBalances(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  try {
    const balances = await calculateGroupBalances(groupId);
    res.json(balances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to calculate balances" });
  }
}

export async function getGroupSummary(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) {
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  try {
    const [expenseAggregate, settlementAggregate, memberCount, recentExpenses, balances] =
      await Promise.all([
        prisma.expense.aggregate({
          where: { groupId },
          _sum: { amount: true },
        }),
        prisma.settlement.aggregate({
          where: { groupId },
          _sum: { amount: true },
        }),
        prisma.groupMember.count({ where: { groupId } }),
        prisma.expense.findMany({
          where: { groupId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: {
            paidBy: { select: { id: true, name: true, email: true } },
            shares: true,
          },
        }),
        calculateGroupBalances(groupId),
      ]);

    res.json({
      groupId,
      totalExpenses: expenseAggregate._sum.amount ?? 0,
      totalSettledAmount: settlementAggregate._sum.amount ?? 0,
      pendingBalances: balances.balances,
      memberCount,
      recentExpenses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch group summary" });
  }
}
