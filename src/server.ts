import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

const app = createApp({
  databasePath: process.env.DATABASE_PATH ?? "shortlink.db",
  apiKey: process.env.API_KEY,
  baseUrl: process.env.BASE_URL ?? `http://localhost:${port}`,
});

app.listen(port, () => {
  console.log(`shortlink-api listening on http://localhost:${port}`);
});
