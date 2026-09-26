import { buildApp } from "./app.js";

const app = await buildApp();
try {
  await app.listen({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3001),
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
