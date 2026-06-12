"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Appearance, SKIN_TONES, HAIR_COLORS, SHIRTS, ArmorTier } from "@/lib/store";

/** Mutable walk-cycle state, written by whoever moves the character. */
export type Motion = { phase: number; moving: boolean };

type Props = {
  appearance: Appearance;
  shirt: string;
  hat: string | null;
  armor?: ArmorTier | null;
  motion?: Motion;
};

/** The survivor's body — shared between the player, other live players and the creator preview. */
export default function CharacterModel({ appearance, shirt, hat, armor = null, motion }: Props) {
  const shirtColor = SHIRTS[shirt]?.color ?? "#3f6d35";
  const sleeveColor = new THREE.Color(shirtColor).multiplyScalar(0.85).getStyle();
  const skinColor = SKIN_TONES[appearance.skin] ?? SKIN_TONES[0];
  const hairColor = HAIR_COLORS[appearance.hairColor] ?? HAIR_COLORS[0];

  const lLeg = useRef<THREE.Group>(null);
  const rLeg = useRef<THREE.Group>(null);
  const lArm = useRef<THREE.Group>(null);
  const rArm = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const swingTarget = motion?.moving ? Math.sin(motion.phase) * 0.6 : 0;
    const ease = (ref: React.RefObject<THREE.Group>, target: number) => {
      if (ref.current) {
        ref.current.rotation.x = motion?.moving
          ? target
          : THREE.MathUtils.lerp(ref.current.rotation.x, 0, Math.min(1, dt * 10));
      }
    };
    ease(lLeg, swingTarget);
    ease(rLeg, -swingTarget);
    ease(lArm, -swingTarget * 0.7);
    ease(rArm, swingTarget * 0.7);
  });

  return (
    <group>
      {/* legs, pivoting at the hip */}
      <group ref={lLeg} position={[-0.12, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.6, 0.18]} />
          <meshStandardMaterial color="#4a3b28" roughness={1} />
        </mesh>
      </group>
      <group ref={rLeg} position={[0.12, 0.6, 0]}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.18, 0.6, 0.18]} />
          <meshStandardMaterial color="#4a3b28" roughness={1} />
        </mesh>
      </group>
      {/* torso */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <boxGeometry args={[0.52, 0.55, 0.3]} />
        <meshStandardMaterial color={shirtColor} roughness={1} />
      </mesh>
      {/* armour overlay */}
      {armor && (
        <mesh position={[0, 0.88, 0]} castShadow>
          <boxGeometry args={[0.58, 0.48, 0.36]} />
          <meshStandardMaterial
            color={armor === "iron" ? "#9aa0a6" : "#8a5a2f"}
            metalness={armor === "iron" ? 0.65 : 0.05}
            roughness={armor === "iron" ? 0.35 : 0.8}
          />
        </mesh>
      )}
      {/* arms, pivoting at the shoulder */}
      <group ref={lArm} position={[-0.34, 1.07, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <meshStandardMaterial color={sleeveColor} roughness={1} />
        </mesh>
      </group>
      <group ref={rArm} position={[0.34, 1.07, 0]}>
        <mesh position={[0, -0.25, 0]} castShadow>
          <boxGeometry args={[0.14, 0.5, 0.16]} />
          <meshStandardMaterial color={sleeveColor} roughness={1} />
        </mesh>
      </group>
      {/* head */}
      <mesh position={[0, 1.32, 0]} castShadow>
        <boxGeometry args={[0.32, 0.32, 0.3]} />
        <meshStandardMaterial color={skinColor} roughness={1} />
      </mesh>
      {/* hair (when no hat covers it) */}
      {!hat && appearance.hair === "short" && (
        <mesh position={[0, 1.47, -0.02]} castShadow>
          <boxGeometry args={[0.34, 0.1, 0.32]} />
          <meshStandardMaterial color={hairColor} roughness={1} />
        </mesh>
      )}
      {!hat && appearance.hair === "long" && (
        <>
          <mesh position={[0, 1.47, -0.02]} castShadow>
            <boxGeometry args={[0.34, 0.1, 0.32]} />
            <meshStandardMaterial color={hairColor} roughness={1} />
          </mesh>
          <mesh position={[0, 1.22, -0.18]} castShadow>
            <boxGeometry args={[0.34, 0.42, 0.08]} />
            <meshStandardMaterial color={hairColor} roughness={1} />
          </mesh>
        </>
      )}
      {/* beard */}
      {appearance.beard && (
        <mesh position={[0, 1.2, 0.15]}>
          <boxGeometry args={[0.28, 0.14, 0.06]} />
          <meshStandardMaterial color={hairColor} roughness={1} />
        </mesh>
      )}
      {/* accessories */}
      {appearance.accessory === "glasses" && (
        <mesh position={[0, 1.36, 0.17]}>
          <boxGeometry args={[0.32, 0.06, 0.02]} />
          <meshStandardMaterial color="#1e1a16" roughness={0.4} />
        </mesh>
      )}
      {appearance.accessory === "scarf" && (
        <mesh position={[0, 1.12, 0]}>
          <boxGeometry args={[0.4, 0.12, 0.36]} />
          <meshStandardMaterial color="#a8403a" roughness={1} />
        </mesh>
      )}
      {/* hats */}
      {hat === "straw" && (
        <group position={[0, 1.5, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.34, 0.36, 0.04, 10]} />
            <meshStandardMaterial color="#d9c27a" roughness={1} />
          </mesh>
          <mesh position={[0, 0.08, 0]} castShadow>
            <coneGeometry args={[0.2, 0.18, 10]} />
            <meshStandardMaterial color="#cdb568" roughness={1} />
          </mesh>
        </group>
      )}
      {hat === "cap" && (
        <group position={[0, 1.5, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.34, 0.12, 0.32]} />
            <meshStandardMaterial color="#3a5a8a" roughness={1} />
          </mesh>
          <mesh position={[0, -0.03, 0.22]} castShadow>
            <boxGeometry args={[0.3, 0.04, 0.14]} />
            <meshStandardMaterial color="#2e4a72" roughness={1} />
          </mesh>
        </group>
      )}
      {hat === "crown" && (
        <mesh position={[0, 1.52, 0]} castShadow>
          <cylinderGeometry args={[0.19, 0.17, 0.14, 8]} />
          <meshStandardMaterial color="#e8b53a" metalness={0.7} roughness={0.3} emissive="#6b4e10" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}
