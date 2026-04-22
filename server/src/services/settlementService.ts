import prisma from "../lib/prisma";
import { calculateGroupBalances } from "./balanceService";

export class SettlementValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export interface RecordSettlementInput {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export async function createSettlement(input: RecordSettlementInput) {
  const { groupId, fromUserId, toUserId, amount } = input;

  if (fromUserId === toUserId) {
    throw new SettlementValidationError("Cannot settle with the same user", 400);
  }

  if (amount <= 0) {
    throw new SettlementValidationError("Amount must be greater than 0", 400);
  }

  const members = await prisma.groupMember.findMany({
    where: {
      groupId,
      userId: { in: [fromUserId, toUserId] },
    },
    select: { userId: true },
  });

  if (members.length !== 2) {
    throw new SettlementValidationError("Both users must exist in the group", 400);
  }

  const balanceResult = await calculateGroupBalances(groupId);
  const debt =
    balanceResult.simplifiedSettlements.find(
      (settlement) =>
        settlement.from.id === fromUserId && settlement.to.id === toUserId
    )?.amount ?? 0;

  if (debt <= 0) {
    throw new SettlementValidationError("No outstanding debt between these users", 400);
  }

  const previousSettlements = await prisma.settlement.findMany({
    where: { groupId, fromUserId, toUserId },
    select: { amount: true },
  });

  const alreadySettled = round2(
    previousSettlements.reduce(
      (sum: number, settlement: { amount: number }) => sum + Number(settlement.amount),
      0
    )
  );

  const remaining = round2(debt - alreadySettled);

  if (remaining <= 0) {
    throw new SettlementValidationError("Debt already settled", 400);
  }

  if (amount > remaining + 0.001) {
    throw new SettlementValidationError(
      `Cannot settle more than owed. Remaining amount: ${remaining}`,
      400
    );
  }

  return prisma.settlement.create({
    data: {
      groupId,
      fromUserId,
      toUserId,
      amount: round2(amount),
    },
  });
}
