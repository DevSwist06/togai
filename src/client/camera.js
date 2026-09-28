export function updateCamera(camera, s, dt) {
  const look = 20 + s[6] * 0.45,
    targetX = s[0] + Math.sin(s[2]) * look,
    targetY = s[1] - Math.cos(s[2]) * look;
  const smooth = 1 - Math.exp(-dt * 3.6);
  camera.x += (targetX - camera.x) * smooth;
  camera.y += (targetY - camera.y) * smooth;
  camera.zoom += (83 + s[6] * 0.48 - camera.zoom) * smooth;
}
