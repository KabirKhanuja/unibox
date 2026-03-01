import express from "express";
import cors from "cors";
import { env } from "./config/env";

import gmailRoutes from "./routes/gmail";
import zohoRoutes from "./routes/zoho";
import outlookRoutes from "./routes/outlook";


const app = express();
const PORT = env.PORT;

//cors
app.use(
  cors({
    origin: env.WEB_BASE_URL, // http://localhost:3000
    credentials: true,
  })
);

app.use(express.json());

// routes
app.use(gmailRoutes);
app.use(zohoRoutes);
app.use(outlookRoutes);

// health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "auth-service" });
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
