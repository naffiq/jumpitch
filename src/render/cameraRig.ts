import * as THREE from 'three';
import { CONFIG } from '../config';

/**
 * Chase camera. The level scrolls along -Z, so the camera sits behind the
 * sphere (toward +Z) and swung ~30° to the side (azimuth), giving an
 * over-the-shoulder 3/4 view down the oncoming notes, with a gentle elevation
 * so the floor and note heights read. Framing the action along the depth axis
 * keeps the whole playfield readable on tall/portrait phone screens, where the
 * old side-on view (time running left→right) cropped the melody and pushed the
 * ball off-frame.
 *
 * The camera height fully tracks the sphere (gently smoothed) so the ball
 * stays framed; platforms further ahead and above/below read as the upcoming
 * higher/lower notes.
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
    return Math.max(
      CONFIG.cam.followClampLo,
      Math.min(CONFIG.cam.followClampHi, sphereY * CONFIG.cam.followFactor),
    );
  }

  private apply(sphereZ: number): void {
    const az = (CONFIG.cam.azimuthDeg * Math.PI) / 180;
    const el = (CONFIG.cam.elevationDeg * Math.PI) / 180;
    // Aim slightly ahead of the sphere (toward -Z) so the ball sits low in the
    // frame and the oncoming notes fill the upper screen.
    const lookZ = sphereZ - CONFIG.cam.ahead;
    const lookY = this.followY;
    // Portrait phones have a narrow horizontal FOV that crops the scene; pull
    // the camera back proportionally to how tall/narrow the viewport is.
    const aspect = this.camera.aspect || 1;
    const distance =
      CONFIG.cam.distance * (aspect < 1 ? 1 + (1 - aspect) * CONFIG.cam.portraitZoomOut : 1);
    // Back vector (look point → camera): behind is +Z, swung horizontally by
    // the azimuth and raised by the elevation.
    const horiz = distance * Math.cos(el);
    this.camera.position.set(
      horiz * Math.sin(az),
      lookY + distance * Math.sin(el),
      lookZ + horiz * Math.cos(az),
    );
    this.look.set(0, lookY, lookZ);
    this.camera.lookAt(this.look);
  }
}
