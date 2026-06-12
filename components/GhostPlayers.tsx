"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ghosts, onGhostsChange, sampleAt, RENDER_DELAY_MS, Ghost } from "@/lib/multiplayer";
import { DEFAULT_APPEARANCE, Appearance } from "@/lib/store";
import CharacterModel, { Motion } from "./CharacterModel";

function GhostPlayer({ g }: { g: Ghost }) {
  const ref = useRef<THREE.Group>(null);
  const motion = useRef<Motion>({ phase: 0, moving: false }).current;

  const appearance: Appearance = useMemo(
    () => ({ ...DEFAULT_APPEARANCE, ...(g.look.appearance as Appearance | undefined) }),
    [g.lookStr] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useFrame((_, dt) => {
    const grp = ref.current;
    if (!grp || g.samples.length === 0) return;
    // render the buffered past so motion between updates is continuous
    const s = sampleAt(g.samples, Date.now() - RENDER_DELAY_MS);
    const stepDist = Math.hypot(s.x - g.cx, s.z - g.cz);
    const speed = dt > 0 ? stepDist / dt : 0;
    g.cx = s.x;
    g.cz = s.z;
    g.crot = s.rot;

    motion.moving = speed > 0.6; // world units / second
    if (motion.moving) motion.phase += dt * Math.min(14, 4 + speed * 1.4);

    grp.position.set(g.cx, motion.moving ? Math.abs(Math.sin(motion.phase)) * 0.08 : 0, g.cz);
    grp.rotation.y = g.crot;
  });

  return (
    <group ref={ref} position={[g.cx, 0, g.cz]}>
      <CharacterModel
        appearance={appearance}
        shirt={g.look.shirt ?? "green"}
        hat={g.look.hat ?? null}
        motion={motion}
      />
      <Html position={[0, 2.05, 0]} center distanceFactor={26} zIndexRange={[9, 0]}>
        <div className="player-label ghost">{g.name || "Survivor"} · Lv {g.level}</div>
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
