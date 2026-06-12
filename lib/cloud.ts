"use client";

// Client helpers for accounts, cloud saves, visiting and player offers.

import { useGame } from "./store";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
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
    chest: s.chest,
    farm: s.farm,
    dog: s.dog,
    coop: s.coop,
    structures: s.structures,
  };
}

function applyAuth(data: AuthResponse) {
  const s = useGame.getState();
  if (data.save) {
    useGame.setState({ ...data.save, name: data.name });
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

export async function pushSave() {
  if (!useGame.getState().account) return;
  await api("/api/save", { method: "PUT", body: JSON.stringify(saveData()) }).catch(() => {});
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

/** Push the save to the cloud every 20s while logged in. */
export function startSaveSync() {
  if (syncTimer) return;
  syncTimer = setInterval(pushSave, 20_000);
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

export async function fetchLeaderboard() {
  return api<{ players: { name: string; level: number; acorns: number }[]; online: number }>(
    "/api/leaderboard"
  );
}

export const ACORNS_PER_SOL = 100_000;

export async function cashOut(acorns: number) {
  const s = useGame.getState();
  if (s.acorns < acorns) throw new Error("Not enough acorns");
  const data = await api<{ status: string; lamports: number; txSig?: string; message?: string }>(
    "/api/cashout",
    { method: "POST", body: JSON.stringify({ acorns }) }
  );
  useGame.setState({ acorns: useGame.getState().acorns - acorns });
  pushSave();
  const sol = (data.lamports / 1_000_000_000).toFixed(4);
  if (data.status === "paid") {
    s.addToast(`💸 Paid ${sol} SOL — tx ${data.txSig?.slice(0, 8)}…`);
  } else {
    s.addToast(`💸 ${sol} SOL payout queued (${data.message ?? "pending"})`);
  }
  return data;
}

export async function fetchVisit(name: string) {
  return api<{
    name: string;
    homeTier: number;
    structures: any[];
    farm: Record<string, { seed: string; at: number }>;
    coop: { owned: boolean; hens: number };
    level: number;
  }>(`/api/visit/${encodeURIComponent(name)}`);
}
