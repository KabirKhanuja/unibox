import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "unibox-api" });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});