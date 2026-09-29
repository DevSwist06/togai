const clamp = (value) => Math.max(-1, Math.min(1, value));

/** Map a circular stick position to the four inputs used by the race. */
export function joystickInput(dx, dy, radius) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0)
    return { x: 0, y: 0, throttle: 0, steer: 0, brake: 0, handbrake: 0 };
  const distance = Math.hypot(dx, dy);
  const scale = distance > radius ? radius / distance : 1;
  const x = clamp((dx * scale) / radius);
  const y = clamp((dy * scale) / radius);
  const steer = Math.abs(x) > 0.12 ? x : 0;
  const vertical = Math.abs(y) > 0.12 ? y : 0;
  const handbrake = Number(vertical > 0.55 && Math.abs(steer) > 0.55);
  return {
    x,
    y,
    throttle: Math.max(0, -vertical),
    steer,
    brake: handbrake ? 0 : Math.max(0, vertical),
    handbrake,
  };
}
