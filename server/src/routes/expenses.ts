import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { createExpense, getGroupExpenses } from "../controllers/expenseController";

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// Create expense
router.post("/", createExpense);

// Get all expenses for a group
router.get("/group/:groupId", getGroupExpenses);

export default router;