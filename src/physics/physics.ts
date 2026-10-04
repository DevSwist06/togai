// A player car chasing one AI car; road constraints live entirely inside this WebAssembly module.
// State: x, y, heading, vx, vy, steering, speed, slip, progress, impact.
const state = new Float64Array(20);
const roadX = new Float64Array(2048);
const roadY = new Float64Array(2048);
const distance = new Float64Array(2048);
let count: i32 = 0;
const halfRoad: f64 = 10.4;
export function statePointer(): usize {
  return state.dataStart;
}
export function setPoint(i: i32, x: f64, y: f64, d: f64): void {
  if (i < 0 || i >= 2048 || !isFinite(x) || !isFinite(y) || !isFinite(d) || d < 0) return;
  roadX[i] = x;
  roadY[i] = y;
  distance[i] = d;
  count = i + 1;
}
export function reset(x: f64, y: f64, heading: f64): void {
  if (!isFinite(x) || !isFinite(y) || !isFinite(heading)) return;
  for (let i = 0; i < 20; i++) state[i] = 0;
  // The rival gets an 18 m head start. This leaves a clear passing window while
  // keeping both cars on the road's initial tangent.
  state[0] = x;
  state[1] = y;
  state[2] = heading;
  state[10] = x + Math.sin(heading) * 18.0;
  state[11] = y - Math.cos(heading) * 18.0;
  state[12] = heading;
}
export function step(
  car: i32,
  throttle: f64,
  steer: f64,
  brake: f64,
  handbrake: f64,
  dt: f64,
): void {
  if (
    car < 0 ||
    car > 1 ||
    !isFinite(dt) ||
    dt <= 0 ||
    dt > 0.1 ||
    !isFinite(throttle) ||
    !isFinite(steer) ||
    !isFinite(brake) ||
    !isFinite(handbrake)
  )
    return;
  throttle = Math.max(0, Math.min(1, throttle));
  steer = Math.max(-1, Math.min(1, steer));
  brake = Math.max(0, Math.min(1, brake));
  handbrake = Math.max(0, Math.min(1, handbrake));
  const k = car * 10;
  let angle = state[k + 2];
  let vx = state[k + 3],
    vy = state[k + 4];
  const speed = Math.sqrt(vx * vx + vy * vy);
  const steering = state[k + 5] + (steer - state[k + 5]) * Math.min(1.0, dt * 9.0);
  // Handbrake initiates a broad slide without the abrupt rotation or speed loss
  // of a simulation-focused drift model.
  const yaw = steering * Math.min(speed / 15.0, 1.0) * (1.12 + handbrake * 0.32);
  angle += yaw * dt;
  const fx = Math.sin(angle),
    fy = -Math.cos(angle);
  const rx = Math.cos(angle),
    ry = Math.sin(angle);
  let forward = vx * fx + vy * fy;
  let lateral = vx * rx + vy * ry;
  const grip = handbrake > 0.0 ? 2.3 : 5.0;
  lateral *= Math.exp(-grip * dt);
  const engineForce = car === 1 ? 20.0 : 13.0;
  const accel =
    throttle * engineForce -
    0.45 -
    forward * Math.abs(forward) * 0.0066 -
    brake * 26.0 -
    handbrake * 1.5;
  forward = Math.max(0.0, forward + accel * dt);
  vx = fx * forward + rx * lateral;
  vy = fy * forward + ry * lateral;
  let x = state[k] + vx * dt,
    y = state[k + 1] + vy * dt;
  let best = 1e20,
    nx = 0.0,
    ny = 0.0,
    prog = state[k + 8];
  for (let i = 0; i < count - 1; i++) {
    const ax = roadX[i],
      ay = roadY[i];
    const dx = roadX[i + 1] - ax,
      dy = roadY[i + 1] - ay;
    if (dx * dx + dy * dy < 0.000001) continue;
    const t = Math.max(0.0, Math.min(1.0, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
    const px = ax + t * dx,
      py = ay + t * dy;
    const dd = (x - px) * (x - px) + (y - py) * (y - py);
    if (dd < best) {
      best = dd;
      nx = px;
      ny = py;
      prog = distance[i] + t * (distance[i + 1] - distance[i]);
    }
  }
  state[k + 9] = Math.max(0.0, state[k + 9] - dt * 3.0);
  const edge = Math.sqrt(best);
  if (edge > halfRoad) {
    const ex = (x - nx) / edge,
      ey = (y - ny) / edge;
    x = nx + ex * halfRoad;
    y = ny + ey * halfRoad;
    const outward = vx * ex + vy * ey;
    if (outward > 0.0) {
      vx -= ex * outward * 1.15;
      vy -= ey * outward * 1.15;
    }
    vx *= Math.exp(-dt * 3.0);
    vy *= Math.exp(-dt * 3.0);
    state[k + 9] = 1.0;
  }
  state[k] = x;
  state[k + 1] = y;
  state[k + 2] = angle;
  state[k + 3] = vx;
  state[k + 4] = vy;
  state[k + 5] = steering;
  state[k + 6] = Math.sqrt(vx * vx + vy * vy);
  state[k + 7] = Math.atan2(lateral, Math.max(0.1, forward));
  state[k + 8] = prog;
}
// Returns whether the player and rival made contact this simulation step.
export function resolveCars(): i32 {
  let dx = state[10] - state[0],
    dy = state[11] - state[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 3.1) {
    if (dist > 0.001) {
      dx /= dist;
      dy /= dist;
    } else {
      dx = 1.0;
      dy = 0.0;
    }
    const push = (3.1 - dist) * 0.5;
    state[0] -= dx * push;
    state[1] -= dy * push;
    state[10] += dx * push;
    state[11] += dy * push;
    const relative = (state[3] - state[13]) * dx + (state[4] - state[14]) * dy;
    if (relative > 0.0) {
      state[3] -= dx * relative * 0.55;
      state[4] -= dy * relative * 0.55;
      state[13] += dx * relative * 0.55;
      state[14] += dy * relative * 0.55;
    }
    return 1;
  }
  return 0;
}
