"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { live, animals, Animal } from "@/lib/runtime";
import { resolveMovement, ANIMAL_SPAWNS } from "@/lib/world";
import { sfx } from "@/lib/sound";
import HitPop from "./HitPop";

const RESPAWN_MS = 120_000;
const BOAR_DMG = 6;

const WILD_HP: Record<string, number> = { chicken: 10, boar: 25, rabbit: 8, deer: 22 };
// shy animals run away when approached; boars stand their ground
const SHY: Record<string, boolean> = { chicken: true, rabbit: true, deer: true, boar: false };
const FLEE_SPEED: Record<string, number> = { chicken: 2.4, rabbit: 3.2, deer: 3.6, boar: 2.4 };

function initAnimals() {
  if (animals.length) return;
  for (const s of ANIMAL_SPAWNS) {
    animals.push({
      id: s.id,
      kind: s.kind,
      homeX: s.pos[0],
      homeZ: s.pos[1],
      x: s.pos[0],
      z: s.pos[1],
      hp: WILD_HP[s.kind],
      maxHp: WILD_HP[s.kind],
      rot: Math.random() * Math.PI * 2,
      state: "wander",
      stateUntil: 0,
      respawnAt: 0,
      targetX: s.pos[0],
      targetZ: s.pos[1],
      think: Math.random() * 3,
      attackCd: 0,
      flinchAt: 0,
    });
  }
}

function turnToward(a: Animal, dx: number, dz: number, dt: number, rate: number) {
  a.rot = THREE.MathUtils.lerp(
    a.rot,
    a.rot + THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - a.rot + Math.PI, Math.PI * 2) - Math.PI,
    Math.min(1, dt * rate)
  );
}

function ChickenMesh() {
  return (
    <>
      {/* body */}
      <mesh position={[0, 0.28, 0]} castShadow>
        <boxGeometry args={[0.3, 0.28, 0.42]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.52, 0.2]} castShadow>
        <boxGeometry args={[0.16, 0.18, 0.16]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
      {/* comb */}
      <mesh position={[0, 0.64, 0.2]}>
        <boxGeometry args={[0.05, 0.08, 0.1]} />
        <meshStandardMaterial color="#d8453a" roughness={1} />
      </mesh>
      {/* beak */}
      <mesh position={[0, 0.5, 0.3]}>
        <coneGeometry args={[0.04, 0.1, 4]} />
        <meshStandardMaterial color="#e8a53a" roughness={1} />
      </mesh>
      {/* legs */}
      <mesh position={[-0.06, 0.08, 0]}>
        <boxGeometry args={[0.03, 0.16, 0.03]} />
        <meshStandardMaterial color="#e8a53a" roughness={1} />
      </mesh>
      <mesh position={[0.06, 0.08, 0]}>
        <boxGeometry args={[0.03, 0.16, 0.03]} />
        <meshStandardMaterial color="#e8a53a" roughness={1} />
      </mesh>
    </>
  );
}

function BoarMesh() {
  return (
    <>
      {/* body */}
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.55, 0.5, 0.95]} />
        <meshStandardMaterial color="#5e4a35" roughness={1} />
      </mesh>
      {/* mane */}
      <mesh position={[0, 0.68, -0.1]} castShadow>
        <boxGeometry args={[0.2, 0.12, 0.7]} />
        <meshStandardMaterial color="#46362a" roughness={1} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.4, 0.58]} castShadow>
        <boxGeometry args={[0.4, 0.38, 0.3]} />
        <meshStandardMaterial color="#544232" roughness={1} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.32, 0.78]}>
        <boxGeometry args={[0.18, 0.16, 0.12]} />
        <meshStandardMaterial color="#8a6e57" roughness={1} />
      </mesh>
      {/* tusks */}
      <mesh position={[-0.12, 0.28, 0.74]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.03, 0.14, 4]} />
        <meshStandardMaterial color="#e8e0cc" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.28, 0.74]} rotation={[0.5, 0, 0]}>
        <coneGeometry args={[0.03, 0.14, 4]} />
        <meshStandardMaterial color="#e8e0cc" roughness={0.8} />
      </mesh>
      {/* legs */}
      {[[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.32], [0.18, -0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]}>
          <boxGeometry args={[0.1, 0.2, 0.1]} />
          <meshStandardMaterial color="#46362a" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function RabbitMesh() {
  return (
    <>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.3]} />
        <meshStandardMaterial color="#cfc8ba" roughness={1} />
      </mesh>
      <mesh position={[0, 0.26, 0.15]} castShadow>
        <boxGeometry args={[0.14, 0.14, 0.14]} />
        <meshStandardMaterial color="#cfc8ba" roughness={1} />
      </mesh>
      {/* ears */}
      <mesh position={[-0.04, 0.42, 0.13]} rotation={[0.15, 0, -0.1]}>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial color="#bdb5a5" roughness={1} />
      </mesh>
      <mesh position={[0.04, 0.42, 0.13]} rotation={[0.15, 0, 0.1]}>
        <boxGeometry args={[0.04, 0.18, 0.04]} />
        <meshStandardMaterial color="#bdb5a5" roughness={1} />
      </mesh>
      {/* tail */}
      <mesh position={[0, 0.18, -0.17]}>
        <sphereGeometry args={[0.05, 5, 4]} />
        <meshStandardMaterial color="#f2efe6" roughness={1} />
      </mesh>
    </>
  );
}

function DeerMesh() {
  return (
    <>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.36, 0.36, 0.75]} />
        <meshStandardMaterial color="#a8825a" roughness={1} />
      </mesh>
      {/* neck + head */}
      <mesh position={[0, 0.82, 0.4]} rotation={[0.5, 0, 0]} castShadow>
        <boxGeometry args={[0.14, 0.36, 0.14]} />
        <meshStandardMaterial color="#a8825a" roughness={1} />
      </mesh>
      <mesh position={[0, 1, 0.52]} castShadow>
        <boxGeometry args={[0.18, 0.16, 0.26]} />
        <meshStandardMaterial color="#9a7448" roughness={1} />
      </mesh>
      {/* antlers */}
      <mesh position={[-0.08, 1.16, 0.46]} rotation={[0, 0, -0.4]}>
        <boxGeometry args={[0.04, 0.22, 0.04]} />
        <meshStandardMaterial color="#6b5436" roughness={1} />
      </mesh>
      <mesh position={[0.08, 1.16, 0.46]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.04, 0.22, 0.04]} />
        <meshStandardMaterial color="#6b5436" roughness={1} />
      </mesh>
      <mesh position={[-0.14, 1.22, 0.46]} rotation={[0, 0, -1.1]}>
        <boxGeometry args={[0.03, 0.12, 0.03]} />
        <meshStandardMaterial color="#6b5436" roughness={1} />
      </mesh>
      <mesh position={[0.14, 1.22, 0.46]} rotation={[0, 0, 1.1]}>
        <boxGeometry args={[0.03, 0.12, 0.03]} />
        <meshStandardMaterial color="#6b5436" roughness={1} />
      </mesh>
      {/* slender legs */}
      {[[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.19, z]}>
          <boxGeometry args={[0.07, 0.38, 0.07]} />
          <meshStandardMaterial color="#8a6a44" roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function AnimalMesh({ a }: { a: Animal }) {
  const ref = useRef<THREE.Group>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const myHit = useGame((s) => (s.lastHit?.key === `a${a.id}` ? s.lastHit : null));

  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.visible = a.state !== "dead";
    g.position.set(a.x, 0, a.z);
    g.rotation.y = a.rot;
    const t = clock.elapsedTime * (a.kind === "chicken" ? 9 : 5) + a.x;
    g.position.y = Math.abs(Math.sin(t)) * (a.kind === "chicken" ? 0.05 : 0.03);
    if (Date.now() - a.flinchAt < 140) {
      g.position.x += Math.sin(Date.now() / 12) * 0.04;
    }
    if (barRef.current) {
      barRef.current.style.width = `${Math.max(0, (a.hp / a.maxHp) * 100)}%`;
    }
  });

  if (a.state === "dead") return null;

  return (
    <group ref={ref}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          useGame.getState().setAnimalTarget(a.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "crosshair";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      >
        {a.kind === "chicken" ? <ChickenMesh /> : a.kind === "rabbit" ? <RabbitMesh /> : a.kind === "deer" ? <DeerMesh /> : <BoarMesh />}
      </group>
      {a.hp < a.maxHp && (
        <Html position={[0, a.kind === "chicken" || a.kind === "rabbit" ? 1 : 1.4, 0]} center distanceFactor={26} zIndexRange={[15, 0]}>
          <div className="zombie-hp">
            <div className="zombie-hp-fill animal" ref={barRef} />
          </div>
        </Html>
      )}
      {myHit && (
        <HitPop
          at={myHit.at}
          text={myHit.crit ? `💥 −${myHit.amount}` : `−${myHit.amount}`}
          crit={myHit.crit}
          position={[0.3, a.kind === "chicken" || a.kind === "rabbit" ? 1.2 : 1.6, 0]}
        />
      )}
    </group>
  );
}

export default function Animals() {
  const [, bump] = useState(0);
  const inited = useRef(false);
  if (!inited.current) {
    inited.current = true;
    initAnimals();
  }

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const state = useGame.getState();
    if (!state.started && !state.spectator) return;
    const now = Date.now();

    for (const a of animals) {
      if (a.state === "dead") {
        if (now > a.respawnAt) {
          a.state = "wander";
          a.hp = a.maxHp;
          a.x = a.homeX;
          a.z = a.homeZ;
          bump((n) => n + 1);
        }
        continue;
      }

      const dxp = live.x - a.x;
      const dzp = live.z - a.z;
      const distP = Math.hypot(dxp, dzp);

      if (a.state === "enrage") {
        if (now > a.stateUntil || distP > 18) {
          a.state = "wander";
        } else {
          if (distP > 1.3) {
            const speed = 3.4;
            const nx = a.x + (dxp / distP) * speed * dt;
            const nz = a.z + (dzp / distP) * speed * dt;
            [a.x, a.z] = resolveMovement(a.x, a.z, nx, nz, state.choppedAt);
          }
          turnToward(a, dxp, dzp, dt, 7);
          a.attackCd -= dt;
          if (distP < 1.3 && a.attackCd <= 0) {
            a.attackCd = 1.2;
            state.hurt(BOAR_DMG);
          }
          continue;
        }
      }

      // stunned after a hit — easy to finish off
      if (a.state === "stun") {
        if (now > a.stateUntil) {
          a.state = "flee";
          a.stateUntil = now + 900;
        }
        continue;
      }

      if (a.state === "flee") {
        if (now > a.stateUntil) a.state = "wander";
        else {
          // slower than the player walks, so a hunt can actually end
          const speed = FLEE_SPEED[a.kind];
          const nx = a.x - (dxp / (distP || 1)) * speed * dt;
          const nz = a.z - (dzp / (distP || 1)) * speed * dt;
          [a.x, a.z] = resolveMovement(a.x, a.z, nx, nz, state.choppedAt);
          turnToward(a, -dxp, -dzp, dt, 8);
          continue;
        }
      }

      // wander near home; shy animals scatter when approached (unless hunted)
      const shyRange = a.kind === "deer" ? 4 : 2;
      if (SHY[a.kind] && distP < shyRange && state.animalTargetId !== a.id) {
        a.state = "flee";
        a.stateUntil = now + (a.kind === "deer" ? 1500 : 900);
        continue;
      }
      a.think -= dt;
      if (a.think <= 0) {
        a.think = 2 + Math.random() * 4;
        const ang = Math.random() * Math.PI * 2;
        const r = Math.random() * 5;
        a.targetX = a.homeX + Math.cos(ang) * r;
        a.targetZ = a.homeZ + Math.sin(ang) * r;
      }
      const tx = a.targetX - a.x;
      const tz = a.targetZ - a.z;
      const td = Math.hypot(tx, tz);
      if (td > 0.4) {
        const speed = a.kind === "chicken" ? 1.4 : 1.0;
        const nx = a.x + (tx / td) * speed * dt;
        const nz = a.z + (tz / td) * speed * dt;
        [a.x, a.z] = resolveMovement(a.x, a.z, nx, nz, state.choppedAt);
        turnToward(a, tx, tz, dt, 5);
      }
    }
  });

  return (
    <>
      {animals.map((a) => (
        <AnimalMesh key={a.id} a={a} />
      ))}
    </>
  );
}

/** Called from Player when an animal takes a hit. */
export function onAnimalHit(a: Animal) {
  a.flinchAt = Date.now();
  if (a.hp <= 0) {
    a.state = "dead";
    a.respawnAt = Date.now() + RESPAWN_MS;
    useGame.getState().animalKilled(a.kind);
    return;
  }
  if (SHY[a.kind]) {
    // brief stun so follow-up swings connect
    a.state = "stun";
    a.stateUntil = Date.now() + 700;
    sfx.ui();
  } else {
    a.state = "enrage";
    a.stateUntil = Date.now() + 8000;
    sfx.groan();
  }
}
