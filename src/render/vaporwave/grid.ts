import * as THREE from 'three';
import { CONFIG } from '../../config';

/**
 * Neon grid floor. One static plane that follows the camera; the shader draws
 * lines at integer *world* coordinates, so the camera flying over it produces
 * the scroll for free — no geometry moves.
 */
export class GridFloor {
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene, private floorY: number) {
    const mat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        colA: { value: new THREE.Color(CONFIG.colors.gridA) },
        colB: { value: new THREE.Color(CONFIG.colors.gridB) },
        bg: { value: new THREE.Color(CONFIG.colors.fog).multiplyScalar(0.25) },
        camPos: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 colA; uniform vec3 colB; uniform vec3 bg; uniform vec3 camPos;
        varying vec3 vWorld;
        float gridLine(float coord) {
          float d = abs(fract(coord) - 0.5);
          float w = fwidth(coord);
          return 1.0 - smoothstep(0.0, w * 1.8, 0.5 - d);
        }
        void main() {
          float cell = 2.4;
          float lx = gridLine(vWorld.x / cell);
          float lz = gridLine(vWorld.z / cell);
          float line = max(lx, lz);
          float dist = length(vWorld.xz - camPos.xz);
          float fade = exp(-dist * 0.012);
          vec3 lineCol = mix(colA, colB, clamp(vWorld.x * 0.04 + 0.5, 0.0, 1.0));
          vec3 c = bg + lineCol * line * fade * 1.7; // >1 near camera → bloom
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(500, 700), mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = floorY - CONFIG.sphereRadius - 0.05;
    scene.add(this.mesh);
  }

  update(camera: THREE.Camera): void {
    // Keep the floor centered under the side camera along the scroll axis.
    this.mesh.position.set(0, this.floorY - CONFIG.sphereRadius - 0.05, camera.position.z);
    const mat = this.mesh.material as THREE.ShaderMaterial;
    (mat.uniforms.camPos.value as THREE.Vector3).copy(camera.position);
  }
}
