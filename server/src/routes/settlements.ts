import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSettlements,
  recordSettlement,
} from "../controllers/settlementController";

const router = Router();

router.use(authenticate);

// Create a settlement (groupId in body)
router.post("/", recordSettlement);

// Get settlements for a group
router.get("/:groupId", getSettlements);

export default router;