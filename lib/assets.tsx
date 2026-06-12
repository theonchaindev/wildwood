"use client";

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

let sharedMaterial: THREE.MeshStandardMaterial | null = null;

export function usePaletteMaterial() {
  const tex = useTexture("/models/PP_Color_Palette.png");
  return useMemo(() => {
    if (!sharedMaterial) {
      tex.colorSpace = THREE.SRGBColorSpace;
      sharedMaterial = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0,
      });
    }
    return sharedMaterial;
  }, [tex]);
}

/**
 * Loads an FBX, applies the shared palette material, and normalizes it so the
 * requested dimension ("y" height, or "xz" footprint) equals `size`, with the
 * model centered on x/z. align "bottom" rests the base at y=0; "flush" embeds
 * the model so its top surface sits just above the ground (for thick ground
 * tiles like the meadow patches).
 */
export function useModel(
  file: string,
  size: number,
  by: "y" | "xz" = "y",
  align: "bottom" | "flush" = "bottom"
) {
  const fbx = useLoader(FBXLoader, `/models/${file}.fbx`);
  const material = usePaletteMaterial();

  return useMemo(() => {
    const obj = fbx.clone(true);
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
        child.castShadow = align !== "flush";
        child.receiveShadow = true;
      }
    });
    const box = new THREE.Box3().setFromObject(obj);
    const dims = box.getSize(new THREE.Vector3());
    const dim = by === "xz" ? Math.max(dims.x, dims.z) : dims.y;
    obj.scale.setScalar(size / (dim || 1));

    const box2 = new THREE.Box3().setFromObject(obj);
    const center = box2.getCenter(new THREE.Vector3());
    const yOff = align === "flush" ? -box2.max.y + 0.05 : -box2.min.y;
    obj.position.set(-center.x, yOff, -center.z);

    const group = new THREE.Group();
    group.add(obj);
    return group;
  }, [fbx, material, size, by, align]);
}

/**
 * Loads several FBX parts that are designed to butt together at their native
 * offsets (e.g. bridge left/middle/right), keeps those offsets, and normalizes
 * the assembled group as a single unit.
 */
export function useCompositeModel(files: string[], size: number, by: "y" | "xz" = "xz") {
  const fbxes = useLoader(
    FBXLoader,
    files.map((f) => `/models/${f}.fbx`)
  );
  const material = usePaletteMaterial();

  return useMemo(() => {
    const group = new THREE.Group();
    for (const fbx of fbxes) {
      const obj = fbx.clone(true);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = material;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(obj);
    }
    const box = new THREE.Box3().setFromObject(group);
    const dims = box.getSize(new THREE.Vector3());
    const dim = by === "xz" ? Math.max(dims.x, dims.z) : dims.y;
    const inner = new THREE.Group();
    while (group.children.length) inner.add(group.children[0]);
    inner.scale.setScalar(size / (dim || 1));
    const outer = new THREE.Group();
    outer.add(inner);
    const box2 = new THREE.Box3().setFromObject(inner);
    const center = box2.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -box2.min.y, -center.z);
    return outer;
  }, [fbxes, material, size, by]);
}

type ModelProps = {
  file: string;
  size: number;
  by?: "y" | "xz";
  align?: "bottom" | "flush";
  position: [number, number, number];
  rotationY?: number;
};

/** One placed instance of a normalized model (geometry/material shared via clone). */
export function Model({ file, size, by = "y", align = "bottom", position, rotationY = 0 }: ModelProps) {
  const proto = useModel(file, size, by, align);
  const instance = useMemo(() => proto.clone(true), [proto]);
  return (
    <primitive
      object={instance}
      position={position}
      rotation={[0, rotationY, 0]}
    />
  );
}
