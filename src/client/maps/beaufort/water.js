// Bounded cellular caustics from world position. The moving domain warp makes
// irregular blue cells breathe while their pale borders curl like reflected light.
export const waterFragment = `
fn cellHash(p: vec2f) -> vec2f {
  var h = fract(p * vec2f(0.1031, 0.1030));
  h += dot(h, h.yx + vec2f(33.3));
  return fract(vec2f((h.x + h.y) * h.x, (h.x + h.y) * h.y));
}
@fragment fn fragment(input: Output) -> @location(0) vec4f {
  let time = view.animation.x;
  var p = input.world / 15.0 - vec2f(time * 0.075, -time * 0.011);
  p += vec2f(sin(p.y * 1.8 + time * 0.19), cos(p.x * 1.7 - time * 0.16)) * 0.22;
  let cell = floor(p);
  let local = fract(p);
  var nearest = 4.0;
  var second = 4.0;
  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let offset = vec2f(f32(x), f32(y));
      let site = offset + 0.18 + cellHash(cell + offset) * 0.64;
      let distance = length(site - local);
      if (distance < nearest) { second = nearest; nearest = distance; }
      else { second = min(second, distance); }
    }
  }
  let edge = second - nearest;
  let depth = clamp(0.48 + 0.21 * sin(p.x * 1.7 + p.y * 2.1) + 0.12 * cos(p.y * 1.6 - p.x), 0.0, 1.0);
  var blue = mix(vec3f(0.027, 0.14, 0.32), vec3f(0.025, 0.43, 0.65), depth);
  blue += vec3f(0.04, 0.12, 0.14) * (1.0 - smoothstep(0.0, 0.2, edge));
  blue = mix(blue, vec3f(0.43, 0.78, 0.91), (1.0 - smoothstep(0.008, 0.072, edge)) * 0.8);
  return vec4f(blue, 1.0);
}
`;
