import { chromium } from "playwright";

const url = process.env.URL ?? "http://localhost:3777";
const out = process.env.OUT ?? "/tmp/wildwood.png";
const wait = Number(process.env.WAIT ?? 9000);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
page.on("console", (m) => {
  if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
await page.goto(url, { waitUntil: "networkidle" }).catch(() => {});
await page.waitForTimeout(wait);

// START=1 logs in through the intro screen (menu -> Play -> name -> customize -> enter)
if (process.env.START) {
  await page.waitForSelector(".intro-block.guest", { timeout: 30000 }).catch(() => {});
  await page.click(".intro-block.guest").catch(() => {}); // 🎮 Guest Mode
  await page.waitForTimeout(400);
  await page.fill(".login-input", process.env.NAME ?? "Tester").catch(() => {});
  await page.click(".intro-btn.primary").catch(() => {}); // Next — customize
  await page.waitForTimeout(400);
  await page.click(".intro-btn.primary").catch(() => {}); // Looks good — enter
  await page.waitForTimeout(800);
}

// optional scripted keyboard movement, e.g. KEYS="w:2000,d:1500"
if (process.env.KEYS) {
  for (const step of process.env.KEYS.split(",")) {
    const [key, ms] = step.split(":");
    await page.keyboard.down(key);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(600);
}

// optional clicks at screen coords, e.g. CLICKS="720,300|600,400" (waits between)
if (process.env.CLICKS) {
  for (const c of process.env.CLICKS.split("|")) {
    const [x, y] = c.split(",").map(Number);
    await page.mouse.click(x, y);
    await page.waitForTimeout(Number(process.env.CLICK_WAIT ?? 1500));
  }
}

// EVAL runs arbitrary JS in the page (window.__game / __live / __trees available)
if (process.env.EVAL) {
  const result = await page.evaluate(process.env.EVAL).catch((e) => `EVAL error: ${e}`);
  if (result !== undefined) console.log("[eval]", JSON.stringify(result));
}

if (process.env.ENDWAIT) await page.waitForTimeout(Number(process.env.ENDWAIT));

// EVAL2 runs after ENDWAIT (for inspecting end state)
if (process.env.EVAL2) {
  const result = await page.evaluate(process.env.EVAL2).catch((e) => `EVAL2 error: ${e}`);
  if (result !== undefined) console.log("[eval2]", JSON.stringify(result));
}

if (process.env.REPORT) {
  const report = await page.evaluate(() => {
    const s = window.__game?.getState();
    if (!s) return null;
    return {
      pos: { x: Math.round(window.__live.x), z: Math.round(window.__live.z) },
      level: s.level, xp: s.xp, acorns: s.acorns, axe: s.axe,
      inventory: s.inventory, zone: s.zone,
      quests: s.quests.map((q) => `${q.id}:${q.progress}/${q.goal}${q.done ? " ✓" : ""}`),
      choppedTrees: Object.keys(s.choppedAt).length,
    };
  }).catch(() => null);
  console.log("[report]", JSON.stringify(report, null, 1));
}

// CLIP="x,y,w,h" crops the screenshot
const clip = process.env.CLIP
  ? (() => { const [x, y, width, height] = process.env.CLIP.split(",").map(Number); return { x, y, width, height }; })()
  : undefined;
await page.screenshot({ path: out, clip });
await browser.close();
console.log("saved", out);
