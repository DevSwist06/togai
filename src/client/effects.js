import { drawCar, color } from './renderer.js';
import { CAR_SKINS } from './car-skins.js';

export class DrivingEffects {
  smoke = [];
  marks = [];
  sparks = [];
  emission = 0;
  reset() {
    this.smoke.length = 0;
    this.marks.length = 0;
    this.sparks.length = 0;
    this.emission = 0;
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
          if (smoke.length < 150) smoke.push({ x, y, r: 0.5, life: 0.7 });
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
    if (marks.length > 800) marks.splice(0, marks.length - 800);
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
