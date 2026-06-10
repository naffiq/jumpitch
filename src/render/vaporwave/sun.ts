import * as THREE from 'three';
import { CONFIG } from '../../config';

/** The striped retro sun: radial gradient disc with horizontal slits cut out. */
export class Sun {
  private mesh: THREE.Mesh;

  constructor(scene: THREE.Scene) {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        cTop: { value: new THREE.Color(CONFIG.colors.sun0) },
        cBot: { value: new THREE.Color(CONFIG.colors.sun1) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 cTop; uniform vec3 cBot;
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          if (r > 1.0) discard;
          // slit bands widening toward the bottom
          float bands = fract(vUv.y * 12.0);
          float slit = smoothstep(0.55, 0.0, vUv.y) * 0.45;
          if (vUv.y < 0.5 && bands < slit) discard;
          vec3 c = mix(cBot, cTop, vUv.y);
          float edge = smoothstep(1.0, 0.92, r);
          gl_FragColor = vec4(c * 1.6, edge); // >1 → bloom halo
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(46, 48), mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  /** Pin the sun to the horizon behind the play plane (the -X background). */
  update(cameraPos: THREE.Vector3): void {
    this.mesh.position.set(cameraPos.x - 240, 16, cameraPos.z);
    this.mesh.lookAt(cameraPos.x, 16, cameraPos.z); // face the side camera
  }
}
