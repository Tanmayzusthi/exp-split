import { Response } from "express";
import { z } from "zod";
import { AuthRequest } from "../middleware/auth";
import { simulatePendingDebtReminders } from "../services/reminderService";

const SendRemindersSchema = z.object({
  groupId: z.string().optional(),
});

export async function sendReminders(req: AuthRequest, res: Response) {
  const userId = req.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = SendRemindersSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const reminders = await simulatePendingDebtReminders(userId, parsed.data.groupId);

    res.json({
      sent: reminders.length,
      notifications: reminders,
      simulated: true,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to send reminders" });
  }
}
