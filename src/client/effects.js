import { drawCar, color } from './renderer.js';
import { CAR_SKINS } from './car-skins.js';
import { surfaces } from './track.js';

const MAX_SMOKE = 150;
const MAX_MARKS = 800;
const MAX_SNOW = 220;
const SNOW_KIND = 1;
const SNOW_EMIT_STEP = 1 / 45;
const SNOW_MIN_SPEED = 3.5;

export class DrivingEffects {
  smoke = [];
  marks = [];
  sparks = [];
  snow = [];
  emission = 0;
  snowEmission = 0;
  randomState = 42;
  constructor({ getSurfaces = () => surfaces } = {}) {
    this.getSurfaces = getSurfaces;
  }
  random() {
    this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) | 0;
    return (this.randomState >>> 0) / 4294967296;
  }
  onSnow(x, y) {
    for (const patch of this.getSurfaces() ?? []) {
      if (patch.type !== SNOW_KIND) continue;
      const dx = x - patch.x,
        dy = y - patch.y;
      const c = Math.cos(patch.a),
        s = Math.sin(patch.a);
      const localX = dx * c + dy * s;
      const localY = -dx * s + dy * c;
      if ((localX / patch.width) ** 2 + (localY / patch.length) ** 2 < 1) return true;
    }
    return false;
  }
  emitSnow(dt, phase, s) {
    if (phase !== 'race') return;
    this.snowEmission += dt;
    if (this.snowEmission < SNOW_EMIT_STEP) return;
    this.snowEmission = 0;
    const snow = this.snow;
    for (let c = 0; c < 2; c++) {
      const k = c * 10;
      const speed = s[k + 6];
      if (speed < SNOW_MIN_SPEED || !this.onSnow(s[k], s[k + 1])) continue;
      const intensity = Math.min(1, (speed - SNOW_MIN_SPEED) / 26);
      const heading = s[k + 2];
      const forwardX = Math.sin(heading),
        forwardY = -Math.cos(heading);
      const rightX = Math.cos(heading),
        rightY = Math.sin(heading);
      const burst = 1 + Math.round(intensity * 3);
      for (const side of [-1, 1]) {
        const wheelX = s[k] + rightX * side * 0.95 - forwardX * 1.45;
        const wheelY = s[k + 1] + rightY * side * 0.95 - forwardY * 1.45;
        for (let i = 0; i < burst; i++) {
          if (snow.length >= MAX_SNOW) break;
          const spread = (this.random() - 0.5) * (0.55 + intensity * 0.6);
          const driftBack = -(0.9 + this.random() * 0.95) * speed * (0.11 + intensity * 0.05);
          const spraySide = side * (0.32 + this.random() * 0.95) * speed * 0.07;
          const life = 0.26 + this.random() * 0.24 + intensity * 0.2;
          snow.push({
            x: wheelX + rightX * spread,
            y: wheelY + rightY * spread,
            vx: forwardX * driftBack + rightX * spraySide,
            vy: forwardY * driftBack + rightY * spraySide,
            r: 0.22 + this.random() * 0.34 + intensity * 0.2,
            life,
            maxLife: life,
            lift: 0.5 + this.random() * 0.8,
            grow: 0.5 + this.random() * 0.85,
            opacity: 0.12 + this.random() * 0.14 + intensity * 0.14,
          });
        }
      }
    }
  }
  drawSnow(dt, dynamic) {
    const snow = this.snow;
    for (let i = snow.length - 1; i >= 0; i--) {
      const p = snow[i];
      p.life -= dt;
      if (p.life <= 0) {
        snow.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt - p.lift * dt * 0.18;
      p.vx *= Math.exp(-dt * 3.5);
      p.vy *= Math.exp(-dt * 3.1);
      p.r += dt * p.grow;
      const fade = (p.life / p.maxLife) ** 1.35;
      const alpha = p.opacity * fade;
      const shade = 0.87 + fade * 0.08;
      dynamic.disc(p.x, p.y, p.r, [shade, Math.min(1, shade + 0.04), Math.min(1, shade + 0.07), alpha], 7);
    }
  }
  reset() {
    this.smoke.length = 0;
    this.marks.length = 0;
    this.sparks.length = 0;
    this.snow.length = 0;
    this.emission = 0;
    this.snowEmission = 0;
  }
  explode(x, y) {
    if (this.sparks.length) return;
    for (let i = 0; i < 36; i++) {
      const a = (i * Math.PI * 2) / 36,
        speed = 11 + (i % 5) * 1.7;
      this.sparks.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: 0.4 + (i % 3) * 0.13,
        life: 0.65 + (i % 4) * 0.06,
      });
    }
  }
  draw(dt, phase, s, dynamic, playerSkin = CAR_SKINS[0]) {
    const smoke = this.smoke,
      marks = this.marks,
      sparks = this.sparks;

    this.emission += dt;
    if (this.emission > 1 / 30 && phase === 'race') {
      this.emission = 0;
      for (let c = 0; c < 2; c++) {
        const k = c * 10;
        if (s[k + 6] < 7 || Math.abs(s[k + 7]) < 0.065) continue;
        for (const side of [-1, 1]) {
          const a = s[k + 2],
            x = s[k] + Math.cos(a) * side * 0.85 - Math.sin(a) * 1.5,
            y = s[k + 1] + Math.sin(a) * side * 0.85 + Math.cos(a) * 1.5;
          marks.push({ x, y, a, life: 7 });
          if (smoke.length < MAX_SMOKE) smoke.push({ x, y, r: 0.5, life: 0.7 });
        }
      }
    }
    for (let i = marks.length - 1; i >= 0; i--) {
      const p = marks[i];
      p.life -= dt;
      if (p.life <= 0) {
        marks.splice(i, 1);
        continue;
      }
      dynamic.rect(p.x, p.y, 0.25, 1, p.a, [0.17, 0.21, 0.18]);
    }
    if (marks.length > MAX_MARKS) marks.splice(0, marks.length - MAX_MARKS);
    this.emitSnow(dt, phase, s);
    this.drawSnow(dt, dynamic);
    drawCar(dynamic, s[10], s[11], s[12], color('b9d2cd'), s[15]);
    playerSkin.draw(dynamic, s[0], s[1], s[2], s[5]);
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.life -= dt;
      if (p.life <= 0) {
        smoke.splice(i, 1);
        continue;
      }
      p.r += dt * 2;
      p.x += dt * 0.6;
      const fade = p.life / 0.7;
      // Smoke stays above the cars, but its low alpha preserves a clear view through a drift.
      dynamic.disc(
        p.x,
        p.y,
        p.r,
        [0.255 + fade * 0.12, 0.286 + fade * 0.11, 0.27 + fade * 0.1, fade * 0.16],
        6,
      );
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life -= dt;
      if (p.life <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 3);
      p.vy *= Math.exp(-dt * 3);
      const fade = p.life / 0.83;
      dynamic.disc(p.x, p.y, p.r * fade, p.r > 0.58 ? [1, 0.68, 0.2] : [0.95, 0.22, 0.08], 6);
    }
  }
}
