import { CONFIG } from '../config';

export function timeToZ(t: number): number {
  return -t * CONFIG.scrollSpeed;
}

export function midiToY(midi: number, registerCenter: number): number {
  return (midi - registerCenter) * CONFIG.semitoneHeight;
}

export function floorY(registerMin: number, registerCenter: number): number {
  return midiToY(registerMin, registerCenter) - 4;
}
