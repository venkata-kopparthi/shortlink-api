import { DatabaseSync } from "node:sqlite";

export type Link = {
  code: string;
  url: string;
  createdAt: string;
  expiresAt: string | null;
};

export type ClickStats = {
  total: number;
  byDay: { day: string; clicks: number }[];
  topReferrers: { referrer: string; clicks: number }[];
};

/** Opens a SQLite database and creates the schema if it does not exist yet. */
export function openDatabase(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS links (
      code        TEXT PRIMARY KEY,
      url         TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      expires_at  TEXT
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT NOT NULL REFERENCES links(code) ON DELETE CASCADE,
      clicked_at  TEXT NOT NULL,
      referrer    TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_clicks_code ON clicks(code, clicked_at);
  `);
  return db;
}

type LinkRow = { code: string; url: string; created_at: string; expires_at: string | null };

const toLink = (row: LinkRow): Link => ({
  code: row.code,
  url: row.url,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
});

/** All SQL lives here, so routes only deal with plain objects. */
export function createLinkRepository(db: DatabaseSync) {
  const insertLink = db.prepare(
    "INSERT INTO links (code, url, created_at, expires_at) VALUES (?, ?, ?, ?)"
  );
  const selectLink = db.prepare("SELECT * FROM links WHERE code = ?");
  const deleteLink = db.prepare("DELETE FROM links WHERE code = ?");
  const insertClick = db.prepare(
    "INSERT INTO clicks (code, clicked_at, referrer) VALUES (?, ?, ?)"
  );
  const countClicks = db.prepare("SELECT COUNT(*) AS total FROM clicks WHERE code = ?");
  const clicksByDay = db.prepare(`
    SELECT substr(clicked_at, 1, 10) AS day, COUNT(*) AS clicks
    FROM clicks WHERE code = ?
    GROUP BY day ORDER BY day
  `);
  const topReferrers = db.prepare(`
    SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*) AS clicks
    FROM clicks WHERE code = ?
    GROUP BY referrer ORDER BY clicks DESC LIMIT 5
  `);

  return {
    create(link: Link) {
      insertLink.run(link.code, link.url, link.createdAt, link.expiresAt);
      return link;
    },
    find(code: string): Link | null {
      const row = selectLink.get(code) as LinkRow | undefined;
      return row ? toLink(row) : null;
    },
    exists(code: string) {
      return selectLink.get(code) !== undefined;
    },
    remove(code: string) {
      return deleteLink.run(code).changes > 0;
    },
    recordClick(code: string, referrer: string | null, at = new Date()) {
      insertClick.run(code, at.toISOString(), referrer);
    },
    stats(code: string): ClickStats {
      const { total } = countClicks.get(code) as { total: number };
      return {
        total,
        byDay: clicksByDay.all(code) as ClickStats["byDay"],
        topReferrers: topReferrers.all(code) as ClickStats["topReferrers"],
      };
    },
  };
}

export type LinkRepository = ReturnType<typeof createLinkRepository>;
