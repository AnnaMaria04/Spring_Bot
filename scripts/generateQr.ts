import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { config } from "../src/config";
import { listActiveHouses } from "../src/services/houses";
import { getPool } from "../src/db/client";

/**
 * Generate a printable QR code per house. Each QR opens the bot with the
 * house preselected via the deep link https://t.me/<bot>?start=<code>.
 * Set PUBLIC_BOT_USERNAME in .env to your real bot username first.
 */
async function main(): Promise<void> {
  const outDir = join(process.cwd(), "qr-codes");
  mkdirSync(outDir, { recursive: true });

  const username = config.publicBotUsername;
  const houses = await listActiveHouses();
  if (houses.length === 0) {
    console.warn("No active houses found. Did you run the schema/seed?");
  }

  const lines: string[] = [];
  for (const house of houses) {
    const link = `https://t.me/${username}?start=${house.code}`;
    const file = join(outDir, `${house.code}.png`);
    await QRCode.toFile(file, link, { width: 800, margin: 2 });
    lines.push(`${house.name} (${house.code}): ${link}`);
    console.log(`QR ${house.code.padEnd(4)} -> ${file}`);
  }

  writeFileSync(join(outDir, "links.txt"), lines.join("\n") + "\n", "utf8");
  await getPool().end();
  console.log(`\n✅ Generated ${houses.length} QR codes in ${outDir}`);
  console.log("   Deep links saved to qr-codes/links.txt");
}

main().catch((err) => {
  console.error("QR generation failed:", err);
  process.exit(1);
});
