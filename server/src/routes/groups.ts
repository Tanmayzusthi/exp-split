import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  createGroup,
  getMyGroups,
  getGroupById,
  getGroupBalances,
  getGroupSummary,
  getGroupExpensesList,
  getGroupAnalytics,
} from "../controllers/groupController";

const router = Router();

router.use(authenticate);
router.post("/", createGroup);
router.get("/", getMyGroups);
router.get("/:groupId/balances", getGroupBalances);
router.get("/:groupId/summary", getGroupSummary);
router.get("/:groupId/expenses", getGroupExpensesList);
router.get("/:groupId/analytics", getGroupAnalytics);
router.get("/:id", getGroupById);

export default router;
