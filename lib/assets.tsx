"use client";

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useTexture, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// one shared material per texture atlas (nature palette, furniture pack, …)
const materialCache: Record<string, THREE.MeshStandardMaterial> = {};

export function useAtlasMaterial(path = "/models/PP_Color_Palette.png") {
  const tex = useTexture(path);
  return useMemo(() => {
    if (!materialCache[path]) {
      tex.colorSpace = THREE.SRGBColorSpace;
      materialCache[path] = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.85,
        metalness: 0,
      });
    }
    return materialCache[path];
  }, [tex, path]);
}

export function usePaletteMaterial() {
  return useAtlasMaterial();
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
  by: "y" | "xz" | "max" = "y",
  align: "bottom" | "flush" | "center" = "bottom",
  tex?: string
) {
  const fbx = useLoader(FBXLoader, `/models/${file}.fbx`);
  const material = useAtlasMaterial(tex);

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
    const dim =
      by === "xz" ? Math.max(dims.x, dims.z) : by === "max" ? Math.max(dims.x, dims.y, dims.z) : dims.y;
    obj.scale.setScalar(size / (dim || 1));

    const box2 = new THREE.Box3().setFromObject(obj);
    const center = box2.getCenter(new THREE.Vector3());
    // "center" fully centres the model (held items); others ground/embed it
    const yOff = align === "center" ? -center.y : align === "flush" ? -box2.max.y + 0.05 : -box2.min.y;
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

/**
 * Like useModel but for self-contained .glb files (keeps their own textures /
 * materials). glTF is Y-up by spec, so orientation comes through correctly.
 */
export function useGltfModel(
  file: string,
  size: number,
  by: "y" | "xz" | "max" = "y",
  align: "bottom" | "flush" | "center" = "bottom",
  rotX = 0
) {
  const gltf = useGLTF(`/models/${file}`);
  return useMemo(() => {
    const inner = (gltf.scene as THREE.Object3D).clone(true);
    // some FBX-derived glb's land on their side — straighten before measuring
    const obj = new THREE.Group();
    obj.add(inner);
    obj.rotation.x = rotX;
    // Bake any rigged (skinned) meshes down to static geometry in their bind
    // pose. Skinned meshes don't survive cloning + re-scaling reliably; the
    // rest-pose geometry already shows the full model, so we just freeze it.
    // Also drop cameras/lights/bones that ship in exported scenes and would
    // otherwise blow up the bounding box.
    const swaps: [THREE.Object3D, THREE.Mesh][] = [];
    const junk: THREE.Object3D[] = [];
    obj.traverse((child) => {
      if ((child as any).isSkinnedMesh) {
        const sm = child as THREE.SkinnedMesh;
        const m = new THREE.Mesh(sm.geometry, sm.material);
        m.position.copy(sm.position);
        m.quaternion.copy(sm.quaternion);
        m.scale.copy(sm.scale);
        m.castShadow = align !== "flush";
        m.receiveShadow = true;
        swaps.push([sm, m]);
      } else if (child instanceof THREE.Mesh) {
        child.castShadow = align !== "flush";
        child.receiveShadow = true;
      } else if ((child as any).isCamera || (child as any).isLight || (child as any).isBone) {
        junk.push(child);
      }
    });
    for (const [old, m] of swaps) { old.parent?.add(m); old.parent?.remove(old); }
    for (const j of junk) j.parent?.remove(j);

    // measure ONLY the mesh geometry (ignores empties/bones still in the tree)
    const meshBox = () => {
      obj.updateWorldMatrix(true, true);
      const b = new THREE.Box3();
      obj.traverse((c) => {
        if (c instanceof THREE.Mesh && c.geometry) {
          c.geometry.computeBoundingBox();
          if (c.geometry.boundingBox) {
            b.union(c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld));
          }
        }
      });
      return b;
    };

    const box = meshBox();
    const dims = box.getSize(new THREE.Vector3());
    const dim =
      by === "xz" ? Math.max(dims.x, dims.z) : by === "max" ? Math.max(dims.x, dims.y, dims.z) : dims.y;
    obj.scale.setScalar(size / (dim || 1));

    const box2 = meshBox();
    const center = box2.getCenter(new THREE.Vector3());
    const yOff = align === "center" ? -center.y : align === "flush" ? -box2.max.y + 0.05 : -box2.min.y;
    obj.position.set(-center.x, yOff, -center.z);

    const group = new THREE.Group();
    group.add(obj);
    return group;
  }, [gltf, size, by, align, rotX]);
}

export function GltfModel({
  file, size, by = "y", align = "bottom", position, rotationY = 0, rotX = 0,
}: {
  file: string; size: number; by?: "y" | "xz" | "max"; align?: "bottom" | "flush" | "center";
  position: [number, number, number]; rotationY?: number; rotX?: number;
}) {
  // useGltfModel already returns a fresh (skeleton-safe) clone; render as-is
  const proto = useGltfModel(file, size, by, align, rotX);
  return <primitive object={proto} position={position} rotation={[0, rotationY, 0]} />;
}

type ModelProps = {
  file: string;
  size: number;
  by?: "y" | "xz";
  align?: "bottom" | "flush";
  position: [number, number, number];
  rotationY?: number;
  tex?: string;
};

/** One placed instance of a normalized model (geometry/material shared via clone). */
export function Model({ file, size, by = "y", align = "bottom", position, rotationY = 0, tex }: ModelProps) {
  const proto = useModel(file, size, by, align, tex);
  const instance = useMemo(() => proto.clone(true), [proto]);
  return (
    <primitive
      object={instance}
      position={position}
      rotation={[0, rotationY, 0]}
    />
  );
}
