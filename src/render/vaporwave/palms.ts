import * as THREE from 'three';

/** Silhouette palm trees on canvas-drawn textures, recycled past the camera. */
const PALM_COUNT = 20;
const PALM_SPACING = 26; // world units between palms along the scroll axis
const PALM_LOOP = PALM_COUNT * PALM_SPACING;

export class Palms {
  private group = new THREE.Group();
  private palms: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, floorY: number) {
    const texture = new THREE.CanvasTexture(drawPalmSilhouette());
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
      color: 0x12063a,
      fog: false,
    });
    const geo = new THREE.PlaneGeometry(9, 14);
    for (let i = 0; i < PALM_COUNT; i++) {
      const palm = new THREE.Mesh(geo, mat);
      // Stand in the -X background between the action and the sun, spread along Z.
      palm.position.set(-55 - ((i * 37) % 5) * 9, floorY + 6, -i * PALM_SPACING);
      palm.rotation.y = Math.PI / 2; // face the +X side camera
      this.palms.push(palm);
      this.group.add(palm);
    }
    scene.add(this.group);
  }

  update(cameraZ: number): void {
    for (const palm of this.palms) {
      // As the camera advances along -Z, recycle palms that fall behind (+Z).
      if (palm.position.z > cameraZ + 30) palm.position.z -= PALM_LOOP;
      else if (palm.position.z < cameraZ - PALM_LOOP + 30) palm.position.z += PALM_LOOP;
    }
  }
}

function drawPalmSilhouette(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.strokeStyle = '#000';

  // curved trunk
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(110, 384);
  ctx.quadraticCurveTo(150, 230, 130, 110);
  ctx.stroke();

  // fronds
  const cx = 130;
  const cy = 105;
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI * 1.25 - Math.PI * 0.12;
    const len = 95 + (i % 3) * 14;
    const ex = cx + Math.cos(a) * len;
    const ey = cy - Math.sin(a) * len * 0.55;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo((cx + ex) / 2, ey - 28, ex, ey + 14);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fill();
  return c;
}
