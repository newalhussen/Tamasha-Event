import { createApp } from "./app";
import { env } from "./config/env";
import { db } from "./db/prisma";

const server = createApp().listen(env.port, () => {
  console.log(`Tamasha API listening on http://localhost:${env.port}/api`);
});

async function shutdown() {
  server.close();
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
