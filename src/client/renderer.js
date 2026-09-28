import { track, length, atDistance } from './track.js';
const color = (hex) => [
  parseInt(hex.slice(0, 2), 16) / 255,
  parseInt(hex.slice(2, 4), 16) / 255,
  parseInt(hex.slice(4, 6), 16) / 255,
];
const palette = {
  road: color('414945'),
  edge: color('969c82'),
  line: color('b5aa73'),
  earth: color('5b6550'),
  shadow: color('222f29'),
  grass: color('3a4a39'),
};
export class Mesh {
  constructor() {
    this.data = [];
  }
  vertex(x, y, c) {
    this.data.push(x, y, ...c);
  }
  tri(a, b, c, col) {
    this.vertex(...a, col);
    this.vertex(...b, col);
    this.vertex(...c, col);
  }
  quad(a, b, c, d, col) {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }
  rect(x, y, w, h, angle, col) {
    const s = Math.sin(angle),
      c = Math.cos(angle);
    const p = (a, b) => [x + a * c - b * s, y + a * s + b * c];
    this.quad(p(-w / 2, -h / 2), p(w / 2, -h / 2), p(w / 2, h / 2), p(-w / 2, h / 2), col);
  }
  disc(x, y, r, col, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      this.tri(
        [x, y],
        [x + Math.cos(a) * r, y + Math.sin(a) * r],
        [x + Math.cos(b) * r, y + Math.sin(b) * r],
        col,
      );
    }
  }
  line(ax, ay, bx, by, width, col) {
    const d = Math.hypot(bx - ax, by - ay) || 1,
      nx = ((-(by - ay) / d) * width) / 2,
      ny = (((bx - ax) / d) * width) / 2;
    this.quad([ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny], col);
  }
}
function roadStrip(mesh, width, col, offset = 0) {
  for (let i = 0; i < track.length - 1; i++) {
    const a = track[i],
      b = track[i + 1];
    mesh.quad(
      [a.x + a.nx * (offset - width / 2), a.y + a.ny * (offset - width / 2)],
      [b.x + b.nx * (offset - width / 2), b.y + b.ny * (offset - width / 2)],
      [b.x + b.nx * (offset + width / 2), b.y + b.ny * (offset + width / 2)],
      [a.x + a.nx * (offset + width / 2), a.y + a.ny * (offset + width / 2)],
      col,
    );
  }
}
function scenery() {
  const m = new Mesh();
  let seed = 42;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  // Low-poly forest floor and contour-like rock shelves, generated once.
  for (let y = -1750; y < 200; y += 65)
    for (let x = -600; x < 700; x += 65) {
      const c = [0.19 + random() * 0.025, 0.255 + random() * 0.025, 0.195 + random() * 0.02];
      m.quad([x, y], [x + 65, y], [x + 65, y + 65], [x, y + 65], c);
    }
  roadStrip(m, 58, palette.shadow, 6);
  roadStrip(m, 45, palette.earth, 2);
  roadStrip(m, 33, color('69715a'), 1);
  roadStrip(m, 28, color('85886b'));
  roadStrip(m, 25, palette.edge);
  roadStrip(m, 23, palette.road);
  roadStrip(m, 0.23, color('b2b49a'), 10.4);
  roadStrip(m, 0.23, color('b2b49a'), -10.4);
  for (let d = 4; d < length; d += 12) {
    const a = atDistance(d),
      b = atDistance(d + 5);
    m.line(a.x, a.y, b.x, b.y, 0.28, palette.line);
  }
  // Outer guardrails, reflectors and alternating curb sections.
  for (let d = 10; d < length - 15; d += 7) {
    const a = atDistance(d),
      b = atDistance(d + 5.5);
    for (const side of [-1, 1]) {
      const o = side * 12.9;
      m.line(
        a.x + a.nx * o + 1,
        a.y + a.ny * o + 1,
        b.x + b.nx * o + 1,
        b.y + b.ny * o + 1,
        0.8,
        palette.shadow,
      );
      m.line(a.x + a.nx * o, a.y + a.ny * o, b.x + b.nx * o, b.y + b.ny * o, 0.48, color('bfc3ab'));
      m.rect(a.x + a.nx * o, a.y + a.ny * o, 0.7, 0.7, 0, color('e1a468'));
    }
    if (Math.floor(d / 7) % 2 === 0)
      m.line(
        a.x + a.nx * 11.7,
        a.y + a.ny * 11.7,
        b.x + b.nx * 11.7,
        b.y + b.ny * 11.7,
        1,
        color('ae6d50'),
      );
  }
  for (let i = 0; i < 3700; i++) {
    const x = -560 + random() * 1240,
      y = -1720 + random() * 1900;
    let near = 1e9;
    for (let j = 0; j < track.length; j += 3)
      near = Math.min(near, (track[j].x - x) ** 2 + (track[j].y - y) ** 2);
    if (near < 29 * 29) continue;
    const r = 3 + random() * 7;
    m.disc(x + 3, y + 4, r * 1.1, color('24382b'), 7);
    const c = random();
    m.disc(x, y, r, [0.14 + c * 0.05, 0.23 + c * 0.065, 0.17 + c * 0.025], 7);
    m.disc(x - 1, y - 1, r * 0.65, [0.19 + c * 0.05, 0.28 + c * 0.05, 0.19 + c * 0.04], 6);
  }
  for (const d of [18, length - 13]) {
    const p = atDistance(d);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 12; col++) {
        const x = (col - 5.5) * 1.7,
          y = (row - 0.5) * 1.7;
        m.rect(
          p.x + x * Math.cos(p.a) - y * Math.sin(p.a),
          p.y + x * Math.sin(p.a) + y * Math.cos(p.a),
          1.7,
          1.7,
          p.a,
          (row + col) % 2 ? color('d5d8c3') : color('303c34'),
        );
      }
  }
  return new Float32Array(m.data);
}
const shader = `
struct View { center: vec2f, extent: vec2f }
@group(0) @binding(0) var<uniform> view: View;
struct Output { @builtin(position) pos: vec4f, @location(0) color: vec3f }
@vertex fn vertex(@location(0) pos: vec2f, @location(1) color: vec3f) -> Output {
 var o: Output; let p=(pos-view.center)/view.extent;
 o.pos=vec4f(p.x,-p.y,0,1);o.color=color;return o;
}
@fragment fn fragment(input: Output) -> @location(0) vec4f { return vec4f(input.color,1); }
`;
export async function createRenderer(canvas) {
  if (!navigator.gpu)
    throw new Error(
      'This prototype requires WebGPU. Open it in a current WebGPU-capable browser with hardware acceleration enabled, on localhost or HTTPS.',
    );
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter)
    throw new Error(
      'No WebGPU adapter is available. Enable hardware acceleration and reopen the game in a WebGPU-capable browser.',
    );
  const device = await adapter.requestDevice();
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const module = device.createShaderModule({ code: shader });
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertex',
      buffers: [
        {
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x3' },
          ],
        },
      ],
    },
    fragment: { module, entryPoint: 'fragment', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  });
  const scene = scenery(),
    staticBuffer = device.createBuffer({
      size: scene.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  device.queue.writeBuffer(staticBuffer, 0, scene);
  const dynamicBuffer = device.createBuffer({
    size: 2 * 1024 * 1024,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  const uniform = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const group = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: uniform } }],
  });
  const values = new Float32Array(4);
  const upload = new Float32Array((2 * 1024 * 1024) / 4);
  let width = 0,
    height = 0;
  return {
    device,
    draw(camera, dynamic) {
      const dpr = Math.min(devicePixelRatio, 1.5),
        w = Math.round(innerWidth * dpr),
        h = Math.round(innerHeight * dpr);
      if (w !== width || h !== height) {
        canvas.width = width = w;
        canvas.height = height = h;
      }
      values.set([camera.x, camera.y, (camera.zoom * width) / height, camera.zoom]);
      device.queue.writeBuffer(uniform, 0, values);
      const floats = dynamic.data.length;
      if (floats > upload.length) throw new Error('Dynamic geometry budget exceeded');
      if (floats) {
        upload.set(dynamic.data);
        device.queue.writeBuffer(dynamicBuffer, 0, upload, 0, floats);
      }
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0.18, g: 0.24, b: 0.18, a: 1 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, group);
      pass.setVertexBuffer(0, staticBuffer);
      pass.draw(scene.length / 5);
      if (floats) {
        pass.setVertexBuffer(0, dynamicBuffer);
        pass.draw(floats / 5);
      }
      pass.end();
      device.queue.submit([encoder.finish()]);
    },
  };
}
export function drawCar(m, x, y, a, col, steering = 0) {
  const local = (lx, ly) => [
    x + lx * Math.cos(a) - ly * Math.sin(a),
    y + lx * Math.sin(a) + ly * Math.cos(a),
  ];
  m.rect(x + 0.55, y + 0.8, 2.5, 4.9, a, color('1b2925'));
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      const p = local(sx * 1.06, sy * 1.45);
      m.rect(...p, 0.5, 1, a + (sy < 0 ? steering * 0.35 : 0), color('17201e'));
    }
  m.rect(x, y, 2.1, 4.6, a, col);
  let p = local(0, -0.45);
  m.rect(...p, 1.72, 1.1, a, color('263e3e'));
  p = local(0, 0.6);
  m.rect(
    ...p,
    1.65,
    1.1,
    a,
    col.map((v) => Math.min(1, v * 1.2)),
  );
  p = local(0, 1.45);
  m.rect(...p, 1.7, 0.55, a, color('263e3e'));
  for (const side of [-1, 1]) {
    p = local(side * 0.7, -2.13);
    m.rect(...p, 0.48, 0.25, a, color('faf1c9'));
    p = local(side * 0.75, 2.14);
    m.rect(...p, 0.36, 0.2, a, color('b9543e'));
  }
  p = local(0, 1.95);
  m.rect(...p, 2.3, 0.22, a, color('1c2a27'));
}
export { color };
