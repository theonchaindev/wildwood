// Mutable per-frame state shared between the 3D scene and the HUD without
// going through React re-renders.

export const live = { x: 0, z: 0, rot: 0, moving: false };

export const moveTarget = { x: 0, z: 0, active: false, setAt: 0 };

export const chop = { progress: 0, chopping: false };

export const mine = { progress: 0, mining: false };

// 0 = midnight, 0.5 = noon
export const clock = { timeOfDay: 0.42, day: 1 };

// Minecraft pacing: a full day/night cycle is 20 real minutes
export const DAY_LENGTH_S = 1200;

// zombies are out while daylight() < 0.22, which is roughly t in (0.75, 0.25)
const NIGHT_START = 0.75;
const NIGHT_END = 0.25;

/** 0..1 daylight factor for the current time of day. */
export function daylight() {
  const sun = Math.sin((clock.timeOfDay - 0.25) * Math.PI * 2);
  return Math.min(1, Math.max(0, (sun + 0.25) / 1.1));
}

export function isNight() {
  return daylight() < 0.22;
}

/** Every 5th night the blood moon rises: more, faster, tougher zombies. */
export function isBloodMoonNight() {
  return isNight() && clock.day % 5 === 0;
}

/** Seconds of game time until the zombies come out. */
export function secondsToNight() {
  return ((NIGHT_START - clock.timeOfDay + 1) % 1) * DAY_LENGTH_S;
}

/** Seconds of game time until dawn clears the zombies. */
export function secondsToDawn() {
  return ((NIGHT_END - clock.timeOfDay + 1) % 1) * DAY_LENGTH_S;
}

// fishing cast state (timestamps in ms; 0 = inactive)
export const fishing = { biteAt: 0, biteUntil: 0 };

export const lastWater = { at: 0 };

// set pending=true to teleport the player next frame (used on death)
export const teleport = { x: 0, z: 0, pending: false };

// when the intro tutorial is panning the camera, the player stops driving it
export const tour = { active: false };

export type ZombieType = "walker" | "runner" | "brute" | "boss" | "skeleton";

/** Every 10th night the Butcher walks. */
export function isBossNight() {
  return clock.day % 10 === 0;
}

// ---- weather ----

export type WeatherKind = "clear" | "rain" | "storm" | "fog";
export const weather = { kind: "clear" as WeatherKind, until: 0, flash: 0 };

export function isRaining() {
  return weather.kind === "rain" || weather.kind === "storm";
}
export function isStorm() {
  return weather.kind === "storm";
}
export function isFoggy() {
  return weather.kind === "fog";
}

// 0 = balmy, 1 = bitter. Storms chill you; rain less so; winter nights bite,
// summer days never. Drives the "Freezing" status and energy drain.
export function coldLevel() {
  let c = 0;
  if (weather.kind === "storm") c += 0.7;
  else if (weather.kind === "rain") c += 0.3;
  else if (weather.kind === "fog") c += 0.15;
  const season = seasonFor(clock.day).name;
  if (season === "Winter") c += 0.45;
  else if (season === "Autumn") c += 0.15;
  else if (season === "Summer") c -= 0.25;
  if (isNight()) c += 0.25; // it's colder after dark
  return Math.max(0, Math.min(1, c));
}

// ---- seasons: one week of game days each ----

const SEASONS = [
  { name: "Spring", icon: "🌸" },
  { name: "Summer", icon: "☀️" },
  { name: "Autumn", icon: "🍂" },
  { name: "Winter", icon: "❄️" },
];

export function seasonFor(day: number) {
  return SEASONS[Math.floor((day - 1) / 7) % 4];
}

export type Zombie = {
  id: number;
  type: ZombieType;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  rot: number;
  state: "roam" | "chase" | "dying";
  dieAt: number;
  targetX: number;
  targetZ: number;
  think: number;
  attackCd: number;
  flinchAt: number;
};

export const zombies: Zombie[] = [];
export const zombieSeq = { n: 0 };

export type Animal = {
  id: string;
  kind: "chicken" | "boar" | "rabbit" | "deer";
  homeX: number;
  homeZ: number;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  rot: number;
  state: "wander" | "flee" | "stun" | "enrage" | "dead";
  stateUntil: number;
  respawnAt: number;
  targetX: number;
  targetZ: number;
  think: number;
  attackCd: number;
  flinchAt: number;
};

export const animals: Animal[] = [];

export function timePhase(): string {
  const t = clock.timeOfDay;
  if (t < 0.2 || t >= 0.87) return "Night";
  if (t < 0.3) return "Dawn";
  if (t < 0.45) return "Morning";
  if (t < 0.6) return "Midday";
  if (t < 0.74) return "Afternoon";
  return "Dusk";
}
