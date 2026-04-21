import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { createGroup, getMyGroups, getGroupById } from "../controllers/groupController";

const router = Router();

router.use(authenticate);

router.post("/",    createGroup);
router.get("/",     getMyGroups);
router.get("/:id",  getGroupById);

export default router;