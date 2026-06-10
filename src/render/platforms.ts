import * as THREE from 'three';
import { CONFIG } from '../config';
import type { PlatformDef } from '../game/level';

const PLATFORM_WIDTH = 2.2;
const PLATFORM_THICKNESS = 0.18;

/**
 * All platforms in one InstancedMesh; per-instance HDR color drives bloom.
 * Demo (teacher) platforms get their own base/flash colors so the player can
 * tell the example apart from the notes they have to sing.
 */
export class Platforms {
  readonly mesh: THREE.InstancedMesh;
  private flash: Float32Array;
  private baseColors: THREE.Color[];
  private flashColors: THREE.Color[];
  private tmp = new THREE.Color();

  private responseBase = new THREE.Color(CONFIG.colors.platform).multiplyScalar(0.8);
  private responseFlash = new THREE.Color(CONFIG.colors.platformHit);
  private demoBase = new THREE.Color(CONFIG.colors.demoPlatform).multiplyScalar(0.7);
  private demoFlash = new THREE.Color(CONFIG.colors.demoPlatformHit);

  constructor(scene: THREE.Scene, private defs: PlatformDef[]) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, defs.length));
    this.flash = new Float32Array(defs.length);
    this.baseColors = [];
    this.flashColors = [];

    const m = new THREE.Matrix4();
    defs.forEach((def, i) => {
      const length = Math.max(0.6, Math.abs(def.zEnd - def.zStart) - 0.15);
      const zCenter = (def.zStart + def.zEnd) / 2;
      m.makeScale(PLATFORM_WIDTH, PLATFORM_THICKNESS, length);
      m.setPosition(0, def.y - PLATFORM_THICKNESS / 2 - CONFIG.sphereRadius, zCenter);
      this.mesh.setMatrixAt(i, m);
      const base = def.demo ? this.demoBase : this.responseBase;
      this.baseColors.push(base);
      this.flashColors.push(def.demo ? this.demoFlash : this.responseFlash);
      this.mesh.setColorAt(i, base);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);
  }

  /** Light a platform up when its note starts sounding. */
  hit(index: number): void {
    this.flash[index] = 1;
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.defs.length; i++) {
      if (this.flash[i] <= 0.001) continue;
      this.flash[i] *= Math.exp(-dt / 0.3);
      this.tmp
        .copy(this.baseColors[i])
        .lerp(this.flashColors[i], Math.min(1, this.flash[i]))
        .multiplyScalar(1 + this.flash[i] * 2.2); // >1 → blooms
      this.mesh.setColorAt(i, this.tmp);
      dirty = true;
    }
    if (dirty && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
