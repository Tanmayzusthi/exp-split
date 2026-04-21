import { Response } from "express";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/authenticate";
import { z } from "zod";

const CreateGroupSchema = z.object({
  name:        z.string().min(1),
  description: z.string().optional(),
  memberIds:   z.array(z.string()).optional(), // other userIds to add
});

export async function createGroup(req: AuthRequest, res: Response) {
  const parsed = CreateGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { name, description, memberIds = [] } = parsed.data;
  const userId = req.userId!;

  const group = await prisma.group.create({
    data: {
      name,
      description,
      createdById: userId,
      members: {
        create: [
          { userId, role: "ADMIN" },
          ...memberIds.map((id) => ({ userId: id, role: "MEMBER" as const })),
        ],
      },
    },
    include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

  res.status(201).json(group);
}

export async function getMyGroups(req: AuthRequest, res: Response) {
  const userId = req.userId!;

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count:  { select: { expenses: true } },
    },
  });

  res.json(groups);
}

export async function getGroupById(req: AuthRequest, res: Response) {
  const { id } = req.params;
  const userId = req.userId!;

  const group = await prisma.group.findFirst({
    where: { id, members: { some: { userId } } },
    include: {
      members:  { include: { user: { select: { id: true, name: true, email: true } } } },
      expenses: { include: { shares: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!group) {
    res.status(404).json({ error: "Group not found" });
    return;
  }

  res.json(group);
}