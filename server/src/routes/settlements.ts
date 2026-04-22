import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  getSettlements,
  recordSettlement,
} from "../controllers/settlementController";

const router = Router();

router.use(authenticate);
router.post("/", recordSettlement);
router.get("/:groupId", getSettlements);

export default router;
