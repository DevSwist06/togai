import assert from 'node:assert/strict';
import test from 'node:test';
import { webgpuLaunchArgs } from '../../scripts/webgpu-launch-options.mjs';

test('Linux WebGPU tests opt into Chromium software rendering', () => {
  assert.deepEqual(webgpuLaunchArgs('linux'), [
    '--enable-unsafe-webgpu',
    '--use-angle=swiftshader',
    '--enable-features=Vulkan',
    '--enable-unsafe-swiftshader',
  ]);
});

test('macOS WebGPU tests keep the installed Chrome adapter', () => {
  assert.deepEqual(webgpuLaunchArgs('darwin'), ['--enable-unsafe-webgpu']);
});
