import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createExpense,
  getGroupExpenses,
} from "../controllers/expenseController";

const router = Router();

router.use(authenticate);
router.post("/", createExpense);
router.get("/group/:groupId", getGroupExpenses);

export default router;
