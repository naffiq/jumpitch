import * as THREE from 'three';
import { CONFIG } from '../config';

/**
 * Side-on (profile) camera. The level scrolls along -Z, so viewing from +X
 * lays the melody out like a piano roll: time runs left→right across the
 * screen, pitch runs bottom→top. This makes upcoming note heights readable —
 * the sphere sits in the left third and the future fills the right.
 *
 * Vertical follow is deliberately gentle so screen-height stays a stable proxy
 * for pitch. A small downward tilt reveals platform tops and the grid floor.
 */
export class CameraRig {
  private look = new THREE.Vector3();
  private followY = 0;

  constructor(private camera: THREE.PerspectiveCamera) {}

  snap(sphereY: number, sphereZ: number): void {
    this.followY = this.targetFollowY(sphereY);
    this.apply(sphereZ);
  }

  update(dt: number, sphereY: number, sphereZ: number): void {
    const blend = 1 - Math.exp(-dt / CONFIG.cam.followTau);
    this.followY += (this.targetFollowY(sphereY) - this.followY) * blend;
    this.apply(sphereZ);
  }

  private targetFollowY(sphereY: number): number {
    return Math.max(CONFIG.cam.followClampLo, Math.min(CONFIG.cam.followClampHi, sphereY * CONFIG.cam.followFactor));
  }

  private apply(sphereZ: number): void {
    const z = sphereZ - CONFIG.cam.ahead;
    this.camera.position.set(CONFIG.cam.sideOffset, this.followY + CONFIG.cam.tilt, z);
    this.look.set(0, this.followY, z);
    this.camera.lookAt(this.look);
  }
}
