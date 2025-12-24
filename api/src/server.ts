import express from "express";
import dotenv from "dotenv";
dotenv.config();

import gmailRoutes from "./routes/gmail";


const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// gmail route
app.use(gmailRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "unibox-api" });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});