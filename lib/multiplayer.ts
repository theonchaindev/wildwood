"use client";

// Real-time presence: posts our position ~1×/s and keeps a mutable roster of
// the other players in the forest. Their movement is interpolated client-side
// so they glide rather than teleport between updates.

import { useGame } from "./store";
import { live } from "./runtime";

export type GhostLook = {
  appearance?: { skin: number; hair: string; hairColor: number; beard: boolean; accessory: string };
  shirt?: string;
  hat?: string | null;
};

export type Sample = { x: number; z: number; rot: number; t: number };

export type Ghost = {
  id: string;
  name: string;
  level: number;
  lookStr: string;
  look: GhostLook;
  samples: Sample[]; // recent network positions, rendered ~1s in the past
  // interpolated current position (owned by the render loop)
  cx: number;
  cz: number;
  crot: number;
};

/** How far in the past remote players are rendered — buys smoothness. */
export const RENDER_DELAY_MS = 1_000;

function lerpAngle(a: number, b: number, k: number) {
  const d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

/** Position at `rt`, interpolated between buffered samples. */
export function sampleAt(samples: Sample[], rt: number): Sample {
  if (samples.length === 1 || rt <= samples[0].t) return samples[0];
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i];
    const b = samples[i + 1];
    if (rt <= b.t) {
      if (Math.hypot(b.x - a.x, b.z - a.z) > 25) return b; // gate travel: snap
      const k = (rt - a.t) / Math.max(1, b.t - a.t);
      return {
        x: a.x + (b.x - a.x) * k,
        z: a.z + (b.z - a.z) * k,
        rot: lerpAngle(a.rot, b.rot, k),
        t: rt,
      };
    }
  }
  return samples[samples.length - 1];
}

export const ghosts: Ghost[] = [];

let listeners: (() => void)[] = [];
export function onGhostsChange(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function notify() {
  for (const l of listeners) l();
}

function clientId() {
  let id = localStorage.getItem("ww-client-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ww-client-id", id);
  }
  return id;
}

let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

async function sync() {
  if (inFlight) return;
  const s = useGame.getState();
  if (!s.started) return;
  inFlight = true;
  try {
    const res = await fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: clientId(),
        name: s.name,
        x: live.x,
        z: live.z,
        rot: live.rot,
        location: s.location === "forest" ? "forest" : "away",
        level: s.level,
        acorns: Math.floor(s.acorns),
        homeTier: s.homeTier,
        houseLevel: s.houseLevel,
        look: JSON.stringify({ appearance: s.appearance, shirt: s.shirt, hat: s.hat }),
      }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.players) return;

    const seen = new Set<string>();
    let changed = false;
    const now = Date.now();
    for (const p of data.players as any[]) {
      seen.add(p.id);
      const sample: Sample = { x: p.x, z: p.z, rot: p.rot, t: now };
      const existing = ghosts.find((g) => g.id === p.id);
      if (existing) {
        existing.samples.push(sample);
        if (existing.samples.length > 6) existing.samples.shift();
        existing.name = p.name;
        existing.level = p.level;
        if (existing.lookStr !== p.look) {
          existing.lookStr = p.look;
          try { existing.look = JSON.parse(p.look); } catch { existing.look = {}; }
          changed = true;
        }
      } else {
        let look: GhostLook = {};
        try { look = JSON.parse(p.look); } catch {}
        ghosts.push({
          id: p.id, name: p.name, level: p.level,
          lookStr: p.look, look,
          samples: [sample],
          cx: p.x, cz: p.z, crot: p.rot,
        });
        changed = true;
      }
    }
    for (let i = ghosts.length - 1; i >= 0; i--) {
      if (!seen.has(ghosts[i].id)) {
        ghosts.splice(i, 1);
        changed = true;
      }
    }
    if (changed) notify();
  } catch {
    // offline / db not configured: just keep playing solo
  } finally {
    inFlight = false;
  }
}

/** Start the real-time presence loop (idempotent). */
export function startMultiplayer() {
  if (timer || typeof window === "undefined") return;
  sync();
  timer = setInterval(sync, 800);
}
