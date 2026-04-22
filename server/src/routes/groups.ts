import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createGroup,
  getMyGroups,
  getGroupById,
  getGroupBalances,
  getGroupSummary,
  getGroupExpensesList,
} from "../controllers/groupController";

const router = Router();

router.use(authenticate);

// Create & list
router.post("/", createGroup);
router.get("/", getMyGroups);

// Specific routes FIRST
router.get("/:groupId/balances", getGroupBalances);
router.get("/:groupId/summary", getGroupSummary);
router.get("/:groupId/expenses", getGroupExpensesList);

// Generic route LAST
router.get("/:id", getGroupById);

export default router;