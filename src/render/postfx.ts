import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';

export class PostFx {
  private composer: EffectComposer;
  private rgbShift: ShaderPass;
  private glitch = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(
      new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.9,
        0.6,
        0.85,
      ),
    );
    this.rgbShift = new ShaderPass(RGBShiftShader);
    this.rgbShift.uniforms['amount'].value = 0;
    this.rgbShift.enabled = false;
    this.composer.addPass(this.rgbShift);
    this.composer.addPass(new OutputPass());
  }

  /** Spike-hit feedback: a decaying chromatic-aberration burst. */
  triggerGlitch(): void {
    this.glitch = 1;
  }

  render(dt: number): void {
    if (this.glitch > 0.01) {
      this.glitch *= Math.exp(-dt / 0.07);
      this.rgbShift.enabled = true;
      this.rgbShift.uniforms['amount'].value = this.glitch * 0.012;
    } else if (this.rgbShift.enabled) {
      this.rgbShift.enabled = false;
      this.glitch = 0;
    }
    this.composer.render();
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
