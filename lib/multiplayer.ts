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

export type Ghost = {
  id: string;
  name: string;
  level: number;
  lookStr: string;
  look: GhostLook;
  // network target
  tx: number;
  tz: number;
  trot: number;
  // interpolated current position (owned by the render loop)
  cx: number;
  cz: number;
  crot: number;
  lastUpdate: number;
};

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
        look: JSON.stringify({ appearance: s.appearance, shirt: s.shirt, hat: s.hat }),
      }),
    });
    if (!res.ok) return;
    const data = await res.json().catch(() => null);
    if (!data?.players) return;

    const seen = new Set<string>();
    let changed = false;
    for (const p of data.players as any[]) {
      seen.add(p.id);
      const existing = ghosts.find((g) => g.id === p.id);
      if (existing) {
        existing.tx = p.x;
        existing.tz = p.z;
        existing.trot = p.rot;
        existing.name = p.name;
        existing.level = p.level;
        existing.lastUpdate = Date.now();
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
          tx: p.x, tz: p.z, trot: p.rot,
          cx: p.x, cz: p.z, crot: p.rot,
          lastUpdate: Date.now(),
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
  timer = setInterval(sync, 1_100);
}
