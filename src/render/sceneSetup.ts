import * as THREE from 'three';
import { CONFIG } from '../config';

export interface RenderCore {
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  dispose(): void;
}

/** One renderer for the whole app lifetime (WebGL contexts are scarce). */
export function createRenderCore(container: HTMLElement): RenderCore {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  return {
    renderer,
    canvas: renderer.domElement,
    dispose() {
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(CONFIG.colors.fog, 40, 160);
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  const dir = new THREE.DirectionalLight(0xff8cd9, 1.2);
  dir.position.set(5, 10, 7);
  scene.add(ambient, dir);
  return scene;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    CONFIG.cameraFov,
    window.innerWidth / window.innerHeight,
    0.1,
    600,
  );
  camera.position.set(CONFIG.cam.sideOffset, 3, 9);
  return camera;
}

export function disposeScene(scene: THREE.Scene): void {
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
  });
  scene.clear();
}
