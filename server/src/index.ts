import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import groupRoutes from "./routes/groups";
import settlementRoutes from "./routes/settlements";
import userRoutes from "./routes/users";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/settlements", settlementRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});