import { Response } from "express";
import prisma from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { z } from "zod";

const CreateExpenseSchema = z.object({
  groupId: z.string(),
  description: z.string().min(1),
  amount: z.number().positive(),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE"]).default("EQUAL"),
  shares: z
    .array(
      z.object({
        userId: z.string(),
        amount: z.number().nonnegative(),
      })
    )
    .optional(),
});

export async function createExpense(req: AuthRequest, res: Response) {
  const parsed = CreateExpenseSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  const { groupId, description, amount, splitType, shares } = parsed.data;
  const payerId = req.userId;

  if (!payerId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get members
    const members = await prisma.groupMember.findMany({
      where: { groupId },
    });

    if (members.length === 0) {
      return res.status(400).json({ error: "Group has no members" });
    }

    const memberIds = new Set(members.map((m) => m.userId));

    if (!memberIds.has(payerId)) {
      return res.status(403).json({ error: "Not a member of this group" });
    }

    let finalShares: { userId: string; amount: number }[];

    // ===== EQUAL SPLIT (CORRECT) =====
    if (splitType === "EQUAL" || !shares) {
      const totalMembers = members.length;

      const base = Math.floor((amount / totalMembers) * 100) / 100;
      let remainder = Math.round((amount - base * totalMembers) * 100) / 100;

      finalShares = members.map((m) => {
        let share = base;

        if (remainder > 0) {
          share += 0.01;
          remainder -= 0.01;
        }

        return { userId: m.userId, amount: share };
      });
    }

    // ===== EXACT SPLIT =====
    else if (splitType === "EXACT") {
      const total = shares.reduce((sum, s) => sum + s.amount, 0);

      if (Math.abs(total - amount) > 0.01) {
        return res.status(400).json({
          error: "Exact shares must sum to total amount",
        });
      }

      finalShares = shares;
    }

    // ===== PERCENTAGE SPLIT =====
    else {
      const totalPercent = shares.reduce((sum, s) => sum + s.amount, 0);

      if (Math.abs(totalPercent - 100) > 0.01) {
        return res.status(400).json({
          error: "Percentages must sum to 100",
        });
      }

      finalShares = shares.map((s) => ({
        userId: s.userId,
        amount: Math.round(((s.amount / 100) * amount) * 100) / 100,
      }));
    }

    // Validate users
    for (const share of finalShares) {
      if (!memberIds.has(share.userId)) {
        return res.status(400).json({
          error: `User ${share.userId} not in group`,
        });
      }
    }

    // Create expense (transaction safe)
    const expense = await prisma.$transaction(async (tx) => {
      return tx.expense.create({
        data: {
          groupId,
          paidById: payerId,
          description,
          amount,
          splits: {
            create: finalShares,
          },
        },
        include: {
          splits: true,
          paidBy: {
            select: { id: true, name: true },
          },
        },
      });
    });

    return res.status(201).json(expense);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
}