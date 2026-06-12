// Two-player real-time test: two isolated browser contexts in the same world.
import { chromium } from "playwright";

const url = process.env.URL ?? "http://localhost:3777";
const browser = await chromium.launch();

async function startPlayer(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(9000);
  await page.waitForSelector(".intro-btn.primary", { timeout: 30000 });
  await page.click(".intro-btn.primary"); // Play
  await page.waitForTimeout(400);
  await page.fill(".login-input", name);
  await page.click(".intro-btn.primary"); // customize
  await page.waitForTimeout(400);
  await page.click(".intro-btn.primary"); // enter
  await page.waitForTimeout(1000);
  return page;
}

const alice = await startPlayer("AliceRT");
const bob = await startPlayer("BobRT");

// give the sync loops a few rounds
await alice.waitForTimeout(5000);

const aliceSees = await alice.evaluate(() =>
  window.__ghosts.map((g) => ({ name: g.name, x: Math.round(g.cx), z: Math.round(g.cz) }))
);
const bobSees = await bob.evaluate(() =>
  window.__ghosts.map((g) => ({ name: g.name, x: Math.round(g.cx), z: Math.round(g.cz) }))
);
console.log("Alice sees:", JSON.stringify(aliceSees));
console.log("Bob sees:", JSON.stringify(bobSees));

// Bob WALKS east; Alice samples his rendered position — smooth interpolation
// should give many small steps, not one big jump
await bob.evaluate(() => {
  window.__mt.x = 18;
  window.__mt.z = 0;
  window.__mt.active = true;
});
const track = [];
for (let i = 0; i < 16; i++) {
  await alice.waitForTimeout(400);
  const p = await alice.evaluate(() => {
    const g = window.__ghosts[0];
    return g ? { x: Math.round(g.cx * 10) / 10, z: Math.round(g.cz * 10) / 10 } : null;
  });
  if (p) track.push(p);
}
const steps = track.slice(1).map((p, i) => Math.hypot(p.x - track[i].x, p.z - track[i].z).toFixed(1));
console.log("Bob's rendered path on Alice's screen:", JSON.stringify(track.map((p) => p.x)));
console.log("step sizes:", steps.join(", "));
const big = steps.filter((s) => Number(s) > 5).length;
console.log(big === 0 ? "✓ smooth — no teleport-sized jumps" : `✗ ${big} jumpy steps`);

await alice.screenshot({ path: "/tmp/ww-mp-alice.png" });
await browser.close();
