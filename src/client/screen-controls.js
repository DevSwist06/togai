export const DRIFT_DISTANCE = 80;
const idle = { throttle: 1, steer: 0, brake: 0, handbrake: 0 };
const braking = { throttle: 0, steer: 0, brake: 1, handbrake: 0 };

/** The renderer projects world y using the viewport height and camera zoom. */
export function brakeBoundary(car, camera, viewportHeight) {
  if (
    !Number.isFinite(car?.y) ||
    !Number.isFinite(car?.heading) ||
    !Number.isFinite(camera?.y) ||
    !Number.isFinite(camera?.zoom) ||
    !Number.isFinite(viewportHeight) ||
    camera.zoom <= 0 ||
    viewportHeight <= 0
  )
    return null;
  // The body and wheels span at most this much below the car's world center.
  const lowerEdge = 3.3 * Math.abs(Math.cos(car.heading)) + 1.8 * Math.abs(Math.sin(car.heading));
  const projected =
    viewportHeight / 2 + ((car.y - camera.y + lowerEdge) * viewportHeight) / (2 * camera.zoom);
  // Keep braking in the bottom fifth, unless the car sits even lower on screen.
  return Math.max(0, Math.min(viewportHeight - 44, Math.max(projected + 24, viewportHeight * 0.8)));
}

export function startScreenGesture(x, y, width, boundary) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(width) ||
    !Number.isFinite(boundary) ||
    width <= 0
  )
    return null;
  return { command: y >= boundary ? 'brake' : x < width / 2 ? 'left' : 'right', startY: y };
}

export function screenInput(gesture, y) {
  if (!gesture) return idle;
  if (gesture.command === 'brake') return braking;
  if (!['left', 'right'].includes(gesture.command) || !Number.isFinite(y)) return idle;
  const distance = Math.max(0, y - gesture.startY);
  return {
    throttle: Math.max(0, 1 - distance / DRIFT_DISTANCE),
    steer: gesture.command === 'left' ? -1 : 1,
    brake: 0,
    handbrake: Number(distance >= DRIFT_DISTANCE),
  };
}

export function createScreenGestureController() {
  let pointer = null;
  let gesture = null;
  let y = 0;
  let waitingForAll = false;
  const touches = new Set();
  return {
    get pointer() {
      return pointer;
    },
    get input() {
      return screenInput(gesture, y);
    },
    start(id, x, nextY, width, boundary, drivingSurface) {
      touches.add(id);
      if (!drivingSurface || waitingForAll || pointer !== null) return false;
      gesture = startScreenGesture(x, nextY, width, boundary);
      if (!gesture) return false;
      pointer = id;
      y = nextY;
      return true;
    },
    move(id, nextY) {
      if (id === pointer && Number.isFinite(nextY)) y = nextY;
    },
    end(id) {
      touches.delete(id);
      if (id === pointer) {
        pointer = null;
        gesture = null;
        waitingForAll = touches.size > 0;
      }
      if (touches.size === 0) waitingForAll = false;
    },
    clear() {
      touches.clear();
      pointer = null;
      gesture = null;
      waitingForAll = false;
    },
  };
}
