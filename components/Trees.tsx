"use client";

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useModel } from "@/lib/assets";
import { TREES, TreeDef } from "@/lib/world";
import { useGame, TREE_RESPAWN_MS } from "@/lib/store";
import { chop, moveTarget } from "@/lib/runtime";

/** A pulsing golden ring at the base of anything harvestable under the cursor. */
export function HoverRing({ r }: { r: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const k = 1 + Math.sin(clock.elapsedTime * 5) * 0.06;
      ref.current.scale.setScalar(k);
      (ref.current.material as THREE.MeshBasicMaterial).opacity =
        0.55 + Math.sin(clock.elapsedTime * 5) * 0.2;
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[r * 0.78, r, 28]} />
      <meshBasicMaterial color="#ffe27a" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

function hashDir(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((h >>> 0) % 628) / 100; // 0..2π fall direction
}

function Tree({ t }: { t: TreeDef }) {
  const proto = useModel(t.file, t.size);
  const instance = useMemo(() => proto.clone(true), [proto]);
  const pivot = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const choppedAtTs = useGame((s) => s.choppedAt[t.id]);
  const isTarget = useGame((s) => s.chopTargetId === t.id);
  const growStart = useRef(0);
  const wasChopped = useRef(false);
  const fallDir = useMemo(() => hashDir(t.id), [t.id]);

  useFrame(({ clock: threeClock }) => {
    const g = pivot.current;
    if (!g) return;

    if (choppedAtTs) {
      wasChopped.current = true;
      const age = (Date.now() - choppedAtTs) / 1000;
      if (age < 1.1) {
        // tip over with accelerating ease
        const k = Math.min(1, age / 1.1);
        const angle = k * k * (Math.PI / 2.2);
        g.rotation.set(Math.cos(fallDir) * angle, 0, Math.sin(fallDir) * angle);
        g.visible = true;
        g.scale.setScalar(1);
      } else if (age < 1.7) {
        const k = (age - 1.1) / 0.6;
        g.scale.setScalar(Math.max(0.001, 1 - k));
        g.visible = true;
      } else {
        g.visible = false;
      }
      return;
    }

    // regrow after respawn
    if (wasChopped.current && growStart.current === 0) growStart.current = Date.now();
    let scale = 1;
    if (growStart.current) {
      const k = Math.min(1, (Date.now() - growStart.current) / 2500);
      scale = 0.15 + 0.85 * k * k * (3 - 2 * k);
      if (k >= 1) {
        growStart.current = 0;
        wasChopped.current = false;
      }
    }
    g.visible = true;
    g.scale.setScalar(scale);
    g.rotation.set(0, 0, 0);
    // shake while being chopped
    if (isTarget && chop.chopping) {
      const s = Math.sin(threeClock.elapsedTime * 38) * 0.018;
      g.rotation.x = s;
      g.rotation.z = s * 0.7;
    }
  });

  const clickable = !choppedAtTs;

  return (
    <group position={t.pos}>
      <group ref={pivot} rotation={[0, 0, 0]}>
        <primitive
          object={instance}
          rotation={[0, t.rot, 0]}
          onClick={(e: any) => {
            if (!clickable) return;
            e.stopPropagation();
            useGame.getState().setChopTarget(t.id);
            moveTarget.x = t.pos[0];
            moveTarget.z = t.pos[2];
            moveTarget.active = true;
          }}
          onPointerOver={(e: any) => {
            if (!clickable) return;
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            setHovered(true);
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
            setHovered(false);
          }}
        />
      </group>
      {hovered && clickable && <HoverRing r={t.r + 0.7} />}
      {/* stump while chopped */}
      {choppedAtTs && (
        <mesh position={[0, 0.18, 0]} castShadow>
          <cylinderGeometry args={[t.size * 0.05, t.size * 0.065, 0.36, 8]} />
          <meshStandardMaterial color="#8a6a3f" roughness={1} />
        </mesh>
      )}
      {/* chop progress bar */}
      {isTarget && !choppedAtTs && <ChopBar height={t.size * 0.75} />}
    </group>
  );
}

function ChopBar({ height }: { height: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${Math.round(chop.progress * 100)}%`;
    }
  });
  return (
    <Html position={[0, height, 0]} center distanceFactor={26} zIndexRange={[20, 0]}>
      <div className="chop-bar">
        <div className="chop-bar-icon">🪓</div>
        <div className="chop-bar-track">
          <div className="chop-bar-fill" ref={fillRef} />
        </div>
      </div>
    </Html>
  );
}

export default function Trees() {
  const respawnCheck = useRef(0);
  useFrame((_, dt) => {
    respawnCheck.current += dt;
    if (respawnCheck.current < 2) return;
    respawnCheck.current = 0;
    const s = useGame.getState();
    const now = Date.now();
    for (const [id, ts] of Object.entries(s.choppedAt)) {
      if (now - ts > TREE_RESPAWN_MS) s.respawnTree(id);
    }
  });

  return (
    <>
      {TREES.map((t) => (
        <Tree key={t.id} t={t} />
      ))}
    </>
  );
}
