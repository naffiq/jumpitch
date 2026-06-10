/**
 * Folds a detected midi pitch into the melody's register so any voice range
 * (bass to soprano) controls the same lane.
 *
 * On a voiced onset, pick the octave shift k that lands closest to the
 * register center. While continuously voiced, re-pick k each frame minimizing
 * distance to the previous folded value, so a singer drifting across a fold
 * boundary doesn't make the sphere teleport an octave.
 */
export class OctaveFolder {
  private registerCenter = 60;
  private prevFolded: number | null = null;

  setRegister(center: number): void {
    this.registerCenter = center;
    this.prevFolded = null;
  }

  fold(midiFloat: number, voicedOnset: boolean): number {
    const anchor =
      voicedOnset || this.prevFolded === null ? this.registerCenter : this.prevFolded;
    const k = Math.round((anchor - midiFloat) / 12);
    const folded = midiFloat + 12 * k;
    this.prevFolded = folded;
    return folded;
  }

  reset(): void {
    this.prevFolded = null;
  }
}
