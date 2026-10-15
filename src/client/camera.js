// Keep follow history local to each view; replacing the camera on retry clears it.
const tracking = new WeakMap();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Exact critically damped spring: no overshoot or frame-dependent lerp factors.
function damp(axis, target, frequency, dt) {
  const offset = axis.value - target;
  const impulse = (axis.velocity + frequency * offset) * dt;
  const decay = Math.exp(-frequency * dt);
  axis.value = target + (offset + impulse) * decay;
  axis.velocity = (axis.velocity - frequency * impulse) * decay;
}

export function updateCamera(camera, s, dt, sampleTrack, aspect = 1, zoomScale = 1) {
  if (
    !Number.isFinite(dt) ||
    dt <= 0 ||
    !Number.isFinite(aspect) ||
    aspect <= 0 ||
    !Number.isFinite(zoomScale) ||
    zoomScale <= 0 ||
    !Number.isFinite(camera.x) ||
    !Number.isFinite(camera.y) ||
    !Number.isFinite(camera.zoom) ||
    camera.zoom <= 0
  )
    return;
  for (let i = 0; i < 7; i++) if (!Number.isFinite(s[i])) return;
  // A stalled render must not turn into a camera leap on the next frame.
  dt = Math.min(dt, 0.05);
  const speed = clamp(s[6], 0, 90);
  let follow = tracking.get(camera);
  if (!follow) {
    follow = {
      x: s[0],
      y: s[1],
      speed,
      previousSpeed: speed,
      acceleration: 0,
      lookX: { value: camera.x - s[0], velocity: 0 },
      lookY: { value: camera.y - s[1], velocity: 0 },
      zoom: { value: camera.zoom, velocity: 0 },
    };
    tracking.set(camera, follow);
  }
  follow.speed += (speed - follow.speed) * (1 - Math.exp(-4 * dt));
  const acceleration = clamp((speed - follow.previousSpeed) / dt, -14, 10);
  follow.acceleration += (acceleration - follow.acceleration) * (1 - Math.exp(-3 * dt));
  follow.previousSpeed = speed;

  const targetZoom = (62 + follow.speed * 0.17 + follow.acceleration * 0.08) * zoomScale;
  const look = 12 + follow.speed * 0.38;
  const heading = s[2] + clamp(s[5], -1, 1) * Math.min(follow.speed / 30, 1) * 0.12;
  let directionX = Math.sin(heading),
    directionY = -Math.cos(heading);
  if (speed > 1) {
    const velocityLength = Math.hypot(s[3], s[4]);
    if (velocityLength > 1) {
      directionX = directionX * 0.8 + (s[3] / velocityLength) * 0.2;
      directionY = directionY * 0.8 + (s[4] / velocityLength) * 0.2;
    }
  }
  if (sampleTrack && Number.isFinite(s[8])) {
    const road = sampleTrack(s[8]);
    const ahead = sampleTrack(s[8] + 24 + follow.speed * 0.7);
    const dx = ahead.x - road.x,
      dy = ahead.y - road.y,
      distance = Math.hypot(dx, dy);
    if (Number.isFinite(distance) && distance > 0.01) {
      const anticipation = Math.min(follow.speed / 35, 1) * 0.55;
      directionX = directionX * (1 - anticipation) + (dx / distance) * anticipation;
      directionY = directionY * (1 - anticipation) + (dy / distance) * anticipation;
    }
  }
  const directionLength = Math.hypot(directionX, directionY) || 1;
  const lookX = (directionX / directionLength) * look,
    lookY = (directionY / directionLength) * look;
  // Reserve room around the car on narrow screens, including sideways hairpins.
  const framing = Math.max(
    1,
    Math.abs(lookX) / (targetZoom * aspect * 0.42),
    Math.abs(lookY) / (targetZoom * 0.48),
  );
  damp(follow.lookX, lookX / framing, 7, dt);
  damp(follow.lookY, lookY / framing, 7, dt);
  damp(follow.zoom, targetZoom, 4.5, dt);

  // Velocity feed-forward avoids trailing behind at speed; damp only corrections
  // from fixed physics ticks, impacts and surface transitions. No shake is added.
  const correction = 1 - Math.exp(-18 * dt);
  follow.x += s[3] * dt;
  follow.y += s[4] * dt;
  follow.x += (s[0] - follow.x) * correction;
  follow.y += (s[1] - follow.y) * correction;
  camera.x = follow.x + follow.lookX.value;
  camera.y = follow.y + follow.lookY.value;
  camera.zoom = follow.zoom.value;
}
