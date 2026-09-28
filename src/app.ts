import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createLinkRepository, openDatabase } from "./db.js";
import { errorHandler, HttpError } from "./lib/errors.js";
import { linksRouter, redirectHandler } from "./routes/links.js";

export type AppOptions = {
  databasePath?: string;
  apiKey?: string;
  baseUrl?: string;
  /** Max write requests per IP per minute. */
  writeLimit?: number;
};

export function createApp(options: AppOptions = {}) {
  const repo = createLinkRepository(openDatabase(options.databasePath));
  const baseUrl = options.baseUrl ?? "http://localhost:3000";

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));

  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: options.writeLimit ?? 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "GET",
    message: { error: "Too many requests. Wait a minute and try again." },
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/links", writeLimiter, linksRouter(repo, { apiKey: options.apiKey, baseUrl }));
  app.get("/:code", redirectHandler(repo));

  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use(errorHandler);

  return app;
}
