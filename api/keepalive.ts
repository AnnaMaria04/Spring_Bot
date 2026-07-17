import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Hit daily by Vercel Cron (see vercel.json) purely to keep the Supabase
 * project active — free-tier Supabase projects auto-pause after about a
 * week with no database activity, which breaks the bot until someone
 * notices and manually restores it. A trivial query once a day is enough
 * to reset that clock.
 */
export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const { query } = await import("../src/db/client");
    await query("SELECT 1");
    res.status(200).json({ ok: true, pinged: new Date().toISOString() });
  } catch (err) {
    console.error("[keepalive] ping failed:", (err as Error).message);
    res.status(500).json({ ok: false, error: (err as Error).message });
  }
}
