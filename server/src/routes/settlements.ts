import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSettlements,
  recordSettlement,
} from "../controllers/settlementController";

const router = Router();

router.use(authenticate);
router.get("/:groupId", getSettlements);
router.post("/:groupId", recordSettlement);

export default router;
