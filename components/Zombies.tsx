"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { live, daylight, zombies, zombieSeq, Zombie, ZombieType, isBloodMoonNight } from "@/lib/runtime";
import { resolveMovement, GLADE_RADIUS, RIVER_X } from "@/lib/world";
import { sfx } from "@/lib/sound";
import HitPop from "./HitPop";

const NIGHT_THRESHOLD = 0.22;
const ATTACK_RANGE = 1.5;

export const ZOMBIE_TYPES: Record<ZombieType, {
  hp: number; dmg: number; speed: number; chase: number; scale: number; skin: string; shirt: string;
}> = {
  walker: { hp: 30, dmg: 8, speed: 2.9, chase: 13, scale: 1, skin: "#7fa05a", shirt: "#4a4452" },
  runner: { hp: 18, dmg: 6, speed: 4.8, chase: 18, scale: 0.85, skin: "#9ab05a", shirt: "#5a3a3a" },
  brute: { hp: 70, dmg: 16, speed: 1.7, chase: 13, scale: 1.4, skin: "#5a7a45", shirt: "#33333b" },
};

function rollType(blood: boolean): ZombieType {
  const r = Math.random() * 100;
  if (blood) return r < 40 ? "walker" : r < 75 ? "runner" : "brute";
  return r < 60 ? "walker" : r < 90 ? "runner" : "brute";
}

function spawnZombie(blood: boolean): Zombie | null {
  for (let tries = 0; tries < 8; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = 16 + Math.random() * 16;
    const x = live.x + Math.cos(a) * d;
    const z = live.z + Math.sin(a) * d;
    if (Math.abs(x) > 64 || Math.abs(z) > 64) continue;
    if (Math.hypot(x, z) < GLADE_RADIUS + 3) continue; // the fence keeps camp safe
    if (Math.abs(x - RIVER_X) < 6) continue;
    const type = rollType(blood);
    const def = ZOMBIE_TYPES[type];
    return {
      id: ++zombieSeq.n,
      type,
      x, z,
      hp: def.hp, maxHp: def.hp,
      rot: Math.random() * Math.PI * 2,
      state: "roam",
      dieAt: 0,
      targetX: x, targetZ: z,
      think: 0,
      attackCd: 0,
      flinchAt: 0,
    };
  }
  return null;
}

function ZombieMesh({ z }: { z: Zombie }) {
  const ref = useRef<THREE.Group>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const def = ZOMBIE_TYPES[z.type];
  // re-render on each registered hit so the HP bar mounts and the popup shows
  const myHit = useGame((s) => (s.lastHit?.key === `z${z.id}` ? s.lastHit : null));

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.position.set(z.x, 0, z.z);
    g.rotation.y = z.rot;

    if (z.state === "dying") {
      const age = (Date.now() - z.dieAt) / 1000;
      g.position.y = -Math.min(1.9, age * 1.6); // sink into the ground
      g.rotation.x = Math.min(0.6, age * 0.8);
    } else {
      // lurch: sway + shuffle bob
      const t = clock.elapsedTime + z.id * 1.7;
      g.rotation.z = Math.sin(t * 3.1) * 0.07;
      g.position.y = Math.abs(Math.sin(t * 4.2)) * 0.05;
      // flinch when hit
      if (Date.now() - z.flinchAt < 140) {
        g.position.x += Math.sin(Date.now() / 12) * 0.05;
      }
    }
    if (barRef.current) {
      barRef.current.style.width = `${Math.max(0, (z.hp / z.maxHp) * 100)}%`;
    }
  });

  const click = (e: any) => {
    e.stopPropagation();
    if (z.state === "dying") return;
    useGame.getState().setAttackTarget(z.id);
  };

  return (
    <group ref={ref}>
      <group
        scale={def.scale}
        onClick={click}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (z.state !== "dying") document.body.style.cursor = "crosshair";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        {/* legs */}
        <mesh position={[-0.11, 0.28, 0]} castShadow>
          <boxGeometry args={[0.17, 0.56, 0.17]} />
          <meshStandardMaterial color="#3d4438" roughness={1} />
        </mesh>
        <mesh position={[0.13, 0.26, 0.04]} rotation={[0.1, 0, 0]} castShadow>
          <boxGeometry args={[0.17, 0.52, 0.17]} />
          <meshStandardMaterial color="#343a30" roughness={1} />
        </mesh>
        {/* torso — tattered shirt */}
        <mesh position={[0, 0.82, 0]} rotation={[0.08, 0, 0.04]} castShadow>
          <boxGeometry args={[0.5, 0.52, 0.28]} />
          <meshStandardMaterial color={def.shirt} roughness={1} />
        </mesh>
        {/* arms reaching forward */}
        <mesh position={[-0.3, 0.92, 0.28]} rotation={[1.45, 0, 0]} castShadow>
          <boxGeometry args={[0.13, 0.5, 0.14]} />
          <meshStandardMaterial color={def.skin} roughness={1} emissive="#3a5226" emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[0.3, 0.88, 0.26]} rotation={[1.35, 0, 0]} castShadow>
          <boxGeometry args={[0.13, 0.5, 0.14]} />
          <meshStandardMaterial color={def.skin} roughness={1} emissive="#3a5226" emissiveIntensity={0.55} />
        </mesh>
        {/* head */}
        <mesh position={[0, 1.26, 0.02]} rotation={[0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.28]} />
          <meshStandardMaterial color={def.skin} roughness={1} emissive="#3a5226" emissiveIntensity={0.55} />
        </mesh>
        {/* glowing eyes */}
        <mesh position={[-0.07, 1.28, 0.17]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshBasicMaterial color="#ff5040" />
        </mesh>
        <mesh position={[0.07, 1.28, 0.17]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshBasicMaterial color="#ff5040" />
        </mesh>
      </group>
      {z.state !== "dying" && z.hp < z.maxHp && (
        <Html position={[0, 1.75, 0]} center distanceFactor={26} zIndexRange={[15, 0]}>
          <div className="zombie-hp">
            <div className="zombie-hp-fill" ref={barRef} />
          </div>
        </Html>
      )}
      {myHit && (
        <HitPop
          at={myHit.at}
          text={myHit.crit ? `💥 −${myHit.amount}` : `−${myHit.amount}`}
          crit={myHit.crit}
          position={[0.3, 2, 0]}
        />
      )}
    </group>
  );
}

export default function Zombies() {
  const [, bump] = useState(0);
  const wasNight = useRef(false);
  const spawnCd = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = useGame.getState();
    if (!state.started && !state.spectator) return;
    const night = daylight() < NIGHT_THRESHOLD;

    const blood = isBloodMoonNight();

    // nightfall / dawn transitions
    if (night && !wasNight.current) {
      if (blood) {
        state.setBanner("🔴 BLOOD MOON — they hunger tonight");
        state.addToast("Double loot for every kill… if you survive");
      } else {
        state.addToast("Night falls… the dead are stirring 🧟");
      }
      sfx.groan();
    }
    if (!night && wasNight.current) {
      for (const z of zombies) {
        if (z.state !== "dying") {
          z.state = "dying";
          z.dieAt = Date.now();
        }
      }
      bump((n) => n + 1);
    }
    wasNight.current = night;

    // spawning — the blood moon brings a horde
    if (night) {
      spawnCd.current -= dt;
      const maxZombies = blood ? 14 : 7;
      const alive = zombies.filter((z) => z.state !== "dying").length;
      if (spawnCd.current <= 0 && alive < maxZombies) {
        spawnCd.current = blood ? 1.2 + Math.random() * 1.5 : 2.5 + Math.random() * 3;
        const z = spawnZombie(blood);
        if (z) {
          zombies.push(z);
          bump((n) => n + 1);
        }
      }
    }

    // AI + cleanup
    let removed = false;
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      if (z.state === "dying") {
        if (Date.now() - z.dieAt > 2000) {
          zombies.splice(i, 1);
          removed = true;
        }
        continue;
      }
      const dx = live.x - z.x;
      const dz = live.z - z.z;
      const dist = Math.hypot(dx, dz);

      // never path into the fenced glade
      const inGladeSafe = Math.hypot(live.x, live.z) < GLADE_RADIUS - 1;

      const def = ZOMBIE_TYPES[z.type];
      if (dist < def.chase && !inGladeSafe) {
        z.state = "chase";
        if (dist > ATTACK_RANGE * 0.8) {
          const speed = def.speed;
          const nx = z.x + (dx / dist) * speed * dt;
          const nz = z.z + (dz / dist) * speed * dt;
          [z.x, z.z] = resolveMovement(z.x, z.z, nx, nz, state.choppedAt);
        }
        z.rot = THREE.MathUtils.lerp(
          z.rot,
          z.rot + THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - z.rot + Math.PI, Math.PI * 2) - Math.PI,
          Math.min(1, dt * 6)
        );
        z.attackCd -= dt;
        if (dist < ATTACK_RANGE && z.attackCd <= 0) {
          z.attackCd = 1.1;
          state.hurt(def.dmg, true); // zombie scratches can infect
        }
        if (Math.random() < dt * 0.25) sfx.groan();
      } else {
        z.state = "roam";
        z.think -= dt;
        if (z.think <= 0) {
          z.think = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2;
          z.targetX = z.x + Math.cos(a) * 6;
          z.targetZ = z.z + Math.sin(a) * 6;
        }
        const tx = z.targetX - z.x;
        const tz = z.targetZ - z.z;
        const td = Math.hypot(tx, tz);
        if (td > 0.5) {
          const nx = z.x + (tx / td) * 1.1 * dt;
          const nz = z.z + (tz / td) * 1.1 * dt;
          [z.x, z.z] = resolveMovement(z.x, z.z, nx, nz, state.choppedAt);
          z.rot = THREE.MathUtils.lerp(
            z.rot,
            z.rot + THREE.MathUtils.euclideanModulo(Math.atan2(tx, tz) - z.rot + Math.PI, Math.PI * 2) - Math.PI,
            Math.min(1, dt * 4)
          );
        }
      }
    }
    if (removed) bump((n) => n + 1);
  });

  return (
    <>
      {zombies.map((z) => (
        <ZombieMesh key={z.id} z={z} />
      ))}
    </>
  );
}
