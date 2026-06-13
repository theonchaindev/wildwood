"use client";

// The Old Mine's inhabitants — zombies and skeletons that roam the chambers
// and fight you for the ore. They live in the shared `zombies` array (so the
// existing click-to-attack, dog and loot logic all work), but this component
// owns their spawning, AI and rendering while you're underground.

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { live, zombies, zombieSeq, Zombie } from "@/lib/runtime";
import { CAVE_MOB_SPOTS, CAVE_HW, CAVE_HD, resolveCaveMovement } from "@/lib/world";
import { ZOMBIE_TYPES } from "./Zombies";
import { sfx } from "@/lib/sound";
import HitPop from "./HitPop";
import { HoverRing } from "./Trees";

const ATTACK_RANGE = 1.5;
const ENGAGE_RANGE = 11;

function SkeletonMesh() {
  return (
    <group>
      {/* legs */}
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.32, 0]} castShadow>
          <boxGeometry args={[0.08, 0.62, 0.08]} />
          <meshStandardMaterial color="#e8e6dc" roughness={1} />
        </mesh>
      ))}
      {/* spine/ribs */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.34, 0.5, 0.18]} />
        <meshStandardMaterial color="#d8d4c4" roughness={1} />
      </mesh>
      {/* arms reaching out */}
      {[-0.26, 0.26].map((x) => (
        <mesh key={x} position={[x, 0.95, 0.2]} rotation={[1.4, 0, 0]} castShadow>
          <boxGeometry args={[0.08, 0.46, 0.08]} />
          <meshStandardMaterial color="#e8e6dc" roughness={1} />
        </mesh>
      ))}
      {/* skull */}
      <mesh position={[0, 1.28, 0.02]} castShadow>
        <boxGeometry args={[0.26, 0.26, 0.24]} />
        <meshStandardMaterial color="#f2efe4" roughness={1} />
      </mesh>
      {[-0.06, 0.06].map((x) => (
        <mesh key={x} position={[x, 1.3, 0.14]}>
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshBasicMaterial color="#2a2a2a" />
        </mesh>
      ))}
    </group>
  );
}

function ZombieBody({ skin, shirt }: { skin: string; shirt: string }) {
  return (
    <group>
      <mesh position={[-0.11, 0.28, 0]} castShadow>
        <boxGeometry args={[0.17, 0.56, 0.17]} />
        <meshStandardMaterial color="#3d4438" roughness={1} />
      </mesh>
      <mesh position={[0.13, 0.26, 0.04]} rotation={[0.1, 0, 0]} castShadow>
        <boxGeometry args={[0.17, 0.52, 0.17]} />
        <meshStandardMaterial color="#343a30" roughness={1} />
      </mesh>
      <mesh position={[0, 0.82, 0]} rotation={[0.08, 0, 0.04]} castShadow>
        <boxGeometry args={[0.5, 0.52, 0.28]} />
        <meshStandardMaterial color={shirt} roughness={1} />
      </mesh>
      {[-0.3, 0.3].map((x, i) => (
        <mesh key={x} position={[x, 0.9 - i * 0.04, 0.27]} rotation={[1.4, 0, 0]} castShadow>
          <boxGeometry args={[0.13, 0.5, 0.14]} />
          <meshStandardMaterial color={skin} roughness={1} emissive="#3a5226" emissiveIntensity={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.26, 0.02]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[0.3, 0.3, 0.28]} />
        <meshStandardMaterial color={skin} roughness={1} emissive="#3a5226" emissiveIntensity={0.5} />
      </mesh>
      {[-0.07, 0.07].map((x) => (
        <mesh key={x} position={[x, 1.28, 0.17]}>
          <boxGeometry args={[0.05, 0.04, 0.02]} />
          <meshBasicMaterial color="#ff5040" />
        </mesh>
      ))}
    </group>
  );
}

function MobMesh({ z }: { z: Zombie }) {
  const ref = useRef<THREE.Group>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const def = ZOMBIE_TYPES[z.type];
  const myHit = useGame((s) => (s.lastHit?.key === `z${z.id}` ? s.lastHit : null));

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.position.set(z.x, 0, z.z);
    g.rotation.y = z.rot;
    if (z.state === "dying") {
      const age = (Date.now() - z.dieAt) / 1000;
      g.position.y = -Math.min(1.9, age * 1.6);
      g.rotation.x = Math.min(0.6, age * 0.8);
    } else {
      const t = clock.elapsedTime + z.id * 1.7;
      g.rotation.z = Math.sin(t * 3) * 0.06;
      g.position.y = Math.abs(Math.sin(t * 4)) * 0.05;
    }
    if (barRef.current) barRef.current.style.width = `${Math.max(0, (z.hp / z.maxHp) * 100)}%`;
  });

  const click = (e: any) => {
    e.stopPropagation();
    if (z.state === "dying") return;
    if (Math.hypot(live.x - z.x, live.z - z.z) > ENGAGE_RANGE) {
      useGame.getState().addToast("Too far — get closer to attack ⚔️");
      return;
    }
    useGame.getState().setAttackTarget(z.id);
  };

  return (
    <group ref={ref}>
      {hovered && z.state !== "dying" && <HoverRing r={1} color="#ff5040" />}
      <group
        onClick={click}
        onPointerOver={(e) => { e.stopPropagation(); if (z.state !== "dying") { document.body.style.cursor = "crosshair"; setHovered(true); } }}
        onPointerOut={() => { document.body.style.cursor = ""; setHovered(false); }}
      >
        <mesh position={[0, 0.9, 0]} visible={false}>
          <boxGeometry args={[1.1, 1.9, 1.1]} />
          <meshBasicMaterial />
        </mesh>
        {z.type === "skeleton" ? <SkeletonMesh /> : <ZombieBody skin={def.skin} shirt={def.shirt} />}
      </group>
      {z.state !== "dying" && z.hp < z.maxHp && (
        <Html position={[0, 1.75, 0]} center distanceFactor={26} zIndexRange={[15, 0]}>
          <div className="zombie-hp"><div className="zombie-hp-fill" ref={barRef} /></div>
        </Html>
      )}
      {myHit && (
        <HitPop at={myHit.at} text={myHit.crit ? `💥 −${myHit.amount}` : `−${myHit.amount}`} crit={myHit.crit} position={[0.3, 2, 0]} />
      )}
    </group>
  );
}

export default function CaveMobs() {
  const [, bump] = useState(0);

  // spawn the mine's mobs on entry, clear them on exit
  useEffect(() => {
    zombies.length = 0;
    for (const spot of CAVE_MOB_SPOTS) {
      const def = ZOMBIE_TYPES[spot.kind === "skeleton" ? "skeleton" : "walker"];
      zombies.push({
        id: ++zombieSeq.n,
        type: spot.kind === "skeleton" ? "skeleton" : "walker",
        x: spot.x, z: spot.z,
        hp: def.hp, maxHp: def.hp,
        rot: Math.random() * Math.PI * 2,
        state: "roam", dieAt: 0,
        targetX: spot.x, targetZ: spot.z,
        think: 0, attackCd: 0, flinchAt: 0,
      });
    }
    bump((n) => n + 1);
    return () => { zombies.length = 0; };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = useGame.getState();
    if (state.location !== "cave") return; // mobs only act underground
    let removed = false;
    for (let i = zombies.length - 1; i >= 0; i--) {
      const z = zombies[i];
      if (z.state === "dying") {
        if (Date.now() - z.dieAt > 2000) { zombies.splice(i, 1); removed = true; }
        continue;
      }
      const def = ZOMBIE_TYPES[z.type];
      const dx = live.x - z.x;
      const dz = live.z - z.z;
      const dist = Math.hypot(dx, dz);
      if (dist < def.chase) {
        z.state = "chase";
        if (dist > ATTACK_RANGE * 0.8) {
          const sp = def.speed;
          [z.x, z.z] = resolveCaveMovement(z.x, z.z, z.x + (dx / dist) * sp * dt, z.z + (dz / dist) * sp * dt, state.minedAt);
        }
        z.rot = THREE.MathUtils.lerp(z.rot, z.rot + THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - z.rot + Math.PI, Math.PI * 2) - Math.PI, Math.min(1, dt * 6));
        z.attackCd -= dt;
        if (dist < ATTACK_RANGE && z.attackCd <= 0) {
          z.attackCd = 1.1;
          state.hurt(def.dmg, z.type !== "skeleton"); // skeletons don't infect
        }
        if (Math.random() < dt * 0.2) sfx.groan();
      } else {
        z.state = "roam";
        z.think -= dt;
        if (z.think <= 0) {
          z.think = 2 + Math.random() * 4;
          const a = Math.random() * Math.PI * 2;
          z.targetX = Math.max(-CAVE_HW + 2, Math.min(CAVE_HW - 2, z.x + Math.cos(a) * 6));
          z.targetZ = Math.max(-CAVE_HD + 2, Math.min(CAVE_HD - 2, z.z + Math.sin(a) * 6));
        }
        const tx = z.targetX - z.x;
        const tz = z.targetZ - z.z;
        const td = Math.hypot(tx, tz);
        if (td > 0.5) {
          [z.x, z.z] = resolveCaveMovement(z.x, z.z, z.x + (tx / td) * 1.1 * dt, z.z + (tz / td) * 1.1 * dt, state.minedAt);
          z.rot = THREE.MathUtils.lerp(z.rot, z.rot + THREE.MathUtils.euclideanModulo(Math.atan2(tx, tz) - z.rot + Math.PI, Math.PI * 2) - Math.PI, Math.min(1, dt * 4));
        }
      }
    }
    if (removed) bump((n) => n + 1);
  });

  return (
    <>
      {zombies.map((z) => (
        <MobMesh key={z.id} z={z} />
      ))}
    </>
  );
}
