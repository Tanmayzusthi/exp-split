import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes); // 🔥 ADD THIS

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});