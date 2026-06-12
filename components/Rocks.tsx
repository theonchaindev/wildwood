"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useModel } from "@/lib/assets";
import { ROCKS, TreeDef } from "@/lib/world";
import { useGame, ROCK_RESPAWN_MS } from "@/lib/store";
import { mine, moveTarget } from "@/lib/runtime";

function Rock({ r }: { r: TreeDef }) {
  const proto = useModel(r.file, r.size);
  const instance = useMemo(() => proto.clone(true), [proto]);
  const pivot = useRef<THREE.Group>(null);
  const minedAtTs = useGame((s) => s.minedAt[r.id]);
  const isTarget = useGame((s) => s.mineTargetId === r.id);

  useFrame(({ clock }) => {
    const g = pivot.current;
    if (!g) return;

    if (minedAtTs) {
      // crumble: shrink into the ground
      const age = (Date.now() - minedAtTs) / 1000;
      const k = Math.min(1, age / 0.6);
      g.scale.setScalar(Math.max(0.001, 1 - k));
      g.visible = k < 1;
      return;
    }
    g.visible = true;
    g.scale.setScalar(1);
    // tremble while being mined
    if (isTarget && mine.mining) {
      const s = Math.sin(clock.elapsedTime * 45) * 0.012;
      g.position.x = s;
      g.position.z = s * 0.7;
    } else {
      g.position.x = 0;
      g.position.z = 0;
    }
  });

  return (
    <group position={r.pos}>
      <group ref={pivot}>
        <primitive
          object={instance}
          rotation={[0, r.rot, 0]}
          onClick={(e: any) => {
            if (minedAtTs) return;
            e.stopPropagation();
            useGame.getState().setMineTarget(r.id);
            moveTarget.x = r.pos[0];
            moveTarget.z = r.pos[2];
            moveTarget.active = true;
          }}
          onPointerOver={(e: any) => {
            if (minedAtTs) return;
            e.stopPropagation();
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
          }}
        />
      </group>
      {isTarget && !minedAtTs && <MineBar height={r.size * 0.9 + 0.6} />}
    </group>
  );
}

function MineBar({ height }: { height: number }) {
  const fillRef = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (fillRef.current) {
      fillRef.current.style.width = `${Math.round(mine.progress * 100)}%`;
    }
  });
  return (
    <Html position={[0, height, 0]} center distanceFactor={26} zIndexRange={[20, 0]}>
      <div className="chop-bar">
        <div className="chop-bar-icon">⛏️</div>
        <div className="chop-bar-track">
          <div className="chop-bar-fill stone" ref={fillRef} />
        </div>
      </div>
    </Html>
  );
}

export default function Rocks() {
  const respawnCheck = useRef(0);
  useFrame((_, dt) => {
    respawnCheck.current += dt;
    if (respawnCheck.current < 2) return;
    respawnCheck.current = 0;
    const s = useGame.getState();
    const now = Date.now();
    for (const [id, ts] of Object.entries(s.minedAt)) {
      if (now - ts > ROCK_RESPAWN_MS) s.respawnRock(id);
    }
  });

  return (
    <>
      {ROCKS.map((r) => (
        <Rock key={r.id} r={r} />
      ))}
    </>
  );
}
