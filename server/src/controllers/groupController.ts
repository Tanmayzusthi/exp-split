// FULL FINAL getGroupExpensesList (KEEP THIS VERSION)
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
    res.status(403).json({ error: "Not a member of this group" });
    return;
  }

  // ✅ EXTRA VALIDATION (IMPORTANT)
  if (filterUserId) {
    const filteredMember = await prisma.groupMember.findFirst({
      where: { groupId, userId: filterUserId },
    });

    if (!filteredMember) {
      res.status(400).json({ error: "Filter user is not a member of this group" });
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

  try {
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

    res.json({
      groupId,
      filters: {
        userId: filterUserId ?? null,
        sortByDate: sort,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: expenses,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch group expenses" });
  }
}