import { readFile } from 'node:fs/promises';
import { track } from '../src/client/track.js';
export async function physics() {
  const bytes = await readFile(new URL('../dist/physics.wasm', import.meta.url));
  const { instance } = await WebAssembly.instantiate(bytes, {
    env: {
      abort() {
        throw new Error('WASM abort');
      },
    },
  });
  const wasm = instance.exports;
  const state = new Float64Array(wasm.memory.buffer, wasm.statePointer(), 20);
  track.forEach((p, i) => wasm.setPoint(i, p.x, p.y, p.d));
  wasm.reset(track[0].x, track[0].y, track[0].a);
  return { wasm, state };
}
