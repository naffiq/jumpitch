import * as THREE from 'three';
import { CONFIG } from '../config';
import type { SpikeRowDef } from '../game/level';

const SPIKE_HEIGHT = 1.1;
const SPIKE_RADIUS = 0.28;

interface SpikeInstance {
  z: number;
  y: number; // tip Y (spikes hang downward)
}

export class Spikes {
  readonly mesh: THREE.InstancedMesh;
  private instances: SpikeInstance[] = [];

  constructor(scene: THREE.Scene, rows: SpikeRowDef[]) {
    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const t = row.count === 1 ? 0.5 : i / (row.count - 1);
        this.instances.push({
          z: row.zStart + (row.zEnd - row.zStart) * t,
          y: row.y,
        });
      }
    }
    const geo = new THREE.ConeGeometry(SPIKE_RADIUS, SPIKE_HEIGHT, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(CONFIG.colors.spike).multiplyScalar(1.4),
      toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, this.instances.length));
    const m = new THREE.Matrix4();
    const flip = new THREE.Matrix4().makeRotationX(Math.PI); // point down
    this.instances.forEach((s, i) => {
      m.copy(flip);
      // cone origin is its center; tip sits at s.y, base above it
      m.setPosition(0, s.y + SPIKE_HEIGHT / 2, s.z);
      this.mesh.setMatrixAt(i, m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.count = this.instances.length;
    scene.add(this.mesh);
  }

  /**
   * Sphere-vs-spike check. Sweeps the Z range the sphere crossed this frame
   * (prevZ → sphereZ) so a fast scroll can't tunnel between two frames.
   */
  collides(sphereY: number, sphereZ: number, prevSphereZ: number): boolean {
    const r = CONFIG.sphereRadius;
    const lo = Math.min(sphereZ, prevSphereZ) - r - SPIKE_RADIUS;
    const hi = Math.max(sphereZ, prevSphereZ) + r + SPIKE_RADIUS;
    for (const s of this.instances) {
      if (s.z < lo || s.z > hi) continue;
      // Sphere's top reaches the hanging tip, and its center is below the base.
      if (sphereY + r > s.y && sphereY < s.y + SPIKE_HEIGHT) return true;
    }
    return false;
  }
}
