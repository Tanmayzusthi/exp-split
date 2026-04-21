import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSettlements,
  recordSettlement,
} from "../controllers/settlementController";

const router = Router();

router.use(authenticate);

// POST settlement (groupId in body)
router.post("/", recordSettlement);

// GET settlements for group
router.get("/:groupId", getSettlements);

export default router;