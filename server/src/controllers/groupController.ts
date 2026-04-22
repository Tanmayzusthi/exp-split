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

// CREATE GROUP
export async function createGroup(req: AuthRequest, res: Response) {
  const parsed = CreateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, memberIds = [] } = parsed.data;
  const userId = req.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

// GET MY GROUPS
export async function getMyGroups(req: AuthRequest, res: Response) {
  const userId = req.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

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

// GET GROUP BY ID
export async function getGroupById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      expenses: { include: { shares: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!group) return res.status(404).json({ error: "Group not found" });

  res.json(group);
}

// BALANCES
export async function getGroupBalances(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) return res.status(403).json({ error: "Not a member" });

  const balances = await calculateGroupBalances(groupId);
  res.json(balances);
}

// SUMMARY
export async function getGroupSummary(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) return res.status(403).json({ error: "Not a member" });

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
}

// EXPENSE LIST
export async function getGroupExpensesList(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  const parsed = GroupExpensesQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { page, limit, sort, userId: filterUserId } = parsed.data;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) return res.status(403).json({ error: "Not a member" });

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
      include: {
        shares: true,
        paidBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: sort },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  res.json({ page, total, data: expenses });
}

// ANALYTICS
export async function getGroupAnalytics(req: AuthRequest, res: Response) {
  const groupId = String(req.params.groupId);
  const userId = req.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const membership = await prisma.groupMember.findFirst({
    where: { groupId, userId },
  });

  if (!membership) return res.status(403).json({ error: "Not a member" });

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    select: {
      amount: true,
      category: true,
      createdAt: true,
      paidById: true,
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });

  const categoryMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const spenderMap = new Map<string, any>();

  for (const e of expenses) {
    const amt = Number(e.amount);
    const cat = (e.category || "other").toLowerCase();
    const month = new Date(e.createdAt).toISOString().slice(0, 7);

    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + amt);
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + amt);

    if (spenderMap.has(e.paidById)) {
      spenderMap.get(e.paidById).amount += amt;
    } else {
      spenderMap.set(e.paidById, { user: e.paidBy, amount: amt });
    }
  }

  res.json({
    categoryBreakdown: Array.from(categoryMap),
    monthlySpending: Array.from(monthlyMap),
    topSpender: Array.from(spenderMap.values()).sort((a, b) => b.amount - a.amount)[0],
  });
}