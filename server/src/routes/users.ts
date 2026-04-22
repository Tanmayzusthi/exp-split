import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { getUserBalances } from "../controllers/userController";

const router = Router();

router.use(authenticate);
router.get("/:userId/balances", getUserBalances);

export default router;
