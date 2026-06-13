"use client";

// Client helpers for accounts, cloud saves, visiting and player offers.

import { useGame, applyBaseReset } from "./store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init?: RequestInit, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch (e) {
    // network hiccup — retry
    if (attempt < 2) {
      await sleep(1200 * (attempt + 1));
      return api(path, init, attempt + 1);
    }
    throw e;
  }
  // the serverless database naps between visits; the first request after a
  // deploy can 500 while it wakes — retry instead of surfacing it
  if (res.status >= 500 && attempt < 2) {
    await sleep(1200 * (attempt + 1));
    return api(path, init, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error ?? `Request failed (${res.status})`);
  return data as T;
}

type AuthResponse = { name: string; save: any; pendingAcorns: number };

/** The slice of game state that gets synced to the cloud. */
export function saveData() {
  const s = useGame.getState();
  return {
    name: s.name,
    muted: s.muted,
    hp: s.hp,
    maxHp: s.maxHp,
    energy: s.energy,
    hunger: s.hunger,
    xp: s.xp,
    level: s.level,
    acorns: s.acorns,
    axe: s.axe,
    rod: s.rod,
    weapon: s.weapon,
    armor: s.armor,
    shirt: s.shirt,
    ownedAxes: s.ownedAxes,
    ownedWeapons: s.ownedWeapons,
    ownedArmor: s.ownedArmor,
    ownedShirts: s.ownedShirts,
    hat: s.hat,
    ownedHats: s.ownedHats,
    appearance: s.appearance,
    infected: s.infected,
    pickaxe: s.pickaxe,
    heldTorch: s.heldTorch,
    inventory: s.inventory,
    quests: s.quests,
    acceptedOffers: s.acceptedOffers,
    homeTier: s.homeTier,
    houseLevel: s.houseLevel,
    baseChest: s.baseChest,
    baseFurnace: s.baseFurnace,
    baseBench: s.baseBench,
    tilled: s.tilled,
    baseResetAck: s.baseResetAck,
    dailyDay: s.dailyDay,
    dailyBase: s.dailyBase,
    dailyClaimed: s.dailyClaimed,
    lastRentAt: s.lastRentAt,
    chest: s.chest,
    farm: s.farm,
    dog: s.dog,
    dogXp: s.dogXp,
    cat: s.cat,
    catLastPet: s.catLastPet,
    horse: s.horse,
    boat: s.boat,
    pens: s.pens,
    orchard: s.orchard,
    hives: s.hives,
    structures: s.structures,
    interiorDecor: s.interiorDecor,
    stats: s.stats,
    skills: s.skills,
    skillPoints: s.skillPoints,
    claimedAchievements: s.claimedAchievements,
  };
}

/** Roughly "how far along is this save" — used to pick the newer of two saves. */
function progressScore(s: { level?: number; xp?: number; acorns?: number; homeTier?: number }) {
  return (s.level ?? 1) * 1_000_000 + (s.homeTier ?? 0) * 10_000 + (s.xp ?? 0) * 10 + Math.min(9999, s.acorns ?? 0) / 1000;
}

function applyAuth(data: AuthResponse) {
  const s = useGame.getState();
  if (data.save) {
    // never let a stale cloud save clobber further-along local progress
    // (this is what used to reset levels after every update)
    const localScore = progressScore(s);
    const cloudScore = progressScore(data.save);
    if (localScore > cloudScore && s.level > 1) {
      useGame.setState({ name: data.name });
      s.addToast("💾 Kept your newer local progress — syncing it to the cloud");
      setTimeout(pushSave, 1500);
    } else {
      const save = { ...data.save };
      // back-fill owned-gear lists from older cloud saves
      if (!save.ownedWeapons) save.ownedWeapons = save.weapon ? [save.weapon] : [];
      if (!save.ownedAxes) save.ownedAxes = save.axe ? [save.axe] : [];
      if (!save.ownedArmor) save.ownedArmor = save.armor ? [save.armor] : [];
      const baseWiped = applyBaseReset(save); // one-time base wipe for this epoch
      if (baseWiped) {
        setTimeout(() => useGame.getState().setBanner("🏡 Bases have been reset — rebuild yours! (acorns refunded)"), 1500);
      }
      // existing base owners keep their built stations/soil
      if (save.homeTier >= 1 && save.baseChest === undefined) {
        save.baseChest = true; save.baseFurnace = true; save.baseBench = true;
        if (!save.houseLevel || save.houseLevel < 1) save.houseLevel = 1;
        save.tilled = save.tilled ?? {};
        const tiles = [6, 12, 18, 24, 30, 34, 38, 42, 45, 48][Math.min(save.homeTier, 10) - 1];
        for (let i = 0; i < tiles; i++) save.tilled[`home:${i}`] = true;
      } else if (!save.homeTier && save.baseChest === undefined) {
        save.houseLevel = 0;
      }
      useGame.setState({ ...save, name: data.name });
    }
  } else {
    useGame.setState({ name: data.name });
  }
  useGame.setState({ account: { name: data.name } });
  if (data.pendingAcorns > 0) {
    useGame.setState({ acorns: useGame.getState().acorns + data.pendingAcorns });
    s.addToast(`💰 Your offers sold while you were away: +${data.pendingAcorns} 🌰`);
  }
}

export async function registerCloud(name: string, password: string) {
  applyAuth(await api<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, password }),
  }));
}

export async function loginCloud(name: string, password: string) {
  applyAuth(await api<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, password }),
  }));
}

let lastSaveWarn = 0;
let restoringSave = false;

export async function pushSave() {
  if (!useGame.getState().account) return;
  try {
    const res = await api<{ ok: boolean; keptServer?: boolean }>("/api/save", {
      method: "PUT",
      body: JSON.stringify(saveData()),
    });
    // the server holds a higher-level save than this device — pull it back
    if (res.keptServer && !restoringSave) {
      restoringSave = true;
      try {
        const data = await api<AuthResponse>("/api/save");
        if (data.save && progressScore(data.save) > progressScore(useGame.getState())) {
          useGame.setState({ ...data.save, name: data.name });
          useGame.getState().addToast("💾 Restored your higher cloud save");
        }
      } finally {
        restoringSave = false;
      }
    }
  } catch {
    // a silent failure here is how progress used to get lost — say something
    if (Date.now() - lastSaveWarn > 60_000) {
      lastSaveWarn = Date.now();
      useGame.getState().addToast("⚠️ Cloud save failed — progress is only on this device right now");
    }
  }
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

/** Push the save to the cloud every 20s while logged in. */
export function startSaveSync() {
  if (syncTimer) return;
  syncTimer = setInterval(pushSave, 20_000);
  // big moments save straight away (level-ups, land deeds, house builds)
  window.addEventListener("ww-push-save", () => {
    pushSave();
  });
  window.addEventListener("beforeunload", () => {
    if (useGame.getState().account) {
      navigator.sendBeacon?.("/api/save", JSON.stringify(saveData()));
    }
  });
}

export type PlayerOffer = {
  id: string;
  sellerName: string;
  item: string;
  qty: number;
  price: number;
  mine: boolean;
};

export async function fetchOffers(): Promise<PlayerOffer[]> {
  const data = await api<{ offers: PlayerOffer[] }>("/api/offers");
  return data.offers;
}

export async function postOffer(item: string, qty: number, price: number) {
  // escrow: remove the items locally first, refund if the post fails
  const s = useGame.getState();
  if ((s.inventory[item] ?? 0) < qty) throw new Error(`You don't have ${qty} ${item}`);
  const inv = { ...s.inventory };
  if (inv[item] - qty <= 0) delete inv[item];
  else inv[item] -= qty;
  useGame.setState({ inventory: inv });
  try {
    await api("/api/offers", { method: "POST", body: JSON.stringify({ item, qty, price }) });
    s.addToast(`📋 Posted: ${qty} ${item} for ${price} 🌰`);
    pushSave();
  } catch (e) {
    useGame.getState().gainItem(item, qty); // refund
    throw e;
  }
}

export async function acceptPlayerOffer(offer: PlayerOffer) {
  const s = useGame.getState();
  if (s.acorns < offer.price) throw new Error("Not enough acorns");
  const data = await api<{ item: string; qty: number; price: number }>(
    `/api/offers/${offer.id}`,
    { method: "POST" }
  );
  useGame.setState({ acorns: useGame.getState().acorns - data.price });
  useGame.getState().gainItem(data.item, data.qty);
  s.addToast(`Bought ${data.qty} ${data.item} from ${offer.sellerName}`);
  pushSave();
}

export async function cancelPlayerOffer(offer: PlayerOffer) {
  const data = await api<{ item: string; qty: number }>(`/api/offers/${offer.id}`, {
    method: "DELETE",
  });
  useGame.getState().gainItem(data.item, data.qty);
  useGame.getState().addToast(`Offer cancelled · ${data.qty} ${data.item} returned`);
  pushSave();
}

// ---- Phantom wallet ----

function phantom() {
  const p = (window as any).phantom?.solana;
  if (!p?.isPhantom) throw new Error("Phantom wallet not found — install it from phantom.app");
  return p;
}

export async function connectWallet(): Promise<{ name: string; isNew: boolean }> {
  const provider = phantom();
  const { publicKey } = await provider.connect();
  const pubkey = publicKey.toBase58();
  const { nonce, token } = await api<{ nonce: string; token: string }>("/api/auth/wallet");
  const message = new TextEncoder().encode(`Wildwood login: ${nonce}`);
  const signed = await provider.signMessage(message, "utf8");
  const bs58 = (await import("bs58")).default;
  const signature = bs58.encode(signed.signature);
  const data = await api<AuthResponse & { wallet: string; isNew: boolean }>("/api/auth/wallet", {
    method: "POST",
    body: JSON.stringify({ pubkey, signature, nonce, token }),
  });
  applyAuth(data);
  useGame.setState({ account: { name: data.name, wallet: data.wallet } });
  return { name: data.name, isNew: data.isNew };
}

/** Set the display name (wallet accounts pick one on first login). */
export async function chooseName(name: string) {
  const data = await api<{ name: string }>("/api/auth/name", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  const account = useGame.getState().account;
  useGame.setState({ name: data.name, account: account ? { ...account, name: data.name } : null });
  return data.name;
}

export type EstateRow = { name: string; homeTier: number; houseLevel: number };

export async function fetchLeaderboard() {
  return api<{
    players: { name: string; level: number; acorns: number }[];
    estates: EstateRow[];
    online: number;
  }>("/api/leaderboard");
}

// ---- guestbook ----

export type GuestbookEntry = { id: string; author: string; text: string; createdAt: string };

export async function fetchGuestbook(name: string) {
  return api<{ entries: GuestbookEntry[] }>(`/api/guestbook/${encodeURIComponent(name)}`);
}

export async function signGuestbook(name: string, text: string) {
  return api<{ ok: boolean }>(`/api/guestbook/${encodeURIComponent(name)}`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

// ---- gifts & tips ----

export type Gift = {
  id: string;
  fromName: string;
  item: string | null;
  qty: number;
  acorns: number;
};

export async function fetchGifts() {
  return api<{ gifts: Gift[] }>("/api/gifts");
}

export async function sendGift(to: string, payload: { acorns?: number; item?: string; qty?: number }) {
  return api<{ ok: boolean }>("/api/gifts", {
    method: "POST",
    body: JSON.stringify({ to, ...payload }),
  });
}

export async function claimGift(id: string) {
  return api<{ ok: boolean; gift: Gift }>("/api/gifts/claim", {
    method: "POST",
    body: JSON.stringify({ id }),
  });
}

export const ACORNS_PER_SOL = 100_000;

export async function cashOut(acorns: number) {
  const s = useGame.getState();
  if (s.acorns < acorns) throw new Error("Not enough acorns");
  const data = await api<{ status: string; acorns: number; txSig?: string; mint?: string; message?: string }>(
    "/api/cashout",
    { method: "POST", body: JSON.stringify({ acorns }) }
  );
  useGame.setState({ acorns: useGame.getState().acorns - acorns });
  pushSave();
  if (data.status === "paid") {
    s.addToast(`🪙 ${acorns} $ACORN minted to your wallet — tx ${data.txSig?.slice(0, 8)}…`);
  } else {
    s.addToast(`🪙 ${acorns} $ACORN conversion queued (${data.message ?? "pending"})`);
  }
  return data;
}

/** Solana Explorer link for a conversion tx (devnet for now). */
export function explorerTxUrl(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export async function fetchVisit(name: string) {
  return api<{
    name: string;
    homeTier: number;
    structures: any[];
    farm: Record<string, { seed: string; at: number }>;
    pens: Record<string, { animal: string; count: number }>;
    level: number;
  }>(`/api/visit/${encodeURIComponent(name)}`);
}
