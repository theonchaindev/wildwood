"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useGame } from "@/lib/store";
import { live, zombies } from "@/lib/runtime";
import { resolveMovement } from "@/lib/world";
import { sfx } from "@/lib/sound";

/** The player's loyal dog: follows in the forest and bites whatever they're
 *  fighting. Every bite earns him experience — a seasoned dog bites harder. */
export default function Dog() {
  const owned = useGame((s) => s.dog);
  const dogLevel = useGame((s) => s.dogLevel());
  const ref = useRef<THREE.Group>(null);
  const pos = useRef({ x: 2, z: 2, rot: 0 });
  const biteCd = useRef(0);
  const barkCd = useRef(5);
  const tail = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = ref.current;
    if (!g || !owned) return;
    const state = useGame.getState();
    const p = pos.current;

    // pick a target: the zombie the player is fighting, else any zombie close to the dog
    let target = state.attackTargetId !== null
      ? zombies.find((z) => z.id === state.attackTargetId && z.state !== "dying")
      : undefined;
    if (!target) {
      target = zombies.find(
        (z) => z.state !== "dying" && Math.hypot(z.x - p.x, z.z - p.z) < 7
      );
    }

    biteCd.current -= dt;
    barkCd.current -= dt;

    let goalX: number;
    let goalZ: number;
    if (target) {
      goalX = target.x;
      goalZ = target.z;
      const distT = Math.hypot(target.x - p.x, target.z - p.z);
      if (distT < 1.2 && biteCd.current <= 0) {
        biteCd.current = 0.9;
        const dmg = 6 + 2 * state.dogLevel();
        target.hp -= dmg;
        target.flinchAt = Date.now();
        state.registerHit(`z${target.id}`, dmg, false);
        state.dogBit();
        sfx.hit();
        if (target.hp <= 0) {
          target.state = "dying";
          target.dieAt = Date.now();
          state.zombieKilled(target.type === "boss");
        }
      }
      if (barkCd.current <= 0) {
        barkCd.current = 2.5 + Math.random() * 3;
        sfx.bark();
      }
    } else {
      // heel slightly behind the player
      goalX = live.x - 1.6;
      goalZ = live.z + 1.6;
    }

    const dx = goalX - p.x;
    const dz = goalZ - p.z;
    const dist = Math.hypot(dx, dz);

    // left far behind? bound ahead
    const distOwner = Math.hypot(live.x - p.x, live.z - p.z);
    if (distOwner > 26) {
      p.x = live.x - 1.5;
      p.z = live.z + 1.5;
    } else if (dist > (target ? 1.0 : 1.4)) {
      const speed = 7.2;
      const nx = p.x + (dx / dist) * speed * dt;
      const nz = p.z + (dz / dist) * speed * dt;
      [p.x, p.z] = resolveMovement(p.x, p.z, nx, nz, state.choppedAt);
      p.rot = THREE.MathUtils.lerp(
        p.rot,
        p.rot + THREE.MathUtils.euclideanModulo(Math.atan2(dx, dz) - p.rot + Math.PI, Math.PI * 2) - Math.PI,
        Math.min(1, dt * 9)
      );
    }

    g.position.set(p.x, Math.abs(Math.sin(clock.elapsedTime * 9)) * 0.05, p.z);
    g.rotation.y = p.rot;
    if (tail.current) {
      tail.current.rotation.y = Math.sin(clock.elapsedTime * 10) * 0.5;
    }
  });

  if (!owned) return null;

  return (
    <group ref={ref}>
      {/* body */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.32, 0.3, 0.62]} />
        <meshStandardMaterial color="#9a7448" roughness={1} />
      </mesh>
      {/* head */}
      <mesh position={[0, 0.5, 0.38]} castShadow>
        <boxGeometry args={[0.26, 0.24, 0.26]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      {/* snout */}
      <mesh position={[0, 0.44, 0.55]}>
        <boxGeometry args={[0.14, 0.12, 0.12]} />
        <meshStandardMaterial color="#6b4e2a" roughness={1} />
      </mesh>
      {/* ears */}
      <mesh position={[-0.09, 0.66, 0.36]} rotation={[0.2, 0, -0.2]}>
        <boxGeometry args={[0.07, 0.14, 0.05]} />
        <meshStandardMaterial color="#6b4e2a" roughness={1} />
      </mesh>
      <mesh position={[0.09, 0.66, 0.36]} rotation={[0.2, 0, 0.2]}>
        <boxGeometry args={[0.07, 0.14, 0.05]} />
        <meshStandardMaterial color="#6b4e2a" roughness={1} />
      </mesh>
      {/* tail */}
      <mesh ref={tail} position={[0, 0.42, -0.36]} rotation={[0.7, 0, 0]}>
        <boxGeometry args={[0.06, 0.06, 0.26]} />
        <meshStandardMaterial color="#8a6a3f" roughness={1} />
      </mesh>
      {/* legs */}
      {[[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.09, z]}>
          <boxGeometry args={[0.08, 0.18, 0.08]} />
          <meshStandardMaterial color="#7a5a33" roughness={1} />
        </mesh>
      ))}
      <Html position={[0, 1.05, 0]} center distanceFactor={26} zIndexRange={[9, 0]}>
        <div className="player-label">🐕 Buddy · Lv {dogLevel}</div>
      </Html>
    </group>
  );
}
