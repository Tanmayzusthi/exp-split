import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { sendReminders } from "../controllers/reminderController";

const router = Router();

router.use(authenticate);
router.post("/send", sendReminders);

export default router;
