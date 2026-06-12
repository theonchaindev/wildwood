"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ghosts, onGhostsChange, Ghost } from "@/lib/multiplayer";
import { DEFAULT_APPEARANCE, Appearance } from "@/lib/store";
import CharacterModel from "./CharacterModel";

function GhostPlayer({ g }: { g: Ghost }) {
  const ref = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);

  const appearance: Appearance = useMemo(
    () => ({ ...DEFAULT_APPEARANCE, ...(g.look.appearance as Appearance | undefined) }),
    [g.lookStr] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((_, dt) => {
    const grp = ref.current;
    if (!grp) return;
    // glide toward the latest network position
    const dx = g.tx - g.cx;
    const dz = g.tz - g.cz;
    const dist = Math.hypot(dx, dz);
    if (dist > 25) {
      // teleported (gate travel etc.) — snap
      g.cx = g.tx;
      g.cz = g.tz;
    } else {
      const k = Math.min(1, dt * 4);
      g.cx += dx * k;
      g.cz += dz * k;
    }
    g.crot = THREE.MathUtils.lerp(
      g.crot,
      g.crot + THREE.MathUtils.euclideanModulo(g.trot - g.crot + Math.PI, Math.PI * 2) - Math.PI,
      Math.min(1, dt * 6)
    );
    const moving = dist > 0.25;
    if (moving) walkPhase.current += dt * 10;
    grp.position.set(g.cx, moving ? Math.abs(Math.sin(walkPhase.current)) * 0.08 : 0, g.cz);
    grp.rotation.y = g.crot;
  });

  return (
    <group ref={ref} position={[g.cx, 0, g.cz]}>
      <CharacterModel
        appearance={appearance}
        shirt={g.look.shirt ?? "green"}
        hat={g.look.hat ?? null}
      />
      <Html position={[0, 2.05, 0]} center distanceFactor={26} zIndexRange={[9, 0]}>
        <div className="player-label ghost">{g.name || "Forager"} · Lv {g.level}</div>
      </Html>
    </group>
  );
}

/** Other live players, rendered in the shared forest. */
export default function GhostPlayers() {
  const [, force] = useState(0);
  useEffect(() => onGhostsChange(() => force((n) => n + 1)), []);
  return (
    <>
      {ghosts.map((g) => (
        <GhostPlayer key={g.id} g={g} />
      ))}
    </>
  );
}
