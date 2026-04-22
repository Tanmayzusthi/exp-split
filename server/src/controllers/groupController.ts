import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";
import { calculateGroupBalances } from "../services/balanceService";

const CreateGroupSchema = z.object({
  name: z.string().min(1),
  memberIds: z.array(z.string()).optional(),
});

const GroupExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(["asc", "desc"]).default("desc"),
  userId: z.string().optional(),
});

// ✅ CREATE GROUP
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
  });

  res.status(201).json(group);
}

// ✅ GET MY GROUPS
export async function getMyGroups(req: AuthRequest, res: Response) {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
  });

  res.json(groups);
}

// ✅ GET GROUP BY ID
export async function getGroupById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId } } },
  });

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(group);
}

// ✅ BALANCES
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
    res.status(403).json({ error: "Not a member" });
    return;
  }

  const balances = await calculateGroupBalances(groupId);
  res.json(balances);
}

// ✅ SUMMARY
export async function getGroupSummary(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);

  const totalExpenses = await prisma.expense.aggregate({
    where: { groupId },
    _sum: { amount: true },
  });

  res.json({
    totalExpenses: totalExpenses._sum.amount ?? 0,
  });
}

// ✅ EXPENSE LIST (PAGINATION + FILTER)
export async function getGroupExpensesList(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;
  const parsedQuery = GroupExpensesQuerySchema.safeParse(req.query);

  if (!parsedQuery.success) {
    res.status(400).json({ error: parsedQuery.error.flatten() });
    return;
  }

  const { page, limit, sort, userId: filterUserId } = parsedQuery.data;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) {
    res.status(403).json({ error: "Not a member" });
    return;
  }

  if (filterUserId) {
    const exists = await prisma.groupMember.findFirst({
      where: { groupId, userId: filterUserId },
    });

    if (!exists) {
      res.status(400).json({ error: "Invalid filter user" });
      return;
    }
  }

  const whereClause = filterUserId
    ? {
        groupId,
        OR: [
          { paidById: filterUserId },
          { shares: { some: { userId: filterUserId } } },
        ],
      }
    : { groupId };

  const [total, expenses] = await Promise.all([
    prisma.expense.count({ where: whereClause }),
    prisma.expense.findMany({
      where: whereClause,
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({
    page,
    total,
    data: expenses,
  });
}