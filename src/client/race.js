import { aiInput, length, track } from './track.js';
export const STEP = 1 / 120;
export const FINISH_DISTANCE = length - 14;
// A car length of clearance means the player's rear axle is ahead of the rival.
export const OVERTAKE_CLEARANCE = 3.1;
export const OVERTAKE_CONFIRM_TIME = 5;
export function formatTime(time) {
  const ms = Math.round(time * 1000);
  return `${Math.floor(ms / 60000)
    .toString()
    .padStart(2, '0')}:${Math.floor((ms / 1000) % 60)
    .toString()
    .padStart(2, '0')}.${(ms % 1000).toString().padStart(3, '0')}`;
}
export function readInput(keys, touchKeys) {
  const pressed = (code) => keys.has(code) || (touchKeys?.has(code) ?? false);
  return {
    throttle: Number(pressed('KeyW') || pressed('ArrowUp')),
    steer:
      Number(pressed('KeyD') || pressed('ArrowRight')) -
      Number(pressed('KeyA') || pressed('ArrowLeft')),
    brake: Number(pressed('KeyS') || pressed('ArrowDown')),
    handbrake: Number(pressed('Space')),
  };
}
/** Deterministic race lifecycle. No DOM, audio, or renderer dependencies. */
export class Race {
  phase = 'intro';
  previousPhase = 'race';
  elapsed = 0;
  count = 3.2;
  driftTime = 0;
  overtakeDuration = 0;
  overtakeTime = null;
  rivalFinish = null;
  crashReason = null;
  constructor(wasm, state) {
    this.wasm = wasm;
    this.state = state;
  }
  reset() {
    this.wasm.reset(track[0].x, track[0].y, track[0].a);
    this.elapsed = 0;
    this.count = 3.2;
    this.driftTime = 0;
    this.overtakeDuration = 0;
    this.overtakeTime = null;
    this.rivalFinish = null;
    this.crashReason = null;
    this.phase = 'countdown';
  }
  pause() {
    if (!['race', 'countdown'].includes(this.phase)) return;
    this.previousPhase = this.phase;
    this.phase = 'paused';
  }
  resume() {
    if (this.phase === 'paused') this.phase = this.previousPhase;
  }
  get won() {
    return this.overtakeTime !== null;
  }
  tick(input) {
    if (this.phase === 'countdown') {
      this.count -= STEP;
      if (this.count <= 0) this.phase = 'race';
      return;
    }
    if (this.phase !== 'race') return;
    this.elapsed += STEP;
    const { throttle, steer, brake, handbrake } = input;
    this.wasm.step(0, throttle, steer, brake, handbrake, STEP);
    const ai = aiInput(this.state);
    this.wasm.step(
      1,
      this.rivalFinish === null ? ai.throttle : 0,
      ai.steer,
      this.rivalFinish === null ? ai.brake : 1,
      0,
      STEP,
    );
    const rivalCollision = this.wasm.resolveCars();
    if (rivalCollision || this.state[9] > 0) {
      this.crashReason = rivalCollision ? 'rival' : 'roadside';
      this.overtakeDuration = 0;
      this.phase = 'finished';
      return;
    }
    if (this.state[6] > 8 && Math.abs(this.state[7]) > 0.085) this.driftTime += STEP;
    if (this.rivalFinish === null && this.state[18] >= FINISH_DISTANCE)
      this.rivalFinish = this.elapsed;
    const clearPass = this.state[8] - this.state[18] >= OVERTAKE_CLEARANCE;
    this.overtakeDuration =
      clearPass && this.rivalFinish === null ? this.overtakeDuration + STEP : 0;
    if (this.overtakeDuration >= OVERTAKE_CONFIRM_TIME) this.overtakeTime = this.elapsed;
    if (this.overtakeTime !== null || this.rivalFinish !== null) this.phase = 'finished';
  }
}
