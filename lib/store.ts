"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { sfx } from "./sound";
import { teleport, live, isBloodMoonNight } from "./runtime";
import { CAMPFIRE_POS, ShopId, HOME_TIERS, HOME_GATE_POS, HOME_PORTAL_POS } from "./world";

export type Interact =
  | { kind: "shop"; id: ShopId }
  | { kind: "chest" }
  | { kind: "furnace" }
  | { kind: "portal" } // forest gate into the homestead
  | { kind: "homegate" } // homestead gate back to the forest
  | { kind: "extend" } // homestead extension sign
  | { kind: "coop" }; // chicken coop (or its build spot)

export type Quest = {
  id: string;
  title: string;
  desc: string;
  goal: number;
  progress: number;
  done: boolean;
  xp: number;
  acorns: number;
};

export type Toast = { id: number; text: string };

export type AxeTier = "rusty" | "golden";
export type WeaponTier = "club" | "spear" | "sword";
export type ArmorTier = "leather" | "iron";

export const AXES: Record<AxeTier, { label: string; cost: number; chopTime: number; yield: number; blurb: string }> = {
  rusty: { label: "Rusty Axe", cost: 60, chopTime: 2.2, yield: 3, blurb: "Chops 2× faster, +1 wood per tree" },
  golden: { label: "Golden Axe", cost: 250, chopTime: 1.0, yield: 5, blurb: "Chops 5× faster, +3 wood per tree" },
};

export const WEAPONS: Record<WeaponTier, { label: string; icon: string; cost: number; dmg: number; blurb: string }> = {
  club: { label: "Wooden Club", icon: "🏏", cost: 40, dmg: 16, blurb: "Heavy knockback — keeps them off you" },
  spear: { label: "Hunting Spear", icon: "🔱", cost: 120, dmg: 26, blurb: "Long reach — strike before they close in" },
  sword: { label: "Iron Sword", icon: "⚔️", cost: 250, dmg: 38, blurb: "Fast swings, 20% critical hits" },
};

export type CombatProfile = {
  label: string;
  dmg: number;
  swing: number; // seconds between swings
  reach: number;
  knockback: number;
  crit: number; // chance of a 2× hit
};

export const COMBAT: Record<"fists" | "axe" | WeaponTier, CombatProfile> = {
  fists: { label: "Fists", dmg: 8, swing: 0.85, reach: 1.6, knockback: 0.3, crit: 0 },
  axe: { label: "Axe", dmg: 14, swing: 0.7, reach: 1.8, knockback: 0.5, crit: 0.05 },
  club: { label: "Wooden Club", dmg: 16, swing: 0.6, reach: 1.9, knockback: 1.5, crit: 0.05 },
  spear: { label: "Hunting Spear", dmg: 26, swing: 0.55, reach: 2.9, knockback: 0.7, crit: 0.1 },
  sword: { label: "Iron Sword", dmg: 38, swing: 0.45, reach: 2.0, knockback: 0.5, crit: 0.2 },
};

export const ARMOR: Record<ArmorTier, { label: string; icon: string; cost: number; reduce: number; blurb: string }> = {
  leather: { label: "Leather Jerkin", icon: "🦺", cost: 100, reduce: 0.25, blurb: "Blocks 25% of zombie damage" },
  iron: { label: "Iron Plate", icon: "🛡️", cost: 280, reduce: 0.5, blurb: "Blocks 50% of zombie damage" },
};

export const SHIRTS: Record<string, { label: string; cost: number; color: string }> = {
  green: { label: "Forest Green", cost: 0, color: "#3f6d35" },
  blue: { label: "River Blue", cost: 30, color: "#2e5d8a" },
  red: { label: "Berry Red", cost: 30, color: "#a8403a" },
  yellow: { label: "Sunflower Yellow", cost: 30, color: "#c99a2e" },
  purple: { label: "Mushroom Purple", cost: 50, color: "#6d4a8a" },
};

export const HATS: Record<string, { label: string; icon: string; cost: number }> = {
  straw: { label: "Straw Hat", icon: "👒", cost: 60 },
  cap: { label: "Forager's Cap", icon: "🧢", cost: 40 },
  crown: { label: "Golden Crown", icon: "👑", cost: 300 },
};

export const MEDS: Record<string, { icon: string; cost: number; blurb: string }> = {
  Bandage: { icon: "🩹", cost: 15, blurb: "Restores 30 HP" },
  Medkit: { icon: "🧰", cost: 50, blurb: "Restores full HP" },
  Antidote: { icon: "💉", cost: 40, blurb: "Cures zombie infection" },
};

export const HAND_CHOP_TIME = 5.5;
export const HAND_YIELD = 2;
export const ROD_COST = 80;

export const SELL_PRICES: Record<string, number> = {
  Wood: 4,
  "Orange Mushroom": 8,
  "Purple Mushroom": 10,
  Sunflower: 6,
  Hyacinth: 6,
  Daffodil: 6,
  Water: 2,
  Carp: 12,
  Trout: 18,
  "Golden Fish": 60,
  Carrot: 7,
  Pumpkin: 18,
  "Raw Chicken": 6,
  "Cooked Chicken": 14,
  "Raw Pork": 8,
  "Cooked Pork": 18,
  "Cooked Fish": 16,
  Egg: 5,
  "Fried Egg": 12,
  Stone: 5,
};

export const COLLECTIBLE_RESPAWN_MS = 90_000;
export const TREE_RESPAWN_MS = 120_000; // trees regrow after 2 minutes
export const ROCK_RESPAWN_MS = 150_000;

export const PICKAXE_COST = 80;
export const HAND_MINE_TIME = 7;
export const PICK_MINE_TIME = 2.5;
export const HAND_STONE_YIELD = 2;
export const PICK_STONE_YIELD = 4;
export const HELD_TORCH_COST = 60;
export const PACK_CAP = 40;

export function chestCapFor(tier: number) {
  return tier > 0 ? HOME_TIERS[Math.min(tier, HOME_TIERS.length) - 1].chestCap : 0;
}

export const SEEDS: Record<string, { cost: number; growMs: number; yieldLabel: string; yieldN: number }> = {
  "Carrot Seeds": { cost: 8, growMs: 60_000, yieldLabel: "Carrot", yieldN: 2 },
  "Pumpkin Seeds": { cost: 15, growMs: 120_000, yieldLabel: "Pumpkin", yieldN: 1 },
};

// what cooking turns things into (each cook burns 1 Wood)
export const RECIPES: Record<string, string> = {
  "Raw Chicken": "Cooked Chicken",
  "Raw Pork": "Cooked Pork",
  Carp: "Cooked Fish",
  Trout: "Cooked Fish",
  Egg: "Fried Egg",
};

// eating: hp/energy/hunger restored, and the infection risk of eating it raw
export const FOODS: Record<string, { hp: number; energy: number; hunger: number; infect?: number }> = {
  "Raw Chicken": { hp: 4, energy: 5, hunger: 8, infect: 0.6 },
  "Cooked Chicken": { hp: 25, energy: 15, hunger: 30 },
  "Raw Pork": { hp: 5, energy: 5, hunger: 10, infect: 0.25 },
  "Cooked Pork": { hp: 30, energy: 12, hunger: 35 },
  "Cooked Fish": { hp: 20, energy: 10, hunger: 25 },
  Carrot: { hp: 8, energy: 8, hunger: 12 },
  Pumpkin: { hp: 15, energy: 15, hunger: 20 },
  Egg: { hp: 3, energy: 3, hunger: 5, infect: 0.1 },
  "Fried Egg": { hp: 15, energy: 10, hunger: 20 },
  "Orange Mushroom": { hp: 5, energy: 5, hunger: 8 },
  "Purple Mushroom": { hp: 5, energy: 5, hunger: 8 },
};

// ---- homestead extras ----

export const DOG_COST = 200;
export const COOP_COST = { acorns: 150, wood: 10 };
export const HEN_COST = 40;
export const MAX_HENS = 4;
export const EGG_INTERVAL_MS = 240_000; // one egg per hen every 4 minutes
export const EGG_STORE_CAP = 8;

export type Structure = { id: number; type: string; x: number; z: number };

export const BUILDABLES: Record<string, { label: string; icon: string; wood: number; stone: number; acorns: number; blurb: string }> = {
  path: { label: "Stone Path", icon: "🟫", wood: 0, stone: 2, acorns: 0, blurb: "A paved tile for walkways" },
  torch: { label: "Torch", icon: "🕯️", wood: 1, stone: 0, acorns: 5, blurb: "Lights your land at night" },
  flowerbed: { label: "Flower Bed", icon: "🌸", wood: 2, stone: 0, acorns: 10, blurb: "A splash of colour" },
  barn: { label: "Barn", icon: "🛖", wood: 30, stone: 15, acorns: 200, blurb: "A grand red barn" },
};

export const MAX_STRUCTURES = 30;

// ---- character appearance ----

export type Appearance = {
  skin: number; // index into SKIN_TONES
  hair: "none" | "short" | "long";
  hairColor: number; // index into HAIR_COLORS
  beard: boolean;
  accessory: "none" | "glasses" | "scarf";
};

export const SKIN_TONES = ["#d9a87a", "#b5805a", "#8a5a3c"];
export const HAIR_COLORS = ["#4a3520", "#1e1a16", "#c9a84c", "#8a3c28"];

export const DEFAULT_APPEARANCE: Appearance = {
  skin: 0,
  hair: "short",
  hairColor: 0,
  beard: false,
  accessory: "none",
};

export const ANIMAL_DROPS: Record<"chicken" | "boar", { label: string; min: number; max: number; xp: number }> = {
  chicken: { label: "Raw Chicken", min: 1, max: 2, xp: 12 },
  boar: { label: "Raw Pork", min: 2, max: 3, xp: 18 },
};

const FISH_TABLE: { label: string; weight: number }[] = [
  { label: "Carp", weight: 60 },
  { label: "Trout", weight: 32 },
  { label: "Golden Fish", weight: 8 },
];

function rollFish(): string {
  let r = Math.random() * 100;
  for (const f of FISH_TABLE) {
    if ((r -= f.weight) <= 0) return f.label;
  }
  return "Carp";
}

export function rankFor(level: number): string {
  if (level >= 20) return "Forest Legend";
  if (level >= 16) return "Warden";
  if (level >= 12) return "Ranger";
  if (level >= 8) return "Hunter";
  if (level >= 5) return "Woodsman";
  if (level >= 3) return "Forager";
  return "Drifter";
}

// ---- exchange: daily NPC offers ----

export type Offer = {
  id: string;
  npc: string;
  type: "buy" | "sell"; // buy = NPC buys FROM the player at a premium
  item: string;
  qty: number;
  price: number;
};

const NPCS = ["MossyOak", "FernGully", "BarkBeetle", "OwlEyes", "PineSap"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayOffers(day: number): Offer[] {
  const r = mulberry32(day * 7919 + 11);
  const items = Object.keys(SELL_PRICES);
  const offers: Offer[] = [];
  for (let i = 0; i < 3; i++) {
    const type: "buy" | "sell" = i < 2 ? "buy" : "sell";
    const item = items[Math.floor(r() * items.length)];
    const qty = 2 + Math.floor(r() * 5);
    const base = SELL_PRICES[item] * qty;
    const price = type === "buy" ? Math.ceil(base * (1.4 + r() * 0.4)) : Math.floor(base * 0.7);
    offers.push({ id: `${day}-${i}`, npc: NPCS[Math.floor(r() * NPCS.length)], type, item, qty, price });
  }
  return offers;
}

const QUESTS: Quest[] = [
  { id: "leave-glade", title: "Leave the Glade", desc: "Head out through a gap in the fence into the wild.", goal: 1, progress: 0, done: false, xp: 40, acorns: 10 },
  { id: "forage-mushrooms", title: "Mushroom Forager", desc: "Collect 5 wild mushrooms from the northern grove.", goal: 5, progress: 0, done: false, xp: 80, acorns: 25 },
  { id: "timber", title: "Timber!", desc: "Chop down 2 trees with your bare hands. Click a tree to start chopping.", goal: 2, progress: 0, done: false, xp: 80, acorns: 20 },
  { id: "pick-flowers", title: "Meadow Florist", desc: "Pick 3 flowers from the southern meadow.", goal: 3, progress: 0, done: false, xp: 60, acorns: 20 },
  { id: "buy-axe", title: "Tooled Up", desc: "Sell your goods at the Trading Post and buy an axe.", goal: 1, progress: 0, done: false, xp: 100, acorns: 0 },
  { id: "go-fish", title: "Gone Fishing", desc: "Buy a fishing rod, stand by the river and press F. Catch 2 fish.", goal: 2, progress: 0, done: false, xp: 90, acorns: 25 },
  { id: "cross-bridge", title: "Cross the Old Bridge", desc: "Cross the river east of camp — only the bridge will get you over.", goal: 1, progress: 0, done: false, xp: 50, acorns: 15 },
  { id: "return-camp", title: "Back to Camp", desc: "Return to the campfire and warm up.", goal: 1, progress: 0, done: false, xp: 70, acorns: 30 },
  { id: "night-watch", title: "Night Watch", desc: "Zombies rise after dark. Put 3 of them back in the ground — click one to attack.", goal: 3, progress: 0, done: false, xp: 150, acorns: 50 },
  { id: "buy-plot", title: "Land Owner", desc: "Buy your own homestead at the 🏡 gate near camp — your private land, away from the forest.", goal: 1, progress: 0, done: false, xp: 120, acorns: 0 },
  { id: "harvest", title: "Green Thumb", desc: "Buy seeds at the Trading Post, plant them on your homestead, and harvest 3 crops.", goal: 3, progress: 0, done: false, xp: 100, acorns: 30 },
  { id: "cook", title: "Home Cooking", desc: "Hunt an animal and cook its meat in your homestead furnace (each cook burns 1 Wood).", goal: 1, progress: 0, done: false, xp: 100, acorns: 25 },
];

let toastId = 0;

type GameState = {
  name: string;
  started: boolean;
  muted: boolean;

  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  hunger: number;
  maxHunger: number;
  xp: number;
  level: number;
  acorns: number;
  axe: AxeTier | null;
  rod: boolean;
  weapon: WeaponTier | null;
  armor: ArmorTier | null;
  shirt: string;
  ownedShirts: string[];
  hat: string | null;
  ownedHats: string[];
  appearance: Appearance;
  infected: boolean;
  inventory: Record<string, number>;

  collected: Record<string, number>;
  choppedAt: Record<string, number>;
  minedAt: Record<string, number>; // rock id -> mined at (ms)
  chopTargetId: string | null;
  mineTargetId: string | null;
  pickaxe: boolean;
  heldTorch: boolean;
  spectator: boolean;
  attackTargetId: number | null;
  animalTargetId: string | null;
  fishingState: "idle" | "waiting" | "bite";
  hurtAt: number;
  lastPlayerHit: { amount: number; at: number } | null;
  lastHit: { id: number; key: string; amount: number; crit: boolean; at: number } | null;
  acceptedOffers: string[];
  homeTier: number; // 0 = no land owned
  location: "forest" | "home" | "visit";
  savedForestPos: { x: number; z: number } | null;
  account: { name: string; wallet?: string } | null;
  visitData: {
    name: string;
    homeTier: number;
    structures: Structure[];
    farm: Record<string, { seed: string; at: number }>;
    coop: { owned: boolean; hens: number };
  } | null;
  chest: Record<string, number>;
  farm: Record<string, { seed: string; at: number }>;
  dog: boolean;
  coop: { owned: boolean; hens: number; lastEggAt: number };
  structures: Structure[];
  buildMode: string | null; // buildable key, or "remove"

  quests: Quest[];
  zone: string;
  banner: string | null;
  toasts: Toast[];
  nearInteract: Interact | null;
  nearWater: boolean;
  openShop: ShopId | null;
  openPanel: "chest" | "furnace" | "coop" | null;
  homeOffer: "buy" | "extend" | null;
  showQuests: boolean;
  showHelp: boolean;

  xpToLevel: () => number;
  chopTime: () => number;
  packCount: () => number;
  gainItem: (label: string, n: number) => number; // returns how many actually fit
  combatProfile: () => CombatProfile;
  registerHit: (key: string, amount: number, crit: boolean) => void;
  start: (name: string) => void;
  setAppearance: (a: Appearance) => void;
  addToast: (text: string) => void;
  setBanner: (text: string) => void;
  addXp: (amount: number) => void;
  collectItem: (id: string, label: string, kind: string) => void;
  setChopTarget: (id: string | null) => void;
  chopComplete: (treeId: string) => void;
  respawnTree: (treeId: string) => void;
  setMineTarget: (id: string | null) => void;
  mineTime: () => number;
  mineComplete: (rockId: string) => void;
  respawnRock: (rockId: string) => void;
  buyPickaxe: () => void;
  buyHeldTorch: () => void;
  setSpectator: (on: boolean) => void;
  setAttackTarget: (id: number | null) => void;
  setAnimalTarget: (id: string | null) => void;
  zombieKilled: () => void;
  animalKilled: (kind: "chicken" | "boar") => void;
  hurt: (dmg: number, canInfect?: boolean) => void;
  buyHomestead: () => void;
  extendHomestead: () => void;
  travel: (to: "forest" | "home") => void;
  startVisit: (data: GameState["visitData"]) => void;
  buyDog: () => void;
  buyCoop: () => void;
  buyHen: () => void;
  pendingEggs: () => number;
  collectEggs: () => void;
  setBuildMode: (mode: string | null) => void;
  placeStructure: (x: number, z: number) => void;
  removeStructure: (id: number) => void;
  plantSeed: (tileKey: string) => void;
  harvestTile: (tileKey: string) => void;
  chestMove: (label: string, qty: number, toChest: boolean) => void;
  cookItem: (rawLabel: string) => void;
  setFishingState: (s: "idle" | "waiting" | "bite") => void;
  catchFish: () => void;
  collectWater: () => void;
  buyAxe: (tier: AxeTier) => void;
  buyRod: () => void;
  buyWeapon: (tier: WeaponTier) => void;
  buyArmor: (tier: ArmorTier) => void;
  buyShirt: (key: string) => void;
  buyHat: (key: string) => void;
  buyMed: (label: string) => void;
  useItem: (label: string) => void;
  acceptOffer: (offer: Offer) => void;
  sellItem: (label: string, qty: number) => void;
  questEvent: (questId: string) => void;
  setZone: (zone: string) => void;
  setNearInteract: (i: Interact | null) => void;
  setNearWater: (near: boolean) => void;
  tick: (dtSeconds: number, moving: boolean, nearCamp: boolean, sprinting: boolean, working: boolean) => void;
  setOpenShop: (id: ShopId | null) => void;
  setOpenPanel: (p: "chest" | "furnace" | "coop" | null) => void;
  setHomeOffer: (o: "buy" | "extend" | null) => void;
  toggleQuests: () => void;
  toggleHelp: () => void;
  toggleMute: () => void;
  closeModals: () => void;
};

function spend(s: { acorns: number; addToast: (t: string) => void }, cost: number): boolean {
  if (s.acorns < cost) {
    s.addToast("Not enough acorns!");
    sfx.error();
    return false;
  }
  return true;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      name: "",
      started: false,
      muted: false,

      hp: 100,
      maxHp: 100,
      energy: 100,
      maxEnergy: 100,
      hunger: 100,
      maxHunger: 100,
      xp: 0,
      level: 1,
      acorns: 1000, // generous starting purse for testing the economy
      axe: null,
      rod: false,
      weapon: null,
      armor: null,
      shirt: "green",
      ownedShirts: ["green"],
      hat: null,
      ownedHats: [],
      appearance: DEFAULT_APPEARANCE,
      infected: false,
      inventory: {},

      collected: {},
      choppedAt: {},
      minedAt: {},
      chopTargetId: null,
      mineTargetId: null,
      pickaxe: false,
      heldTorch: false,
      spectator: false,
      attackTargetId: null,
      animalTargetId: null,
      fishingState: "idle",
      hurtAt: 0,
      lastPlayerHit: null,
      lastHit: null,
      acceptedOffers: [],
      homeTier: 0,
      location: "forest",
      savedForestPos: null,
      account: null,
      visitData: null,
      chest: {},
      farm: {},
      dog: false,
      coop: { owned: false, hens: 0, lastEggAt: 0 },
      structures: [],
      buildMode: null,

      quests: QUESTS,
      zone: "The Glade",
      banner: null,
      toasts: [],
      nearInteract: null,
      nearWater: false,
      openShop: null,
      openPanel: null,
      homeOffer: null,
      showQuests: false,
      showHelp: false,

      xpToLevel: () => get().level * 100,
      chopTime: () => (get().axe ? AXES[get().axe!].chopTime : HAND_CHOP_TIME),
      combatProfile: () => {
        const s = get();
        if (s.weapon) return COMBAT[s.weapon];
        return s.axe ? COMBAT.axe : COMBAT.fists;
      },
      registerHit: (key, amount, crit) => {
        set((s) => ({
          lastHit: { id: (s.lastHit?.id ?? 0) + 1, key, amount, crit, at: Date.now() },
        }));
      },

      packCount: () => Object.values(get().inventory).reduce((a, n) => a + n, 0),

      gainItem: (label, n) => {
        const s = get();
        const space = PACK_CAP - s.packCount();
        const add = Math.max(0, Math.min(n, space));
        if (add > 0) {
          set({ inventory: { ...s.inventory, [label]: (s.inventory[label] ?? 0) + add } });
        }
        if (add < n) {
          s.addToast("🎒 Pack full! Store things in a chest");
          sfx.error();
        }
        return add;
      },

      start: (name) => {
        sfx.unlock();
        set({ name: name.trim() || "Wanderer", started: true });
      },

      setAppearance: (a) => set({ appearance: a }),

      addToast: (text) => {
        const id = ++toastId;
        set((s) => ({ toasts: [...s.toasts.slice(-4), { id, text }] }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, 3500);
      },

      setBanner: (text) => {
        set({ banner: text });
        setTimeout(() => {
          set((s) => (s.banner === text ? { banner: null } : s));
        }, 4000);
      },

      addXp: (amount) => {
        let { xp, level } = get();
        xp += amount;
        let cap = level * 100;
        let leveled = false;
        while (xp >= cap) {
          xp -= cap;
          level += 1;
          cap = level * 100;
          leveled = true;
        }
        if (leveled) {
          const newMaxHp = 100 + (level - 1) * 10;
          const oldRank = rankFor(get().level);
          const newRank = rankFor(level);
          set({ xp, level, maxHp: newMaxHp, hp: newMaxHp, energy: get().maxEnergy });
          get().setBanner(
            newRank !== oldRank
              ? `Rank up! You are now a ${newRank} (Lv ${level})`
              : `Level up! You are now level ${level}`
          );
          sfx.levelUp();
        } else {
          set({ xp });
        }
      },

      collectItem: (id, label, kind) => {
        const s = get();
        const at = s.collected[id];
        if (at && Date.now() - at < COLLECTIBLE_RESPAWN_MS) return;
        if (s.gainItem(label, 1) < 1) return; // pack full — leave it in the world
        set({ collected: { ...get().collected, [id]: Date.now() } });
        s.addToast(`+1 ${label} · +10 XP`);
        sfx.pickup();
        s.addXp(10);
        const questId = kind === "mushroom" ? "forage-mushrooms" : kind === "flower" ? "pick-flowers" : null;
        if (questId) get().questEvent(questId);
      },

      setChopTarget: (id) => {
        if (get().chopTargetId !== id) set({ chopTargetId: id, mineTargetId: null, attackTargetId: null });
      },

      setMineTarget: (id) => {
        if (get().mineTargetId !== id) set({ mineTargetId: id, chopTargetId: null, attackTargetId: null });
      },

      mineTime: () => (get().pickaxe ? PICK_MINE_TIME : HAND_MINE_TIME),

      mineComplete: (rockId) => {
        const s = get();
        if (s.minedAt[rockId]) return;
        const yieldN = s.pickaxe ? PICK_STONE_YIELD : HAND_STONE_YIELD;
        const got = s.gainItem("Stone", yieldN);
        set({
          minedAt: { ...get().minedAt, [rockId]: Date.now() },
          mineTargetId: null,
        });
        sfx.treeFall();
        if (got > 0) s.addToast(`+${got} Stone · +15 XP`);
        s.addXp(15);
      },

      respawnRock: (rockId) => {
        const next = { ...get().minedAt };
        delete next[rockId];
        set({ minedAt: next });
      },

      buyPickaxe: () => {
        const s = get();
        if (s.pickaxe) return;
        if (!spend(s, PICKAXE_COST)) return;
        set({ acorns: s.acorns - PICKAXE_COST, pickaxe: true });
        sfx.buy();
        s.addToast("⛏️ Pickaxe bought — mining is much faster now");
      },

      buyHeldTorch: () => {
        const s = get();
        if (s.heldTorch) return;
        if (!spend(s, HELD_TORCH_COST)) return;
        set({ acorns: s.acorns - HELD_TORCH_COST, heldTorch: true });
        sfx.buy();
        s.addToast("🔥 Hand torch bought — it lights itself after dark");
      },

      setSpectator: (on) => set({ spectator: on }),

      chopComplete: (treeId) => {
        const s = get();
        if (s.choppedAt[treeId]) return;
        const yieldN = s.axe ? AXES[s.axe].yield : HAND_YIELD;
        const got = s.gainItem("Wood", yieldN);
        set({
          choppedAt: { ...get().choppedAt, [treeId]: Date.now() },
          chopTargetId: null,
        });
        sfx.treeFall();
        if (got > 0) s.addToast(`+${got} Wood · +15 XP`);
        s.addXp(15);
        get().questEvent("timber");
      },

      respawnTree: (treeId) => {
        const next = { ...get().choppedAt };
        delete next[treeId];
        set({ choppedAt: next });
      },

      setAttackTarget: (id) => {
        if (get().attackTargetId !== id) set({ attackTargetId: id, chopTargetId: null });
      },

      zombieKilled: () => {
        const s = get();
        const blood = isBloodMoonNight();
        const loot = (5 + Math.floor(Math.random() * 11)) * (blood ? 2 : 1);
        const extra = Math.random() < 0.25 ? "Purple Mushroom" : null;
        if (extra) s.gainItem(extra, 1);
        set({ acorns: get().acorns + loot, attackTargetId: null });
        s.addToast(`${blood ? "🔴 " : ""}Zombie slain! +25 XP · +${loot} 🌰${extra ? ` · +1 ${extra}` : ""}`);
        sfx.coin();
        s.addXp(25);
        get().questEvent("night-watch");
      },

      setAnimalTarget: (id) => {
        if (get().animalTargetId !== id) {
          set({ animalTargetId: id, attackTargetId: null, chopTargetId: null });
        }
      },

      animalKilled: (kind) => {
        const s = get();
        const drop = ANIMAL_DROPS[kind];
        const n = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        const got = s.gainItem(drop.label, n);
        set({ animalTargetId: null });
        s.addToast(`${kind === "chicken" ? "🐔" : "🐗"} +${got} ${drop.label} · +${drop.xp} XP`);
        sfx.coin();
        s.addXp(drop.xp);
      },

      buyHomestead: () => {
        const s = get();
        if (s.homeTier > 0) return;
        const tier = HOME_TIERS[0];
        if (!spend(s, tier.price)) return;
        set({ acorns: s.acorns - tier.price, homeTier: 1, homeOffer: null });
        sfx.buy();
        s.setBanner("🏡 The Homestead is yours!");
        s.addToast("Walk through the gate to visit your land");
        get().questEvent("buy-plot");
      },

      extendHomestead: () => {
        const s = get();
        if (s.homeTier < 1 || s.homeTier >= HOME_TIERS.length) return;
        const next = HOME_TIERS[s.homeTier];
        if (!spend(s, next.price)) return;
        set({ acorns: s.acorns - next.price, homeTier: s.homeTier + 1, homeOffer: null });
        sfx.buy();
        s.setBanner(`🏡 Upgraded to the ${next.name}!`);
        s.addToast(`+${next.tiles - HOME_TIERS[s.homeTier - 1].tiles} farm tiles · bigger grounds · chest holds ${next.chestCap}`);
      },

      buyDog: () => {
        const s = get();
        if (s.dog) return;
        if (!spend(s, DOG_COST)) return;
        set({ acorns: s.acorns - DOG_COST, dog: true });
        sfx.buy();
        s.setBanner("🐕 You adopted a dog! He'll fight by your side");
      },

      buyCoop: () => {
        const s = get();
        if (s.coop.owned || s.homeTier < 1) return;
        if ((s.inventory.Wood ?? 0) < COOP_COST.wood) {
          s.addToast(`You need ${COOP_COST.wood} Wood to build the coop 🪵`);
          sfx.error();
          return;
        }
        if (!spend(s, COOP_COST.acorns)) return;
        const inv = { ...s.inventory };
        if (inv.Wood - COOP_COST.wood <= 0) delete inv.Wood;
        else inv.Wood -= COOP_COST.wood;
        set({
          acorns: s.acorns - COOP_COST.acorns,
          inventory: inv,
          coop: { owned: true, hens: 1, lastEggAt: Date.now() },
        });
        sfx.buy();
        s.setBanner("🐔 Coop built — your first hen moved in!");
      },

      buyHen: () => {
        const s = get();
        if (!s.coop.owned || s.coop.hens >= MAX_HENS) return;
        if (!spend(s, HEN_COST)) return;
        // bank the eggs laid so far, then restart the clock with more hens
        const pending = get().pendingEggs();
        if (pending > 0) get().collectEggs();
        set({
          acorns: get().acorns - HEN_COST,
          coop: { ...get().coop, hens: get().coop.hens + 1, lastEggAt: Date.now() },
        });
        sfx.buy();
        get().addToast(`🐔 A new hen joins the coop (${get().coop.hens}/${MAX_HENS})`);
      },

      pendingEggs: () => {
        const c = get().coop;
        if (!c.owned || c.hens < 1) return 0;
        return Math.min(EGG_STORE_CAP, Math.floor(((Date.now() - c.lastEggAt) / EGG_INTERVAL_MS) * c.hens));
      },

      collectEggs: () => {
        const s = get();
        const n = s.pendingEggs();
        if (n < 1) {
          s.addToast("No eggs yet — check back later 🥚");
          return;
        }
        const got = s.gainItem("Egg", n);
        if (got < 1) return;
        set({ coop: { ...get().coop, lastEggAt: Date.now() } });
        s.addToast(`🥚 Collected ${got} Egg${got > 1 ? "s" : ""}`);
        sfx.pickup();
        s.addXp(4 * got);
      },

      setBuildMode: (mode) => {
        set({ buildMode: mode, openShop: null, openPanel: null, homeOffer: null, showQuests: false, showHelp: false });
        if (mode) sfx.ui();
      },

      placeStructure: (x, z) => {
        const s = get();
        const def = s.buildMode ? BUILDABLES[s.buildMode] : null;
        if (!def || !s.buildMode) return;
        if (s.structures.length >= MAX_STRUCTURES) {
          s.addToast(`Limit of ${MAX_STRUCTURES} structures reached`);
          sfx.error();
          return;
        }
        const minGap = s.buildMode === "barn" ? 3.5 : 1.4;
        const clash = s.structures.some((st) => Math.hypot(st.x - x, st.z - z) < minGap);
        if (clash) {
          s.addToast("Too close to another structure");
          return;
        }
        if ((s.inventory.Wood ?? 0) < def.wood) {
          s.addToast(`Needs ${def.wood} Wood 🪵`);
          sfx.error();
          return;
        }
        if ((s.inventory.Stone ?? 0) < def.stone) {
          s.addToast(`Needs ${def.stone} Stone 🪨`);
          sfx.error();
          return;
        }
        if (s.acorns < def.acorns) {
          s.addToast(`Needs ${def.acorns} acorns 🌰`);
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const [mat, cost] of [["Wood", def.wood], ["Stone", def.stone]] as const) {
          if (cost > 0) {
            if (inv[mat] - cost <= 0) delete inv[mat];
            else inv[mat] -= cost;
          }
        }
        set({
          inventory: inv,
          acorns: s.acorns - def.acorns,
          structures: [...s.structures, { id: Date.now() + Math.floor(Math.random() * 1000), type: s.buildMode, x, z }],
        });
        sfx.buy();
      },

      removeStructure: (id) => {
        const s = get();
        const st = s.structures.find((x) => x.id === id);
        if (!st) return;
        const def = BUILDABLES[st.type];
        const refundWood = Math.floor(def.wood / 2);
        const refundStone = Math.floor(def.stone / 2);
        if (refundWood > 0) s.gainItem("Wood", refundWood);
        if (refundStone > 0) s.gainItem("Stone", refundStone);
        set({ structures: get().structures.filter((x) => x.id !== id) });
        s.addToast(`Removed ${def.label}`);
        sfx.ui();
      },

      startVisit: (data) => {
        if (!data) return;
        set({
          visitData: data,
          savedForestPos: { x: live.x, z: live.z },
          location: "visit",
          zone: `🏡 ${data.name}'s land`,
          buildMode: null,
          chopTargetId: null,
          attackTargetId: null,
          animalTargetId: null,
          fishingState: "idle",
          openShop: null,
          openPanel: null,
        });
        teleport.x = HOME_GATE_POS[0];
        teleport.z = HOME_GATE_POS[2] - 2;
        teleport.pending = true;
        sfx.questDone();
      },

      travel: (to) => {
        const s = get();
        set({ buildMode: null, visitData: null });
        if (to === "home") {
          if (s.homeTier < 1) return;
          set({
            savedForestPos: { x: live.x, z: live.z },
            location: "home",
            zone: "🏡 Homestead",
            chopTargetId: null,
            attackTargetId: null,
            animalTargetId: null,
            fishingState: "idle",
          });
          teleport.x = HOME_GATE_POS[0];
          teleport.z = HOME_GATE_POS[2] - 2;
        } else {
          const p = s.savedForestPos ?? { x: HOME_PORTAL_POS[0], z: HOME_PORTAL_POS[2] + 2 };
          set({ location: "forest", zone: "The Glade" });
          teleport.x = p.x;
          teleport.z = p.z;
        }
        teleport.pending = true;
        sfx.questDone();
      },

      plantSeed: (key) => {
        const s = get();
        if (s.farm[key]) return;
        const seedLabel = Object.keys(SEEDS).find((label) => (s.inventory[label] ?? 0) > 0);
        if (!seedLabel) {
          s.addToast("No seeds! Buy some at the Trading Post 🌱");
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        if (inv[seedLabel] <= 1) delete inv[seedLabel];
        else inv[seedLabel] -= 1;
        set({ inventory: inv, farm: { ...s.farm, [key]: { seed: seedLabel, at: Date.now() } } });
        s.addToast(`Planted ${seedLabel.replace(" Seeds", "")} 🌱`);
        sfx.pickup();
      },

      harvestTile: (key) => {
        const s = get();
        const crop = s.farm[key];
        if (!crop) return;
        const def = SEEDS[crop.seed];
        if (Date.now() - crop.at < def.growMs) {
          const pct = Math.round(((Date.now() - crop.at) / def.growMs) * 100);
          s.addToast(`Still growing… ${pct}%`);
          return;
        }
        const got = s.gainItem(def.yieldLabel, def.yieldN);
        if (got < 1) return;
        const farm = { ...get().farm };
        delete farm[key];
        set({ farm });
        s.addToast(`+${got} ${def.yieldLabel} · +8 XP`);
        sfx.pickup();
        s.addXp(8);
        get().questEvent("harvest");
      },

      chestMove: (label, qty, toChest) => {
        const s = get();
        if (toChest) {
          const have = s.inventory[label] ?? 0;
          const chestCount = Object.values(s.chest).reduce((a, n) => a + n, 0);
          const n = Math.min(have, qty, chestCapFor(s.homeTier) - chestCount);
          if (n <= 0) return;
          const inv = { ...s.inventory };
          if (inv[label] - n <= 0) delete inv[label];
          else inv[label] -= n;
          set({ inventory: inv, chest: { ...s.chest, [label]: (s.chest[label] ?? 0) + n } });
        } else {
          const have = s.chest[label] ?? 0;
          const n = Math.min(have, qty, PACK_CAP - s.packCount());
          if (n <= 0) {
            s.addToast("🎒 Pack full!");
            return;
          }
          const chest = { ...s.chest };
          if (chest[label] - n <= 0) delete chest[label];
          else chest[label] -= n;
          set({ chest, inventory: { ...s.inventory, [label]: (s.inventory[label] ?? 0) + n } });
        }
        sfx.ui();
      },

      cookItem: (rawLabel) => {
        const s = get();
        const cooked = RECIPES[rawLabel];
        if (!cooked) return;
        if ((s.inventory[rawLabel] ?? 0) < 1) return;
        if ((s.inventory.Wood ?? 0) < 1) {
          s.addToast("You need 1 Wood for fuel 🪵");
          sfx.error();
          return;
        }
        const inv = { ...s.inventory };
        for (const used of [rawLabel, "Wood"]) {
          if (inv[used] <= 1) delete inv[used];
          else inv[used] -= 1;
        }
        inv[cooked] = (inv[cooked] ?? 0) + 1;
        set({ inventory: inv });
        s.addToast(`🔥 Cooked 1 ${cooked} · +5 XP`);
        sfx.pickup();
        s.addXp(5);
        get().questEvent("cook");
      },

      hurt: (dmg, canInfect = false) => {
        const s = get();
        const reduced = dmg * (1 - (s.armor ? ARMOR[s.armor].reduce : 0));
        const hp = Math.max(0, s.hp - reduced);
        sfx.playerHurt();
        if (dmg > 1) set({ lastPlayerHit: { amount: Math.round(reduced), at: Date.now() } });
        // only zombie scratches can infect — animal attacks never do
        if (canInfect && dmg > 1 && !s.infected && Math.random() < 0.22) {
          set({ infected: true });
          s.addToast("☣️ You've been infected! Get an Antidote at the Med-Bay");
          sfx.error();
        }
        if (hp <= 0) {
          const lost = Math.floor(s.acorns * 0.25);
          teleport.x = CAMPFIRE_POS[0] + 2;
          teleport.z = CAMPFIRE_POS[2] + 2;
          teleport.pending = true;
          set({
            hp: Math.round(s.maxHp * 0.5),
            energy: 40,
            hunger: Math.max(s.hunger, 30),
            acorns: s.acorns - lost,
            hurtAt: Date.now(),
            infected: false,
            location: "forest",
            attackTargetId: null,
            chopTargetId: null,
            animalTargetId: null,
          });
          s.setBanner("You blacked out… you wake by the campfire");
          if (lost > 0) s.addToast(`Lost ${lost} acorns in the dark`);
        } else {
          set({ hp, hurtAt: Date.now() });
        }
      },

      setFishingState: (fs) => {
        if (get().fishingState !== fs) set({ fishingState: fs });
      },

      catchFish: () => {
        const s = get();
        const fish = rollFish();
        set({ fishingState: "idle" });
        if (s.gainItem(fish, 1) < 1) return;
        s.addToast(fish === "Golden Fish" ? `✨ Rare catch! +1 ${fish} · +12 XP` : `+1 ${fish} · +12 XP`);
        sfx.pickup();
        s.addXp(12);
        get().questEvent("go-fish");
      },

      collectWater: () => {
        const s = get();
        if (s.gainItem("Water", 1) < 1) return;
        set({ energy: Math.min(s.maxEnergy, get().energy + 8) });
        s.addToast("+1 Water · +3 XP");
        sfx.pickup();
        s.addXp(3);
      },

      buyAxe: (tier) => {
        const s = get();
        const def = AXES[tier];
        if (s.axe === tier || (s.axe === "golden" && tier === "rusty")) return;
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, axe: tier });
        sfx.buy();
        s.addToast(`Bought the ${def.label}!`);
        get().questEvent("buy-axe");
      },

      buyRod: () => {
        const s = get();
        if (s.rod) return;
        if (!spend(s, ROD_COST)) return;
        set({ acorns: s.acorns - ROD_COST, rod: true });
        sfx.buy();
        s.addToast("Bought the Fishing Rod! Press F by the river.");
      },

      buyWeapon: (tier) => {
        const s = get();
        const order: WeaponTier[] = ["club", "spear", "sword"];
        if (s.weapon && order.indexOf(s.weapon) >= order.indexOf(tier)) return;
        const def = WEAPONS[tier];
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, weapon: tier });
        sfx.buy();
        s.addToast(`Equipped the ${def.label}! (${def.dmg} dmg)`);
      },

      buyArmor: (tier) => {
        const s = get();
        const order: ArmorTier[] = ["leather", "iron"];
        if (s.armor && order.indexOf(s.armor) >= order.indexOf(tier)) return;
        const def = ARMOR[tier];
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, armor: tier });
        sfx.buy();
        s.addToast(`Equipped the ${def.label}!`);
      },

      buyShirt: (key) => {
        const s = get();
        const def = SHIRTS[key];
        if (!def) return;
        if (s.ownedShirts.includes(key)) {
          set({ shirt: key });
          sfx.ui();
          s.addToast(`Wearing ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, ownedShirts: [...s.ownedShirts, key], shirt: key });
        sfx.buy();
        s.addToast(`Bought & wearing ${def.label}!`);
      },

      buyHat: (key) => {
        const s = get();
        if (key === "none") {
          set({ hat: null });
          sfx.ui();
          return;
        }
        const def = HATS[key];
        if (!def) return;
        if (s.ownedHats.includes(key)) {
          set({ hat: key });
          sfx.ui();
          s.addToast(`Wearing the ${def.label}`);
          return;
        }
        if (!spend(s, def.cost)) return;
        set({ acorns: s.acorns - def.cost, ownedHats: [...s.ownedHats, key], hat: key });
        sfx.buy();
        s.addToast(`Bought & wearing the ${def.label}!`);
      },

      buyMed: (label) => {
        const s = get();
        const def = MEDS[label] ?? (SEEDS[label] ? { cost: SEEDS[label].cost } : null);
        if (!def) return;
        if (!spend(s, def.cost)) return;
        if (s.gainItem(label, 1) < 1) return;
        set({ acorns: get().acorns - def.cost });
        sfx.buy();
        s.addToast(`Bought 1 ${label}`);
      },

      useItem: (label) => {
        const s = get();
        if (!s.inventory[label]) return;
        const consume = () => {
          const inv = { ...get().inventory };
          if (inv[label] <= 1) delete inv[label];
          else inv[label] -= 1;
          set({ inventory: inv });
        };
        if (label === "Bandage") {
          set({ hp: Math.min(s.maxHp, s.hp + 30) });
          consume();
          s.addToast("🩹 +30 HP");
          sfx.pickup();
        } else if (label === "Medkit") {
          set({ hp: s.maxHp });
          consume();
          s.addToast("🧰 Fully healed!");
          sfx.pickup();
        } else if (label === "Antidote") {
          if (!s.infected) {
            s.addToast("You're not infected — save it for later");
            return;
          }
          set({ infected: false });
          consume();
          s.addToast("💉 Infection cured!");
          sfx.questDone();
        } else if (FOODS[label]) {
          const food = FOODS[label];
          consume();
          set({
            hp: Math.min(s.maxHp, get().hp + food.hp),
            energy: Math.min(s.maxEnergy, get().energy + food.energy),
            hunger: Math.min(s.maxHunger, get().hunger + food.hunger),
          });
          sfx.pickup();
          if (food.infect && !get().infected && Math.random() < food.infect) {
            set({ infected: true });
            s.addToast(`🤢 That ${label} was a bad idea… you're infected!`);
            sfx.error();
          } else {
            s.addToast(`Ate 1 ${label} · +${food.hp} HP +${food.energy} ⚡ +${food.hunger} 🍗`);
          }
        }
      },

      acceptOffer: (offer) => {
        const s = get();
        if (s.acceptedOffers.includes(offer.id)) return;
        if (offer.type === "buy") {
          if ((s.inventory[offer.item] ?? 0) < offer.qty) {
            s.addToast(`You need ${offer.qty} ${offer.item}`);
            sfx.error();
            return;
          }
          const inv = { ...s.inventory };
          if (inv[offer.item] - offer.qty <= 0) delete inv[offer.item];
          else inv[offer.item] -= offer.qty;
          set({
            inventory: inv,
            acorns: s.acorns + offer.price,
            acceptedOffers: [...s.acceptedOffers, offer.id],
          });
          s.addToast(`Traded ${offer.qty} ${offer.item} to ${offer.npc} for ${offer.price} 🌰`);
          sfx.coin();
        } else {
          if (!spend(s, offer.price)) return;
          const got = s.gainItem(offer.item, offer.qty);
          if (got < 1) return;
          set({
            acorns: get().acorns - offer.price,
            acceptedOffers: [...get().acceptedOffers, offer.id],
          });
          s.addToast(`Bought ${got} ${offer.item} from ${offer.npc}`);
          sfx.coin();
        }
      },

      sellItem: (label, qty) => {
        const s = get();
        const have = s.inventory[label] ?? 0;
        const n = Math.min(have, qty);
        if (n <= 0) return;
        const price = SELL_PRICES[label] ?? 1;
        const inv = { ...s.inventory };
        if (have - n <= 0) delete inv[label];
        else inv[label] = have - n;
        set({ inventory: inv, acorns: s.acorns + price * n });
        sfx.coin();
        s.addToast(`Sold ${n} ${label} for ${price * n} acorns`);
      },

      questEvent: (questId) => {
        const s = get();
        const idx = s.quests.findIndex((q) => q.id === questId);
        if (idx === -1) return;
        const quest = s.quests[idx];
        if (quest.done) return;
        const activeIdx = s.quests.findIndex((q) => !q.done);
        if (idx !== activeIdx) return;

        const progress = quest.progress + 1;
        const done = progress >= quest.goal;
        const quests = s.quests.map((q, i) => (i === idx ? { ...q, progress, done } : q));
        set({ quests });
        if (done) {
          set({ acorns: get().acorns + quest.acorns });
          s.setBanner(`Quest complete — ${quest.title}`);
          sfx.questDone();
          s.addToast(`Reward: +${quest.xp} XP${quest.acorns > 0 ? ` · +${quest.acorns} 🌰` : ""}`);
          s.addXp(quest.xp);
          const next = quests.find((q) => !q.done);
          if (next) {
            setTimeout(() => get().addToast(`New quest: ${next.title}`), 1200);
          } else {
            setTimeout(() => get().setBanner("All quests complete — the forest is yours"), 4200);
          }
        }
      },

      setZone: (zone) => {
        if (get().zone !== zone) set({ zone });
      },

      setNearInteract: (i) => {
        const cur = get().nearInteract;
        const same =
          (cur === null && i === null) ||
          (cur !== null && i !== null && JSON.stringify(cur) === JSON.stringify(i));
        if (!same) set({ nearInteract: i });
      },

      setNearWater: (near) => {
        if (get().nearWater !== near) set({ nearWater: near });
      },

      tick: (dt, moving, nearCamp, sprinting, working) => {
        const s = get();
        let { energy, hp, hunger } = s;
        const starving = hunger <= 0;
        if (nearCamp) {
          // a fed body rests well — the campfire can't fix an empty stomach
          if (!starving) {
            energy = Math.min(s.maxEnergy, energy + dt * 7);
            hp = Math.min(s.maxHp, hp + dt * 4);
          }
        } else if (working) {
          energy = Math.max(0, energy - dt * 2.5);
        } else if (sprinting) {
          energy = Math.max(0, energy - dt * 5);
        } else if (moving) {
          energy = Math.max(0, energy - dt * 1);
        } else if (hunger > 25) {
          energy = Math.min(s.maxEnergy, energy + dt * 1.2);
        }

        // appetite: faster when working hard
        const burn = working || sprinting ? 0.14 : 0.06;
        const prevHunger = hunger;
        hunger = Math.max(0, hunger - dt * burn);
        if (prevHunger > 25 && hunger <= 25) {
          s.addToast("🍗 You're getting hungry — eat something");
          sfx.error();
        }
        if (prevHunger > 0 && hunger <= 0) {
          s.addToast("💀 You're starving! HP is draining");
          sfx.error();
        }
        if (starving) {
          hp -= dt * 1.2;
        }

        // infection slowly eats away at you
        if (s.infected) {
          hp -= dt * 0.8;
        }
        if (hp <= 0) {
          set({ energy, hunger });
          get().hurt(2); // triggers the blackout flow
          return;
        }
        if (
          Math.abs(energy - s.energy) > 0.01 ||
          Math.abs(hp - s.hp) > 0.01 ||
          Math.abs(hunger - s.hunger) > 0.01
        ) {
          set({ energy, hp, hunger });
        }
      },

      setOpenShop: (id) => {
        sfx.ui();
        set({ openShop: id, openPanel: null, homeOffer: null, showQuests: false, showHelp: false });
      },
      setOpenPanel: (p) => {
        sfx.ui();
        set({ openPanel: p, openShop: null, homeOffer: null, showQuests: false, showHelp: false });
      },
      setHomeOffer: (o) => {
        sfx.ui();
        set({ homeOffer: o, openShop: null, openPanel: null, showQuests: false, showHelp: false });
      },
      toggleQuests: () => {
        sfx.ui();
        set((s) => ({ showQuests: !s.showQuests, openShop: null, openPanel: null, homeOffer: null, showHelp: false }));
      },
      toggleHelp: () => {
        sfx.ui();
        set((s) => ({ showHelp: !s.showHelp, openShop: null, openPanel: null, homeOffer: null, showQuests: false }));
      },
      toggleMute: () => {
        const muted = !get().muted;
        sfx.muted = muted;
        set({ muted });
      },
      closeModals: () =>
        set({ openShop: null, openPanel: null, homeOffer: null, buildMode: null, showQuests: false, showHelp: false }),
    }),
    {
      name: "wildwood-save-v7",
      partialize: (s) => ({
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
        pickaxe: s.pickaxe,
        heldTorch: s.heldTorch,
        weapon: s.weapon,
        armor: s.armor,
        shirt: s.shirt,
        ownedShirts: s.ownedShirts,
        hat: s.hat,
        ownedHats: s.ownedHats,
        appearance: s.appearance,
        infected: s.infected,
        inventory: s.inventory,
        quests: s.quests,
        acceptedOffers: s.acceptedOffers,
        homeTier: s.homeTier,
        chest: s.chest,
        farm: s.farm,
        dog: s.dog,
        coop: s.coop,
        structures: s.structures,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) sfx.muted = state.muted;
      },
    }
  )
);
