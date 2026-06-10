import * as THREE from 'three';
import { CONFIG } from '../../config';

/** Giant inverted sphere with a vertical purple→magenta→orange gradient. */
export function createSky(scene: THREE.Scene): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(CONFIG.colors.sky0) },
      mid: { value: new THREE.Color(CONFIG.colors.sky1) },
      low: { value: new THREE.Color(CONFIG.colors.sky2) },
      horizon: { value: new THREE.Color(CONFIG.colors.horizon) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 horizon;
      varying vec3 vDir;
      void main() {
        float h = vDir.y; // -1..1
        vec3 c = mix(low, mid, smoothstep(0.02, 0.35, h));
        c = mix(c, top, smoothstep(0.35, 0.9, h));
        c = mix(horizon, c, smoothstep(-0.02, 0.06, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), mat);
  sky.frustumCulled = false;
  scene.add(sky);
  return sky;
}
