import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { attachUser } from "./middleware/auth";
import { errorHandler, jsonOnly, notFoundHandler } from "./middleware/error";
import { api } from "./routes";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // The frontend proxies /api, so cookies are first-party. CORS is for deployments where the browser calls the API directly.
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use("/api", jsonOnly, attachUser, api);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
