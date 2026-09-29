import { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { Link, LinkRepository } from "../db.js";
import { generateCode } from "../lib/code.js";
import { HttpError } from "../lib/errors.js";

const RESERVED = new Set(["api", "health"]);

const createLinkSchema = z.object({
  url: z.url({ protocol: /^https?$/, message: "Enter a full http or https URL" }),
  alias: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{3,32}$/, "Use 3-32 letters, numbers, - or _")
    .refine((a) => !RESERVED.has(a.toLowerCase()), "This alias is reserved")
    .optional(),
  expiresAt: z.iso.datetime({ offset: true }).optional(),
});

/** Write routes need the API key when one is configured. */
export function requireApiKey(apiKey?: string): RequestHandler {
  return (req, _res, next) => {
    if (!apiKey || req.header("x-api-key") === apiKey) return next();
    next(new HttpError(401, "Missing or invalid API key"));
  };
}

export function linksRouter(repo: LinkRepository, options: { apiKey?: string; baseUrl: string }) {
  const router = Router();
  const auth = requireApiKey(options.apiKey);

  const findOr404 = (code: string): Link => {
    const link = findLink(repo, code);
    if (!link) throw new HttpError(404, `No link found for "${code}"`);
    return link;
  };

  const present = (link: Link) => ({ ...link, shortUrl: `${options.baseUrl}/${link.code}` });

  router.post("/", auth, (req, res) => {
    const input = createLinkSchema.parse(req.body);
    if (input.expiresAt && new Date(input.expiresAt) <= new Date()) {
      throw new HttpError(400, "expiresAt must be in the future");
    }

    let code = input.alias?.toLowerCase();
    if (code) {
      if (repo.exists(code)) throw new HttpError(409, `The alias "${code}" is already taken`);
    } else {
      do code = generateCode();
      while (repo.exists(code));
    }

    const link = repo.create({
      code,
      url: input.url,
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt ?? null,
    });
    res.status(201).json(present(link));
  });

  router.get("/:code", (req, res) => {
    res.json(present(findOr404(req.params.code)));
  });

  router.get("/:code/stats", (req, res) => {
    const link = findOr404(req.params.code);
    res.json({ code: link.code, ...repo.stats(link.code) });
  });

  router.delete("/:code", auth, (req, res) => {
    if (!repo.remove(req.params.code)) {
      throw new HttpError(404, `No link found for "${req.params.code}"`);
    }
    res.status(204).end();
  });

  return router;
}

// Custom aliases are stored lowercase, so /Promo and /promo both work.
// Generated codes stay case-sensitive, hence the exact match first.
function findLink(repo: LinkRepository, code: string) {
  return repo.find(code) ?? repo.find(code.toLowerCase());
}

/** GET /:code sends the visitor on to the original URL and records the click. */
export function redirectHandler(repo: LinkRepository): RequestHandler {
  return (req, res) => {
    const code = req.params.code as string;
    const link = findLink(repo, code);
    if (!link) throw new HttpError(404, `No link found for "${code}"`);
    if (link.expiresAt && new Date(link.expiresAt) <= new Date()) {
      throw new HttpError(410, "This link has expired");
    }
    repo.recordClick(link.code, req.get("referer") ?? null);
    res.redirect(302, link.url);
  };
}
