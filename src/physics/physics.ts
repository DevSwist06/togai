// A player car chasing one AI car; road constraints live entirely inside this WebAssembly module.
// State: x, y, heading, vx, vy, steering, speed, slip, progress, impact.
const state = new Float64Array(20);
const roadX = new Float64Array(2048);
const roadY = new Float64Array(2048);
const distance = new Float64Array(2048);
let count: i32 = 0;
const halfRoad: f64 = 10.4;
const carHalfWidth: f64 = 1.05;
const carHalfLength: f64 = 2.3;
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
// Fixed capacity hazard records: world x/y, patch half-width/length, heading, kind (1 snow, 2 ice).
// State layout stays at 10 float64 values per car. Reset preserves course hazards.
const surfaceX = new Float64Array(64);
const surfaceY = new Float64Array(64);
const surfaceWidth = new Float64Array(64);
const surfaceLength = new Float64Array(64);
const surfaceAngle = new Float64Array(64);
let courseSpeed: f64 = 1.0;
export function setCourseSpeed(value: f64): void {
  if (isFinite(value) && value >= 1 && value <= 2) courseSpeed = value;
}
const surfaceType = new Int32Array(64);
let surfaceCount: i32 = 0;
export function clearSurfaces(): void {
  surfaceCount = 0;
}
export function setSurface(
  i: i32,
  x: f64,
  y: f64,
  width: f64,
  length: f64,
  angle: f64,
  kind: i32,
): void {
  if (
    i < 0 ||
    i >= 64 ||
    i > surfaceCount ||
    !isFinite(x) ||
    !isFinite(y) ||
    Math.abs(x) > 10000 ||
    Math.abs(y) > 10000 ||
    !isFinite(width) ||
    width <= 0 ||
    width > 30 ||
    !isFinite(length) ||
    length <= 0 ||
    length > 60 ||
    !isFinite(angle) ||
    Math.abs(angle) > 100 ||
    (kind !== 1 && kind !== 2)
  )
    return;
  surfaceX[i] = x;
  surfaceY[i] = y;
  surfaceWidth[i] = width;
  surfaceLength[i] = length;
  surfaceAngle[i] = angle;
  surfaceType[i] = kind;
  if (i >= surfaceCount) surfaceCount = i + 1;
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
  let snow = false,
    ice = false;
  for (let i = 0; i < surfaceCount; i++) {
    const dx = state[k] - surfaceX[i],
      dy = state[k + 1] - surfaceY[i];
    const c = Math.cos(surfaceAngle[i]),
      s = Math.sin(surfaceAngle[i]);
    const localX = dx * c + dy * s;
    const localY = -dx * s + dy * c;
    const width = surfaceWidth[i],
      height = surfaceLength[i];
    const corner = Math.min(width * 0.22, 1.2);
    const cornerX = Math.max(Math.abs(localX) - (width - corner), 0.0),
      cornerY = Math.max(Math.abs(localY) - (height - corner), 0.0);
    const inside =
      surfaceType[i] === 1
        ? (localX / width) ** 2 + (localY / height) ** 2 < 1.0
        : Math.abs(localX) < width &&
          Math.abs(localY) < height &&
          cornerX * cornerX + cornerY * cornerY < corner * corner;
    if (inside) {
      if (surfaceType[i] === 1) snow = true;
      else ice = true;
    }
  }
  let angle = state[k + 2];
  let vx = state[k + 3],
    vy = state[k + 4];
  const speed = Math.sqrt(vx * vx + vy * vy);
  const steering = state[k + 5] + (steer - state[k + 5]) * Math.min(1.0, dt * 9.0);
  // Handbrake initiates a broad slide without the abrupt rotation or speed loss
  // of a simulation-focused drift model.
  const yaw = steering * Math.min(speed / 15.0, 1.0) * (1.12 + handbrake * 0.32);
  angle += yaw * dt * (ice ? 0.32 : 1.0);
  const fx = Math.sin(angle),
    fy = -Math.cos(angle);
  const rx = Math.cos(angle),
    ry = Math.sin(angle);
  let forward = vx * fx + vy * fy;
  let lateral = vx * rx + vy * ry;
  const grip = ice ? 0.3 : handbrake > 0.0 ? 2.3 : 5.0;
  lateral *= Math.exp(-grip * dt);
  const engineForce = car === 1 ? 20.0 : 13.0;
  const accel =
    throttle * engineForce * courseSpeed -
    0.45 -
    (forward * Math.abs(forward) * (ice ? 0.0058 : 0.0066)) / courseSpeed +
    (ice && speed > 1.0 ? 1.8 : 0.0) -
    brake * 26.0 -
    handbrake * 1.5;
  forward = Math.max(0.0, forward + accel * dt);
  forward *= Math.exp(-(snow ? 1.5 : 0.0) * dt);
  lateral *= Math.exp(-(snow ? 1.5 : 0.0) * dt);
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
function rectanglesOverlap(
  dx: f64,
  dy: f64,
  axisX: f64,
  axisY: f64,
  playerForwardX: f64,
  playerForwardY: f64,
  playerRightX: f64,
  playerRightY: f64,
  rivalForwardX: f64,
  rivalForwardY: f64,
  rivalRightX: f64,
  rivalRightY: f64,
): i32 {
  const centerProjection = Math.abs(dx * axisX + dy * axisY);
  const playerProjection =
    carHalfLength * Math.abs(playerForwardX * axisX + playerForwardY * axisY) +
    carHalfWidth * Math.abs(playerRightX * axisX + playerRightY * axisY);
  const rivalProjection =
    carHalfLength * Math.abs(rivalForwardX * axisX + rivalForwardY * axisY) +
    carHalfWidth * Math.abs(rivalRightX * axisX + rivalRightY * axisY);
  return centerProjection <= playerProjection + rivalProjection ? 1 : 0;
}
// Returns whether the player and rival made contact this simulation step.
export function resolveCars(): i32 {
  let dx = state[10] - state[0],
    dy = state[11] - state[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  const playerForwardX = Math.sin(state[2]),
    playerForwardY = -Math.cos(state[2]),
    playerRightX = Math.cos(state[2]),
    playerRightY = Math.sin(state[2]),
    rivalForwardX = Math.sin(state[12]),
    rivalForwardY = -Math.cos(state[12]),
    rivalRightX = Math.cos(state[12]),
    rivalRightY = Math.sin(state[12]);
  if (
    rectanglesOverlap(
      dx,
      dy,
      playerForwardX,
      playerForwardY,
      playerForwardX,
      playerForwardY,
      playerRightX,
      playerRightY,
      rivalForwardX,
      rivalForwardY,
      rivalRightX,
      rivalRightY,
    ) &&
    rectanglesOverlap(
      dx,
      dy,
      playerRightX,
      playerRightY,
      playerForwardX,
      playerForwardY,
      playerRightX,
      playerRightY,
      rivalForwardX,
      rivalForwardY,
      rivalRightX,
      rivalRightY,
    ) &&
    rectanglesOverlap(
      dx,
      dy,
      rivalForwardX,
      rivalForwardY,
      playerForwardX,
      playerForwardY,
      playerRightX,
      playerRightY,
      rivalForwardX,
      rivalForwardY,
      rivalRightX,
      rivalRightY,
    ) &&
    rectanglesOverlap(
      dx,
      dy,
      rivalRightX,
      rivalRightY,
      playerForwardX,
      playerForwardY,
      playerRightX,
      playerRightY,
      rivalForwardX,
      rivalForwardY,
      rivalRightX,
      rivalRightY,
    )
  ) {
    let normalX = dx,
      normalY = dy;
    if (dist > 0.001) {
      normalX /= dist;
      normalY /= dist;
    } else {
      normalX = 1.0;
      normalY = 0.0;
    }
    const playerRadius =
        carHalfLength * Math.abs(playerForwardX * normalX + playerForwardY * normalY) +
        carHalfWidth * Math.abs(playerRightX * normalX + playerRightY * normalY),
      rivalRadius =
        carHalfLength * Math.abs(rivalForwardX * normalX + rivalForwardY * normalY) +
        carHalfWidth * Math.abs(rivalRightX * normalX + rivalRightY * normalY),
      requiredDistance = Math.max(3.1, playerRadius + rivalRadius),
      push = Math.max(0.0, requiredDistance - dist) * 0.5;
    dx = normalX;
    dy = normalY;
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
