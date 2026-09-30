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

/** Align joystick world direction to car heading so stick direction maps to desired travel direction. */
export function headingAlignedInput(joystick, heading) {
  if (!Number.isFinite(heading))
    return {
      throttle: joystick?.throttle ?? 0,
      steer: joystick?.steer ?? 0,
      brake: joystick?.brake ?? 0,
      handbrake: joystick?.handbrake ?? 0,
    };
  const x = Number.isFinite(joystick?.x) ? joystick.x : 0;
  const y = Number.isFinite(joystick?.y) ? joystick.y : 0;
  const magnitude = Math.min(1, Math.hypot(x, y));
  if (magnitude <= 0.12) return { throttle: 0, steer: 0, brake: 0, handbrake: 0 };
  const desired = Math.atan2(x, -y);
  const delta = Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading));
  const steer = Math.abs(delta) > 0.06 ? clamp(delta * 2.7) : 0;
  const forward = magnitude * Math.cos(delta);
  const brake = Math.max(0, -forward);
  const handbrake = Number(brake > 0.55 && Math.abs(steer) > 0.55);
  return {
    throttle: Math.max(0, forward),
    steer,
    brake: handbrake ? 0 : brake,
    handbrake,
  };
}
