import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "../db/client.js";

const { platformSettings } = schema;

/** Global kill switch — one row, id "global". Checked by the reward agent before every payout. */
export async function isPlatformPaused(): Promise<boolean> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.id, "global") });
  return row?.paused ?? false;
}

export async function adminRoutes(app: FastifyInstance) {
  app.get("/admin/kill-switch", async () => ({ paused: await isPlatformPaused() }));

  app.post("/admin/kill-switch", async (req) => {
    const { paused } = z.object({ paused: z.boolean() }).parse(req.body);
    await db
      .insert(platformSettings)
      .values({ id: "global", paused })
      .onConflictDoUpdate({ target: platformSettings.id, set: { paused } });
    return { paused };
  });
}
