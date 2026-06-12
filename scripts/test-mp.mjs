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

// move Bob and confirm Alice sees the new position
await bob.evaluate(() => {
  window.__teleport.x = 10;
  window.__teleport.z = -10;
  window.__teleport.pending = true;
});
await alice.waitForTimeout(4000);
const aliceSees2 = await alice.evaluate(() =>
  window.__ghosts.map((g) => ({ name: g.name, x: Math.round(g.tx), z: Math.round(g.tz) }))
);
console.log("After Bob moved, Alice sees:", JSON.stringify(aliceSees2));

await alice.screenshot({ path: "/tmp/ww-mp-alice.png" });
await browser.close();
