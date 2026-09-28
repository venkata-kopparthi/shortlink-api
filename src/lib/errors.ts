import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // errors thrown by express.json()
  if (err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Request body is not valid JSON" });
    return;
  }
  if (err.type === "entity.too.large") {
    res.status(413).json({ error: "Request body is too large (max 10 kB)" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Try again later." });
};
