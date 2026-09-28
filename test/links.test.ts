import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const newApp = (opts = {}) => createApp({ baseUrl: "https://sho.rt", ...opts });

describe("POST /api/links", () => {
  it("creates a link with a generated code", async () => {
    const res = await request(newApp())
      .post("/api/links")
      .send({ url: "https://example.com/some/long/path" })
      .expect(201);

    expect(res.body.code).toMatch(/^[a-zA-Z0-9]{7}$/);
    expect(res.body.shortUrl).toBe(`https://sho.rt/${res.body.code}`);
    expect(res.body.url).toBe("https://example.com/some/long/path");
  });

  it("uses a custom alias and rejects duplicates", async () => {
    const app = newApp();
    await request(app).post("/api/links").send({ url: "https://a.com", alias: "launch" }).expect(201);
    const res = await request(app)
      .post("/api/links")
      .send({ url: "https://b.com", alias: "launch" })
      .expect(409);
    expect(res.body.error).toContain("already taken");
  });

  it("rejects invalid URLs with a field-level message", async () => {
    const res = await request(newApp())
      .post("/api/links")
      .send({ url: "javascript:alert(1)" })
      .expect(400);
    expect(res.body.details[0].field).toBe("url");
  });

  it("rejects reserved aliases and past expiry dates", async () => {
    const app = newApp();
    await request(app).post("/api/links").send({ url: "https://a.com", alias: "api" }).expect(400);
    await request(app)
      .post("/api/links")
      .send({ url: "https://a.com", expiresAt: "2000-01-01T00:00:00Z" })
      .expect(400);
  });

  it("returns 400 for malformed JSON and 413 for oversized bodies", async () => {
    const app = newApp();
    const bad = await request(app)
      .post("/api/links")
      .set("Content-Type", "application/json")
      .send('{"url": ')
      .expect(400);
    expect(bad.body.error).toBe("Request body is not valid JSON");

    await request(app)
      .post("/api/links")
      .send({ url: "https://a.com/" + "x".repeat(20_000) })
      .expect(413);
  });

  it("requires the API key when one is configured", async () => {
    const app = newApp({ apiKey: "secret" });
    await request(app).post("/api/links").send({ url: "https://a.com" }).expect(401);
    await request(app)
      .post("/api/links")
      .set("x-api-key", "secret")
      .send({ url: "https://a.com" })
      .expect(201);
  });

  it("rate-limits writes", async () => {
    const app = newApp({ writeLimit: 2 });
    await request(app).post("/api/links").send({ url: "https://a.com" }).expect(201);
    await request(app).post("/api/links").send({ url: "https://a.com" }).expect(201);
    await request(app).post("/api/links").send({ url: "https://a.com" }).expect(429);
  });
});

describe("redirects and stats", () => {
  it("redirects, records clicks and reports stats", async () => {
    const app = newApp();
    await request(app).post("/api/links").send({ url: "https://example.com", alias: "docs" });

    const hit = await request(app).get("/docs").set("Referer", "https://news.site").expect(302);
    expect(hit.headers.location).toBe("https://example.com");
    await request(app).get("/docs").expect(302);

    const stats = await request(app).get("/api/links/docs/stats").expect(200);
    expect(stats.body.total).toBe(2);
    expect(stats.body.byDay).toHaveLength(1);
    expect(stats.body.topReferrers).toEqual(
      expect.arrayContaining([
        { referrer: "https://news.site", clicks: 1 },
        { referrer: "direct", clicks: 1 },
      ])
    );
  });

  it("returns 404 for unknown codes and 410 for expired links", async () => {
    const app = newApp();
    await request(app).get("/nope123").expect(404);

    const soon = new Date(Date.now() + 50).toISOString();
    await request(app).post("/api/links").send({ url: "https://a.com", alias: "flash", expiresAt: soon });
    await new Promise((r) => setTimeout(r, 80));
    await request(app).get("/flash").expect(410);
  });

  it("deletes a link and its clicks", async () => {
    const app = newApp();
    await request(app).post("/api/links").send({ url: "https://a.com", alias: "temp" });
    await request(app).get("/temp");
    await request(app).delete("/api/links/temp").expect(204);
    await request(app).get("/api/links/temp").expect(404);
    await request(app).delete("/api/links/temp").expect(404);
  });
});
