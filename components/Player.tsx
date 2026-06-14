"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame, collectibleRespawnMs, Interact, WeaponTier } from "@/lib/store";
import { useModel } from "@/lib/assets";
import { live, moveTarget, chop, mine, fishing, teleport, zombies, animals, daylight, isRaining, tour } from "@/lib/runtime";
import { sfx } from "@/lib/sound";
import {
  COLLECTIBLES, CAMPFIRE_POS, BUILDINGS, GLADE_RADIUS, RIVER_X, RIVER_WIDTH, riverCenterX,
  TREES, ROCKS, HOME_PORTAL_POS, HOME_CHEST_POS, HOME_FURNACE_POS,
  HOME_EXTEND_POS, HOME_CABIN_POS, HOME_WELL_POS, HOME_POND_POS, POND_R,
  ORCHARD_SPOTS, HIVE_SPOTS, PEN_SPOTS, pensAllowed, HOME_TIERS, homeTierDef,
  homeGateZ, zoneAt, resolveMovement, resolveHomeMovement, bridgeY,
  interiorDims, interiorLayout, resolveInteriorMovement,
  CAVE_ORES, CAVE_HD, CAVE_ENTRANCE_POS, resolveCaveMovement, HOME_BENCH_POS,
  NOTICE_BOARD_POS, LAKE_POS, LAKE_R,
} from "@/lib/world";
import HitPop from "./HitPop";
import CharacterModel, { Motion } from "./CharacterModel";
import { onAnimalHit } from "./Animals";

// screen-relative WASD axes for the fixed isometric camera angle
const FORWARD = new THREE.Vector3(-1, 0, -1).normalize();
const RIGHT = new THREE.Vector3(1, 0, -1).normalize();

const CAM_OFFSET = new THREE.Vector3(16, 22, 16);
const INTERIOR_CAM_OFFSET = new THREE.Vector3(6.5, 8.5, 6.5);

const TREE_MAP = new Map(TREES.map((t) => [t.id, t]));
const ROCK_MAP = new Map(ROCKS.map((r) => [r.id, r]));
const ORE_MAP = new Map(CAVE_ORES.map((o) => [o.id, { id: o.id, pos: o.pos, r: o.r }]));

// E with nothing to interact with → auto-target the nearest gatherable and
// walk to it (so you don't have to click moving trees/ore nodes)
function gatherNearest() {
  const s = useGame.getState();
  const loc = s.location;
  if (loc === "interior" || loc === "visit") return;
  let bestId: string | null = null;
  let bestKind: "chop" | "mine" = "chop";
  let bestD = Infinity;
  const consider = (id: string, pos: [number, number, number], kind: "chop" | "mine") => {
    const d = Math.hypot(pos[0] - live.x, pos[2] - live.z);
    if (d < bestD) { bestD = d; bestId = id; bestKind = kind; }
  };
  if (loc === "cave") {
    for (const o of CAVE_ORES) if (!s.minedAt[o.id]) consider(o.id, o.pos, "mine");
  } else {
    for (const t of TREES) if (!s.choppedAt[t.id]) consider(t.id, t.pos, "chop");
    for (const r of ROCKS) if (!s.minedAt[r.id]) consider(r.id, r.pos, "mine");
  }
  if (bestId === null || bestD > 26) {
    s.addToast(loc === "cave" ? "No ore nearby ⛏️" : "Nothing to gather nearby 🌲");
    return;
  }
  if (bestKind === "chop") s.setChopTarget(bestId);
  else s.setMineTarget(bestId);
}

// Q → auto-target the nearest enemy (zombie, else huntable animal) and close in
function attackNearest() {
  const s = useGame.getState();
  const canFight = s.location === "forest" || s.location === "cave";
  if (!canFight) { s.addToast("Nothing to fight here ⚔️"); return; }
  let bestZ: (typeof zombies)[number] | null = null;
  let bestZD = Infinity;
  for (const z of zombies) {
    if (z.state === "dying") continue;
    const d = Math.hypot(z.x - live.x, z.z - live.z);
    if (d < bestZD) { bestZD = d; bestZ = z; }
  }
  if (bestZ && bestZD <= 28) { s.setAttackTarget(bestZ.id); return; }
  let bestA: (typeof animals)[number] | null = null;
  let bestAD = Infinity;
  for (const a of animals) {
    if (a.state === "dead") continue;
    const d = Math.hypot(a.x - live.x, a.z - live.z);
    if (d < bestAD) { bestAD = d; bestA = a; }
  }
  if (bestA && bestAD <= 24) s.setAnimalTarget(bestA.id);
  else s.addToast("No enemies nearby");
}

function HeldTorch() {
  const lightRef = useRef<THREE.PointLight>(null);
  const flameRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const night = 1 - daylight();
    if (lightRef.current) {
      lightRef.current.intensity = night * (5 + Math.sin(clock.elapsedTime * 11) * 1.2);
    }
    if (flameRef.current) {
      flameRef.current.visible = night > 0.15;
      flameRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 9) * 0.15);
    }
  });
  return (
    <group position={[-0.38, 0.55, 0.22]} rotation={[0.35, 0, -0.2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.5, 6]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
      <mesh ref={flameRef} position={[0, 0.32, 0]}>
        <coneGeometry args={[0.08, 0.22, 6]} />
        <meshBasicMaterial color="#ffc23d" />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.45, 0]} color="#ffb04a" distance={9} decay={2} />
    </group>
  );
}

const WEAPON_TEX = "/models/weapons/weapons-atlas.png";

// each weapon's model, target length, and in-hand rotation/offset; tuned so the
// grip sits at the hand and the blade points up out of the fist
const WEAPON_MODELS: Record<WeaponTier, { file: string; len: number; rot: [number, number, number]; lift: number }> = {
  club: { file: "Hammer_01", len: 1.0, rot: [0.2, 0, 0], lift: 0.42 },
  spear: { file: "Spear_02", len: 1.9, rot: [0.2, 0, 0], lift: 0.78 },
  sword: { file: "Sword_03", len: 1.3, rot: [0.2, 0, 0], lift: 0.55 },
  waraxe: { file: "Ax_05", len: 1.15, rot: [0.2, 0, 0], lift: 0.48 },
  warhammer: { file: "Hammer_06", len: 1.2, rot: [0.2, 0, 0], lift: 0.5 },
  diamond: { file: "Sword_09", len: 1.35, rot: [0.2, 0, 0], lift: 0.57 },
};

function HeldWeapon({ weapon }: { weapon: WeaponTier }) {
  const def = WEAPON_MODELS[weapon];
  const proto = useModel(`weapons/${def.file}`, def.len, "max", "center", WEAPON_TEX);
  const instance = useMemo(() => proto.clone(true), [proto]);
  return <primitive object={instance} position={[0, def.lift, 0]} rotation={def.rot} />;
}

function BoatMesh() {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    // only show the boat when you're actually over water
    const onRiver = Math.abs(live.x - riverCenterX(live.z)) < RIVER_WIDTH / 2 + 0.6;
    const onLake = Math.hypot(live.x - LAKE_POS[0], live.z - LAKE_POS[2]) < LAKE_R + 0.6;
    ref.current.visible = onRiver || onLake;
  });
  return (
    <group ref={ref} position={[0, 0.05, 0]}>
      {/* hull */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.9, 0.28, 1.5]} />
        <meshStandardMaterial color="#7a5a33" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0.86]} rotation={[0, 0, 0]} castShadow>
        <coneGeometry args={[0.45, 0.5, 4]} />
        <meshStandardMaterial color="#6b4e2a" roughness={1} />
      </mesh>
      {/* inner trim */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.66, 0.06, 1.2]} />
        <meshStandardMaterial color="#5e4426" roughness={1} />
      </mesh>
    </group>
  );
}

function HorseMesh({ motion }: { motion: Motion }) {
  const legRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const headRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    legRefs.current.forEach((leg, i) => {
      if (!leg) return;
      leg.rotation.x = motion.moving ? Math.sin(motion.phase + (i % 2 === 0 ? 0 : Math.PI)) * 0.55 : 0;
    });
    if (headRef.current) {
      headRef.current.rotation.x = motion.moving
        ? Math.sin(motion.phase * 0.5) * 0.06
        : Math.sin(clock.elapsedTime * 0.8) * 0.05;
    }
  });
  return (
    <group>
      {/* body */}
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[0.55, 0.5, 1.35]} />
        <meshStandardMaterial color="#7a4f2a" roughness={1} />
      </mesh>
      {/* neck + head */}
      <group ref={headRef} position={[0, 1.05, 0.62]}>
        <mesh position={[0, 0.22, 0.1]} rotation={[0.5, 0, 0]} castShadow>
          <boxGeometry args={[0.26, 0.6, 0.3]} />
          <meshStandardMaterial color="#6e4624" roughness={1} />
        </mesh>
        <mesh position={[0, 0.52, 0.35]} castShadow>
          <boxGeometry args={[0.24, 0.26, 0.5]} />
          <meshStandardMaterial color="#7a4f2a" roughness={1} />
        </mesh>
        {[-0.07, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.7, 0.2]}>
            <coneGeometry args={[0.045, 0.12, 4]} />
            <meshStandardMaterial color="#6e4624" roughness={1} />
          </mesh>
        ))}
        <mesh position={[0, 0.42, 0.02]} castShadow>
          <boxGeometry args={[0.1, 0.5, 0.18]} />
          <meshStandardMaterial color="#3d2a16" roughness={1} />
        </mesh>
      </group>
      {/* tail */}
      <mesh position={[0, 0.78, -0.75]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.1, 0.5, 0.12]} />
        <meshStandardMaterial color="#3d2a16" roughness={1} />
      </mesh>
      {/* saddle */}
      <mesh position={[0, 1.06, -0.05]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.5]} />
        <meshStandardMaterial color="#9c2f2f" roughness={1} />
      </mesh>
      {/* legs */}
      {([[-0.18, 0.5], [0.18, 0.5], [-0.18, -0.5], [0.18, -0.5]] as const).map(([x, z], i) => (
        <mesh
          key={i}
          ref={(el) => { legRefs.current[i] = el; }}
          position={[x, 0.28, z]}
          castShadow
        >
          <boxGeometry args={[0.13, 0.56, 0.13]} />
          <meshStandardMaterial color="#6e4624" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export default function Player() {
  const group = useRef<THREE.Group>(null);
  const keys = useRef<Record<string, boolean>>({});
  const tickAccum = useRef(0);
  const walkPhase = useRef(0);
  const swingAccum = useRef(0);
  const toolRef = useRef<THREE.Group>(null); // right hand: axe / rod-in-use
  const weaponRef = useRef<THREE.Group>(null); // left hand: combat weapon
  const { camera } = useThree();
  const level = useGame((s) => s.level);
  const name = useGame((s) => s.name);
  const axe = useGame((s) => s.axe);
  const rod = useGame((s) => s.rod);
  const weapon = useGame((s) => s.weapon);
  const armor = useGame((s) => s.armor);
  const shirt = useGame((s) => s.shirt);
  const hat = useGame((s) => s.hat);
  const fishingState = useGame((s) => s.fishingState);
  const mineTargetId = useGame((s) => s.mineTargetId);
  const pickaxe = useGame((s) => s.pickaxe);
  const heldTorch = useGame((s) => s.heldTorch);
  const hurtAt = useGame((s) => s.hurtAt);
  const lastPlayerHit = useGame((s) => s.lastPlayerHit);
  const hp = useGame((s) => s.hp);
  const maxHp = useGame((s) => s.maxHp);
  const [showHpBar, setShowHpBar] = useState(false);

  useEffect(() => {
    if (!hurtAt) return;
    setShowHpBar(true);
    const t = setTimeout(() => setShowHpBar(false), 4000);
    return () => clearTimeout(t);
  }, [hurtAt]);

  const appearance = useGame((s) => s.appearance);
  const motion = useRef<Motion>({ phase: 0, moving: false }).current;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (k === "e") {
        const s = useGame.getState();
        if (s.openShop || s.openPanel || s.homeOffer) {
          s.closeModals();
        } else if (s.nearInteract) {
          const i = s.nearInteract;
          if (i.kind === "shop") s.setOpenShop(i.id);
          else if (i.kind === "chest") s.station("chest");
          else if (i.kind === "furnace") s.station("furnace");
          else if (i.kind === "portal") {
            if (s.homeTier > 0) s.travel("home");
            else s.setHomeOffer("buy");
          } else if (i.kind === "homegate") s.travel("forest");
          else if (i.kind === "extend") s.setHomeOffer("extend");
          else if (i.kind === "pen") s.setOpenPen(i.idx);
          else if (i.kind === "house") s.houseStation();
          else if (i.kind === "bed") s.sleepTillDawn();
          else if (i.kind === "desk") s.setOpenPanel("house");
          else if (i.kind === "exitdoor") s.exitHouse();
          else if (i.kind === "well") s.collectWater();
          else if (i.kind === "orchard") {
            if (s.orchard[i.idx]) s.collectOrchard(i.idx);
            else s.plantOrchardTree(i.idx);
          } else if (i.kind === "hive") {
            if (s.hives[i.idx]) s.collectHive(i.idx);
            else s.buildHive(i.idx);
          } else if (i.kind === "notice") s.toggleNotice();
          else if (i.kind === "cave") s.enterCave();
          else if (i.kind === "caveexit") s.exitCave();
          else if (i.kind === "bench") s.station("bench");
        } else {
          // nothing to interact with — go gather the nearest tree/ore
          gatherNearest();
        }
      }
      if (k === "q") {
        const s = useGame.getState();
        if (!s.openShop && !s.openPanel && !s.homeOffer) attackNearest();
      }
      if (k === "i" || k === "b") {
        useGame.getState().toggleInventory();
      }
      if (k === "h") {
        useGame.getState().toggleMount();
      }
      if (k === "f") {
        const s = useGame.getState();
        if (s.fishingState === "bite") {
          // the minigame: hook it while the marker swings through the green
          const m = Math.sin((Date.now() - fishing.biteAt) / 220);
          const zoneHalf = 0.22 + 0.05 * s.skills.angling;
          if (Math.abs(m) <= zoneHalf) {
            s.catchFish();
            sfx.splash();
          } else {
            s.setFishingState("idle");
            fishing.biteAt = 0;
            s.addToast("💨 It wriggled free!");
            sfx.error();
          }
        } else if (s.fishingState === "waiting") {
          s.setFishingState("idle");
          fishing.biteAt = 0;
        } else if (s.nearWater) {
          if (!s.rod) {
            s.addToast("You need a Fishing Rod — sold at The Den 🎣");
          } else {
            s.setFishingState("waiting");
            // bites come sooner with the Angling skill, and sooner still in the rain
            const wait = (2500 + Math.random() * 4000) * (1 - 0.1 * s.skills.angling) * (isRaining() ? 0.7 : 1);
            fishing.biteAt = Date.now() + wait;
            sfx.splash();
          }
        }
      }
    };
    const up = (e: KeyboardEvent) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = group.current;
    if (!g) return;
    const state = useGame.getState();
    if (!state.started) {
      // cinematic orbit for the intro screen and spectator mode
      const t = performance.now() / 1000;
      const r = state.spectator ? 30 : 26;
      camera.position.lerp(
        new THREE.Vector3(Math.cos(t * 0.06) * r, state.spectator ? 18 : 22, Math.sin(t * 0.06) * r),
        Math.min(1, dt * 2)
      );
      camera.lookAt(0, 1, 0);
      return;
    }

    // pending death teleport
    if (teleport.pending) {
      teleport.pending = false;
      g.position.set(teleport.x, 0, teleport.z);
      moveTarget.active = false;
    }

    // --- input ---
    const dir = new THREE.Vector3();
    const k = keys.current;
    if (k["w"] || k["arrowup"]) dir.add(FORWARD);
    if (k["s"] || k["arrowdown"]) dir.sub(FORWARD);
    if (k["d"] || k["arrowright"]) dir.add(RIGHT);
    if (k["a"] || k["arrowleft"]) dir.sub(RIGHT);
    const keyboardMove = dir.lengthSq() > 0;

    if (keyboardMove) {
      moveTarget.active = false;
      if (state.chopTargetId) state.setChopTarget(null);
      if (state.mineTargetId) state.setMineTarget(null);
      if (state.attackTargetId !== null) state.setAttackTarget(null);
      if (state.animalTargetId !== null) state.setAnimalTarget(null);
      if (state.fishingState !== "idle") state.setFishingState("idle");
      dir.normalize();
    }

    // fishing bite timing — the minigame bar needs a few swings' worth of time
    if (state.fishingState === "waiting" && fishing.biteAt && Date.now() > fishing.biteAt) {
      state.setFishingState("bite");
      fishing.biteAt = Date.now(); // marker oscillates from the moment of the bite
      fishing.biteUntil = Date.now() + 3400;
      sfx.splash();
    } else if (state.fishingState === "bite" && Date.now() > fishing.biteUntil) {
      state.setFishingState("idle");
      state.addToast("It got away…");
    }

    const faceToward = (dx: number, dz: number, rate: number) => {
      const targetRot = Math.atan2(dx, dz);
      g.rotation.y = THREE.MathUtils.lerp(
        g.rotation.y,
        g.rotation.y +
          THREE.MathUtils.euclideanModulo(targetRot - g.rotation.y + Math.PI, Math.PI * 2) -
          Math.PI,
        Math.min(1, dt * rate)
      );
    };

    const atHome = state.location !== "forest"; // own Base, visiting, indoors or underground
    const atInterior = state.location === "interior";
    const atCave = state.location === "cave";

    // --- zombie attack target: walk to it, then swing ---
    let attacking = false;
    const canFight = !atHome || atCave; // forest by night, the mine by torchlight
    const targetZombie =
      state.attackTargetId !== null && canFight
        ? zombies.find((zz) => zz.id === state.attackTargetId && zz.state !== "dying")
        : null;
    if (state.attackTargetId !== null && !targetZombie) state.setAttackTarget(null);
    if (targetZombie && !keyboardMove) {
      const profile = state.combatProfile();
      const dx = targetZombie.x - g.position.x;
      const dz = targetZombie.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > profile.reach) {
        dir.set(dx, 0, dz).normalize();
        moveTarget.active = false;
      } else {
        attacking = true;
        moveTarget.active = false;
        faceToward(dx, dz, 14);
        swingAccum.current += dt;
        if (swingAccum.current > profile.swing) {
          swingAccum.current = 0;
          const crit = Math.random() < profile.crit;
          const amount = crit ? profile.dmg * 2 : profile.dmg;
          if (crit) sfx.crit();
          else sfx.hit();
          targetZombie.hp -= amount;
          targetZombie.flinchAt = Date.now();
          state.registerHit(`z${targetZombie.id}`, amount, crit);
          // knockback away from the player
          if (dist > 0.01 && profile.knockback > 0) {
            const kx = targetZombie.x + (dx / dist) * profile.knockback;
            const kz = targetZombie.z + (dz / dist) * profile.knockback;
            [targetZombie.x, targetZombie.z] = resolveMovement(
              targetZombie.x, targetZombie.z, kx, kz, state.choppedAt
            );
          }
          if (targetZombie.hp <= 0) {
            targetZombie.state = "dying";
            targetZombie.dieAt = Date.now();
            state.zombieKilled(targetZombie.type === "boss");
          }
        }
      }
    }

    // --- animal hunting target ---
    const targetAnimal =
      state.animalTargetId !== null && !atHome
        ? animals.find((aa) => aa.id === state.animalTargetId && aa.state !== "dead")
        : null;
    if (state.animalTargetId !== null && !targetAnimal) state.setAnimalTarget(null);
    if (targetAnimal && !keyboardMove && !targetZombie) {
      const profile = state.combatProfile();
      const dx = targetAnimal.x - g.position.x;
      const dz = targetAnimal.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > profile.reach) {
        dir.set(dx, 0, dz).normalize();
        moveTarget.active = false;
      } else {
        attacking = true;
        moveTarget.active = false;
        faceToward(dx, dz, 14);
        swingAccum.current += dt;
        if (swingAccum.current > profile.swing) {
          swingAccum.current = 0;
          const crit = Math.random() < profile.crit;
          const amount = crit ? profile.dmg * 2 : profile.dmg;
          if (crit) sfx.crit();
          else sfx.hit();
          targetAnimal.hp -= amount;
          state.registerHit(`a${targetAnimal.id}`, amount, crit);
          onAnimalHit(targetAnimal);
        }
      }
    }

    // --- chopping target: walk to tree, then chop ---
    let chopping = false;
    const chopTree = state.chopTargetId ? TREE_MAP.get(state.chopTargetId) : null;
    if (chopTree && !keyboardMove && !attacking && !targetZombie && !targetAnimal) {
      if (state.choppedAt[chopTree.id]) {
        state.setChopTarget(null);
      } else {
        const dx = chopTree.pos[0] - g.position.x;
        const dz = chopTree.pos[2] - g.position.z;
        const dist = Math.hypot(dx, dz);
        const reach = chopTree.r + 2.0;
        if (dist > reach) {
          dir.set(dx, 0, dz).normalize();
          moveTarget.active = false;
        } else {
          chopping = true;
          moveTarget.active = false;
          faceToward(dx, dz, 14);
          const slow = state.energy < 5 ? 0.5 : 1;
          chop.progress += (dt / state.chopTime()) * slow;
          swingAccum.current += dt;
          if (swingAccum.current > 0.55) {
            swingAccum.current = 0;
            sfx.chop();
          }
          if (chop.progress >= 1) {
            chop.progress = 0;
            state.chopComplete(chopTree.id);
          }
        }
      }
    }
    if (!chopping && chop.progress > 0 && !state.chopTargetId) chop.progress = 0;
    chop.chopping = chopping;

    // --- mining target: walk to rock, then mine ---
    let mining = false;
    const mineRock = state.mineTargetId
      ? ROCK_MAP.get(state.mineTargetId) ?? ORE_MAP.get(state.mineTargetId)
      : null;
    if (mineRock && !keyboardMove && !attacking && !targetZombie && !targetAnimal && !chopping) {
      if (state.minedAt[mineRock.id]) {
        state.setMineTarget(null);
      } else {
        const dx = mineRock.pos[0] - g.position.x;
        const dz = mineRock.pos[2] - g.position.z;
        const dist = Math.hypot(dx, dz);
        const reach = mineRock.r + 2.0;
        if (dist > reach) {
          dir.set(dx, 0, dz).normalize();
          moveTarget.active = false;
        } else {
          mining = true;
          moveTarget.active = false;
          faceToward(dx, dz, 14);
          const slow = state.energy < 5 ? 0.5 : 1;
          mine.progress += (dt / state.mineTime()) * slow;
          swingAccum.current += dt;
          if (swingAccum.current > 0.6) {
            swingAccum.current = 0;
            sfx.hit();
          }
          if (mine.progress >= 1) {
            mine.progress = 0;
            state.mineComplete(mineRock.id);
          }
        }
      }
    }
    if (!mining && mine.progress > 0 && !state.mineTargetId) mine.progress = 0;
    mine.mining = mining;

    // click-to-move
    if (!keyboardMove && !chopTree && !mineRock && !targetZombie && !targetAnimal && moveTarget.active) {
      dir.set(moveTarget.x - g.position.x, 0, moveTarget.z - g.position.z);
      if (dir.length() < 0.3) {
        moveTarget.active = false;
        dir.set(0, 0, 0);
      } else {
        dir.normalize();
      }
    }

    const moving = dir.lengthSq() > 0 && !chopping && !mining && !attacking;
    if (moving && state.fishingState !== "idle") state.setFishingState("idle");
    const tired = state.energy <= 0;
    const sprinting = moving && !!k["shift"] && state.energy > 5;
    // working hands need solid ground — the horse waits while you act
    if (state.mounted && (chopping || mining || attacking || state.fishingState !== "idle")) {
      useGame.setState({ mounted: false });
    }
    const weedHigh = state.tripKind === "weed" && Date.now() < state.tripUntil;
    const speed = (tired ? 3.2 : state.mounted ? 11 : sprinting ? 9.5 : 6.5) * (weedHigh ? 0.82 : 1);

    if (moving) {
      const step = speed * dt;
      const homeTierHere =
        state.location === "visit" ? state.visitData?.homeTier ?? 1 : state.homeTier;
      const homeHouseHere =
        state.location === "visit" ? state.visitData?.houseLevel ?? 1 : state.houseLevel;
      const px0 = g.position.x;
      const pz0 = g.position.z;
      const resolveAt = (nx: number, nz: number): [number, number] =>
        atCave
          ? resolveCaveMovement(px0, pz0, nx, nz, state.minedAt)
          : atInterior
          ? resolveInteriorMovement(px0, pz0, nx, nz, homeHouseHere)
          : atHome
          ? resolveHomeMovement(px0, pz0, nx, nz, homeTierHere, homeHouseHere)
          : resolveMovement(px0, pz0, nx, nz, state.choppedAt, state.minedAt, state.boat);

      // click-to-move steers around obstacles: try the straight line first,
      // and if it's blocked fan out to either side and take the clearest angle
      const baseAng = Math.atan2(dir.x, dir.z);
      const offsets = moveTarget.active && !keyboardMove
        ? [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]
        : [0];
      let bx = px0, bz = pz0, bestProg = -Infinity, bAng = baseAng;
      for (const off of offsets) {
        const a = baseAng + off;
        const [rx, rz] = resolveAt(px0 + Math.sin(a) * step, pz0 + Math.cos(a) * step);
        const prog = (rx - px0) * dir.x + (rz - pz0) * dir.z; // progress toward the goal
        if (prog > bestProg) { bestProg = prog; bx = rx; bz = rz; bAng = a; }
        if (off === 0 && prog > step * 0.7) break; // straight path clear — take it
      }
      g.position.x = bx;
      g.position.z = bz;
      faceToward(Math.sin(bAng), Math.cos(bAng), 12);
      walkPhase.current += dt * (sprinting ? 14 : 10);
    }

    // height: bridge deck + walk bob
    const baseY = atHome ? 0 : bridgeY(g.position.x, g.position.z);
    const bob = moving ? Math.abs(Math.sin(walkPhase.current)) * 0.08 : 0;
    g.position.y = THREE.MathUtils.lerp(g.position.y, baseY + bob, Math.min(1, dt * 10));

    // swing animations
    if (toolRef.current) {
      if (chopping || mining) {
        toolRef.current.rotation.x = -0.6 + Math.sin(performance.now() / 88) * 0.85;
      } else {
        toolRef.current.rotation.x = THREE.MathUtils.lerp(toolRef.current.rotation.x, 0, dt * 8);
      }
    }
    if (weaponRef.current) {
      if (attacking) {
        weaponRef.current.rotation.x = -0.7 + Math.sin(performance.now() / 80) * 0.95;
      } else {
        weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, dt * 8);
      }
    }

    live.x = g.position.x;
    live.z = g.position.z;
    live.rot = g.rotation.y;
    live.moving = moving;
    motion.phase = walkPhase.current;
    motion.moving = moving;

    // --- camera follow (pulled in close indoors so the room fills the screen) ---
    // …unless the welcome tour is driving the camera
    if (tour.active) return;
    const desired = g.position.clone().add(atInterior ? INTERIOR_CAM_OFFSET : CAM_OFFSET);
    camera.position.lerp(desired, Math.min(1, dt * 4));

    // altered states bend the camera itself: shrooms spin the world right
    // round, weed sways it like a hammock. Raycasts stay accurate because
    // it's the camera moving, not the pixels.
    const tripping = state.tripKind && Date.now() < state.tripUntil ? state.tripKind : null;
    const cam = camera as THREE.PerspectiveCamera;
    if (tripping === "shroom") {
      const t = performance.now() / 1000;
      const roll = t * 0.45 + Math.sin(t * 0.7) * 0.25;
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      cam.fov = 38 + Math.sin(t * 0.9) * 8;
      cam.updateProjectionMatrix();
    } else if (tripping === "weed") {
      const t = performance.now() / 1000;
      const roll = Math.sin(t * 0.45) * 0.07;
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      if (cam.fov !== 40) {
        cam.fov = 40; // a lazy, heavy-lidded zoom
        cam.updateProjectionMatrix();
      }
    } else if (camera.up.x !== 0 || cam.fov !== 38) {
      camera.up.set(0, 1, 0);
      cam.fov = 38;
      cam.updateProjectionMatrix();
    }
    camera.lookAt(g.position.x, g.position.y + 0.8, g.position.z);

    // --- throttled game logic (5x / second) ---
    tickAccum.current += dt;
    if (tickAccum.current < 0.2) return;
    const stepDt = tickAccum.current;
    tickAccum.current = 0;

    const px = g.position.x;
    const pz = g.position.z;

    if (atCave) {
      state.tick(stepDt, moving, false, sprinting, mining);
      state.setNearWater(false);
      const exitD = Math.hypot(px - 0, pz - CAVE_HD);
      state.setNearInteract(exitD < 3.4 ? { kind: "caveexit" } : null);
      return;
    }

    if (atInterior) {
      // home sweet home: resting indoors slowly restores you, like the campfire
      state.tick(stepDt, moving, true, sprinting, false);
      state.setNearWater(false);
      const visitingIn = !!state.visitData;
      const lvIn = visitingIn ? state.visitData?.houseLevel ?? 1 : state.houseLevel;
      const lay = interiorLayout(lvIn);
      const { hd } = interiorDims(lvIn);
      let nearest: Interact | null = null;
      let nearestD = 2.6;
      const spots: [number, number, Interact][] = visitingIn
        ? [[0, hd, { kind: "exitdoor" }]]
        : [
            [lay.bed[0], lay.bed[1], { kind: "bed" }],
            [lay.desk[0], lay.desk[1], { kind: "desk" }],
            [lay.chest[0], lay.chest[1], { kind: "chest" }],
            [0, hd, { kind: "exitdoor" }],
          ];
      for (const [sx, sz, interact] of spots) {
        const d = Math.hypot(px - sx, pz - sz);
        if (d < nearestD) {
          nearestD = d;
          nearest = interact;
        }
      }
      state.setNearInteract(nearest);
      return;
    }

    if (atHome) {
      // peaceful instance: no zombies, foraging or quest triggers
      state.tick(stepDt, moving, false, sprinting, chopping || mining || attacking);
      const visiting = state.location === "visit";
      const tierHere = visiting ? state.visitData?.homeTier ?? 1 : state.homeTier;
      const tierDef = homeTierDef(tierHere);
      // the estate pond is fishable water
      state.setNearWater(
        tierDef.pond && Math.hypot(px - HOME_POND_POS[0], pz - HOME_POND_POS[2]) < POND_R + 2.5
      );
      let nearest: Interact | null = null;
      let nearestD = 3.4;
      const gateZ = homeGateZ(tierHere);
      const spots: [number, number, Interact][] = visiting
        ? [
            [0, gateZ, { kind: "homegate" }],
            [HOME_CABIN_POS[0], HOME_CABIN_POS[2] + 2, { kind: "house" }],
          ]
        : [
            [HOME_CHEST_POS[0], HOME_CHEST_POS[2], { kind: "chest" }],
            [HOME_FURNACE_POS[0], HOME_FURNACE_POS[2], { kind: "furnace" }],
            [HOME_BENCH_POS[0], HOME_BENCH_POS[2], { kind: "bench" }],
            [HOME_CABIN_POS[0], HOME_CABIN_POS[2] + 2, { kind: "house" }],
            [0, gateZ, { kind: "homegate" }],
          ];
      if (!visiting) {
        PEN_SPOTS.slice(0, pensAllowed(state.homeTier)).forEach(([px2, pz2], idx) => {
          spots.push([px2, pz2, { kind: "pen", idx }]);
        });
        ORCHARD_SPOTS.slice(0, tierDef.orchard).forEach(([px2, pz2], idx) => {
          spots.push([px2, pz2, { kind: "orchard", idx }]);
        });
        HIVE_SPOTS.slice(0, tierDef.hives).forEach(([px2, pz2], idx) => {
          spots.push([px2, pz2, { kind: "hive", idx }]);
        });
        if (tierDef.well) {
          spots.push([HOME_WELL_POS[0], HOME_WELL_POS[2], { kind: "well" }]);
        }
        if (state.homeTier < HOME_TIERS.length) {
          spots.push([HOME_EXTEND_POS[0], HOME_EXTEND_POS[2], { kind: "extend" }]);
        }
      }
      for (const [sx, sz, interact] of spots) {
        const d = Math.hypot(px - sx, pz - sz);
        if (d < nearestD) {
          nearestD = d;
          nearest = interact;
        }
      }
      state.setNearInteract(nearest);
      return;
    }

    const distCamp = Math.hypot(px - CAMPFIRE_POS[0], pz - CAMPFIRE_POS[2]);

    state.tick(stepDt, moving, distCamp < 4, sprinting, chopping || mining || attacking);
    state.setZone(zoneAt(px, pz));

    // nearest interactable within range
    let nearest: Interact | null = null;
    let nearestD = 4.2;
    for (const b of BUILDINGS) {
      const d = Math.hypot(px - b.pos[0], pz - b.pos[2]);
      if (d < nearestD) {
        nearestD = d;
        nearest = { kind: "shop", id: b.id };
      }
    }
    const portalD = Math.hypot(px - HOME_PORTAL_POS[0], pz - HOME_PORTAL_POS[2]);
    if (portalD < nearestD) {
      nearestD = portalD;
      nearest = { kind: "portal" };
    }
    const caveD = Math.hypot(px - CAVE_ENTRANCE_POS[0], pz - (CAVE_ENTRANCE_POS[2] + 1.6));
    if (caveD < nearestD) {
      nearestD = caveD;
      nearest = { kind: "cave" };
    }
    const noticeD = Math.hypot(px - NOTICE_BOARD_POS[0], pz - NOTICE_BOARD_POS[2]);
    if (noticeD < nearestD) {
      nearestD = noticeD;
      nearest = { kind: "notice" };
    }
    state.setNearInteract(nearest);

    const distRiver = Math.abs(px - riverCenterX(pz));
    const atRiver = distRiver > RIVER_WIDTH / 2 - 1 && distRiver < RIVER_WIDTH / 2 + 3.5;
    const distLake = Math.hypot(px - LAKE_POS[0], pz - LAKE_POS[2]);
    const atLake = distLake > LAKE_R - 1 && distLake < LAKE_R + 3.5;
    state.setNearWater(atRiver || atLake);

    // pick up nearby collectibles
    const now = Date.now();
    for (const c of COLLECTIBLES) {
      const at = state.collected[c.id];
      if (at && now - at < collectibleRespawnMs(c.kind)) continue;
      if (Math.hypot(px - c.pos[0], pz - c.pos[2]) < 2.2) {
        state.collectItem(c.id, c.label, c.kind);
      }
    }

    // quest triggers
    const active = state.quests.find((q) => !q.done);
    if (active?.id === "leave-glade" && Math.hypot(px, pz) > GLADE_RADIUS + 3) {
      state.questEvent("leave-glade");
    }
    if (active?.id === "cross-bridge" && px > riverCenterX(pz) + 5) {
      state.questEvent("cross-bridge");
    }
    if (active?.id === "return-camp" && distCamp < 4) {
      state.questEvent("return-camp");
    }
  });

  const showRodInHand = fishingState !== "idle";
  const mounted = useGame((s) => s.mounted);
  const boat = useGame((s) => s.boat);

  return (
    <group ref={group}>
      {mounted && <HorseMesh motion={motion} />}
      {boat && <BoatMesh />}
      <group position={[0, mounted ? 0.62 : 0, 0]}>
        <CharacterModel appearance={appearance} shirt={shirt} hat={hat} armor={armor} motion={motion} />
      </group>

      {/* right hand: axe (or pickaxe while mining), or the rod while fishing */}
      <group ref={toolRef} position={[0.42, 0.65, 0.14]}>
        {mineTargetId && pickaxe && !showRodInHand && (
          <>
            <mesh position={[0, 0.25, 0]} rotation={[0.2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.55, 6]} />
              <meshStandardMaterial color="#6b4e2a" roughness={1} />
            </mesh>
            <mesh position={[0, 0.52, 0.04]} rotation={[0.55, 0, 0]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.4]} />
              <meshStandardMaterial color="#8a8f95" metalness={0.6} roughness={0.35} />
            </mesh>
          </>
        )}
        {axe && !showRodInHand && !(mineTargetId && pickaxe) && (
          <>
            <mesh position={[0, 0.25, 0]} rotation={[0.2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.55, 6]} />
              <meshStandardMaterial color="#6b4e2a" roughness={1} />
            </mesh>
            <mesh position={[0.02, 0.5, 0.06]} rotation={[0.2, 0, Math.PI / 2]} castShadow>
              <boxGeometry args={[0.16, 0.06, 0.2]} />
              <meshStandardMaterial
                color={axe === "golden" ? "#e8b53a" : "#9aa0a6"}
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>
          </>
        )}
        {showRodInHand && (
          <mesh position={[0, 0.4, 0.3]} rotation={[0.9, 0, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.03, 1.3, 6]} />
            <meshStandardMaterial color="#7a5a33" roughness={1} />
          </mesh>
        )}
      </group>

      {/* hand torch: carried on the hip, lights itself after dark */}
      {heldTorch && <HeldTorch />}

      {/* rod carried on the back when not in use */}
      {rod && !showRodInHand && (
        <mesh position={[-0.1, 0.95, -0.2]} rotation={[0, 0, 0.7]} castShadow>
          <cylinderGeometry args={[0.02, 0.03, 1.25, 6]} />
          <meshStandardMaterial color="#7a5a33" roughness={1} />
        </mesh>
      )}

      {/* left hand: combat weapon */}
      <group ref={weaponRef} position={[-0.42, 0.68, 0.12]}>
        {weapon && <HeldWeapon weapon={weapon} />}
      </group>

      <Html position={[0, 2.05, 0]} center distanceFactor={26} zIndexRange={[10, 0]}>
        <div className="player-label-stack">
          <div className="player-label">{name || "Wanderer"} · Lv {level}</div>
          {showHpBar && (
            <div className="overhead-hp">
              <div className="overhead-hp-fill" style={{ width: `${Math.max(0, (hp / maxHp) * 100)}%` }} />
            </div>
          )}
        </div>
      </Html>
      {lastPlayerHit && (
        <HitPop at={lastPlayerHit.at} text={`−${lastPlayerHit.amount}`} position={[0.4, 1.9, 0]} />
      )}
      {fishingState !== "idle" && (
        <Html position={[0, 2.6, 0]} center distanceFactor={24} zIndexRange={[16, 0]}>
          <div className={`fish-indicator ${fishingState === "bite" ? "bite" : ""}`}>
            {fishingState === "bite" ? "❗ F!" : "🎣 …"}
          </div>
        </Html>
      )}
    </group>
  );
}
