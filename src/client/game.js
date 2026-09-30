import { track, length } from './track.js';
import { Race, STEP as step, readInput, formatTime as fmt } from './race.js';
import { createRenderer, Mesh } from './renderer.js';
import { DrivingEffects } from './effects.js';
import { updateCamera } from './camera.js';
import { followHeading, headingAlignedInput, joystickInput } from './joystick.js';
const $ = (id) => document.getElementById(id);
$('touch-hint').hidden = !window.matchMedia('(pointer: coarse)').matches || window.innerWidth > 600;
const keys = new Set();
const joystick = $('joystick');
const knob = $('joystick-knob');
let joystickPointer = null;
let joystickState = joystickInput(0, 0, 1);
let joystickHeading = 0;
function updateJoystickGuide() {
  joystick.style.setProperty('--joystick-heading', `${joystickHeading}rad`);
}
function clearJoystick() {
  joystickPointer = null;
  joystickState = joystickInput(0, 0, 1);
  knob.style.transform = '';
  joystick.classList.remove('active');
}
function moveJoystick(event) {
  const bounds = joystick.getBoundingClientRect();
  const radius = (bounds.width - knob.offsetWidth) / 2;
  joystickState = joystickInput(
    event.clientX - bounds.left - bounds.width / 2,
    event.clientY - bounds.top - bounds.height / 2,
    radius,
  );
  knob.style.transform = `translate(${joystickState.x * radius}px, ${joystickState.y * radius}px)`;
}
joystick.addEventListener('pointerdown', (event) => {
  if (joystickPointer !== null || !race || !['race', 'countdown'].includes(race.phase)) return;
  event.preventDefault();
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  joystick.classList.add('active');
  moveJoystick(event);
});
joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId !== joystickPointer) return;
  event.preventDefault();
  moveJoystick(event);
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  joystick.addEventListener(name, (event) => {
    if (event.pointerId === joystickPointer) clearJoystick();
  });
}
window.addEventListener('resize', clearJoystick);
document.addEventListener('selectstart', (event) => {
  if (matchMedia('(any-pointer: coarse)').matches) event.preventDefault();
});
let race;
let camera = { x: 66, y: -155, zoom: 130 };
let wasm,
  s,
  renderer,
  accumulator = 0,
  last = 0,
  hudTimer = 0,
  fpsFrames = 0,
  fpsTime = 0;
const effects = new DrivingEffects();
let audio = null,
  soundOn = false;
function initAudio() {
  if (audio) return;
  const context = new AudioContext(),
    gain = context.createGain(),
    osc = context.createOscillator(),
    filter = context.createBiquadFilter();
  osc.type = 'sawtooth';
  filter.type = 'lowpass';
  filter.frequency.value = 280;
  gain.gain.value = 0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  osc.start();
  audio = { context, gain, osc, filter };
}
function setSound(on) {
  soundOn = on;
  if (on) {
    initAudio();
    audio.context.resume();
  }
  $('sound').innerHTML = `SOUND ${on ? 'ON' : 'OFF'} <span>↗</span>`;
}
$('retry').onclick = () => location.reload();
$('sound').onclick = () => setSound(!soundOn);
function soundUpdate() {
  if (!audio) return;
  const active = race?.phase === 'race' && soundOn;
  audio.gain.gain.setTargetAtTime(active ? 0.024 : 0, audio.context.currentTime, 0.1);
  audio.osc.frequency.setTargetAtTime(36 + (s?.[6] || 0) * 2.7, audio.context.currentTime, 0.06);
  audio.filter.frequency.setTargetAtTime(220 + (s?.[6] || 0) * 12, audio.context.currentTime, 0.1);
}
function reset() {
  race.reset();
  joystickHeading = s[2];
  updateJoystickGuide();
  accumulator = 0;
  keys.clear();
  clearJoystick();
  effects.reset();
  camera = { x: s[0], y: s[1] - 30, zoom: 83 };
  document.body.classList.add('playing');
  $('intro').hidden = true;
  $('hud').hidden = false;
  $('results').hidden = true;
  $('pause-panel').hidden = true;
  $('countdown').hidden = false;
  $('countdown').textContent = '3';
  updateHUD();
}
function pause() {
  if (race.phase === 'race' || race.phase === 'countdown') {
    race.pause();
    keys.clear();
    clearJoystick();
    $('pause-panel').hidden = false;
    $('countdown').hidden = true;
  } else if (race.phase === 'paused') {
    race.resume();
    $('pause-panel').hidden = true;
  }
  updateHUD();
  soundUpdate();
}
$('start').onclick = reset;
$('restart').onclick = reset;
$('again').onclick = reset;
$('pause').onclick = pause;
$('resume').onclick = pause;
$('back').onclick = () => {
  race.phase = 'intro';
  keys.clear();
  clearJoystick();
  $('results').hidden = true;
  $('hud').hidden = true;
  $('intro').hidden = false;
  document.body.classList.remove('playing');
  camera = { x: 66, y: -155, zoom: 130 };
  wasm.reset(0, 0, track[0].a);
};
window.addEventListener('keydown', (e) => {
  if (!race || race.phase === 'error') return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') {
    pause();
    return;
  }
  if (e.code === 'KeyR' && race.phase !== 'intro') {
    reset();
    return;
  }
  if (e.code === 'KeyM') {
    setSound(!soundOn);
    return;
  }
  if (e.code === 'Enter' && race.phase === 'intro' && !$('start').disabled) {
    reset();
    return;
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  clearJoystick();
  if (race && (race.phase === 'race' || race.phase === 'countdown')) pause();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearJoystick();
    if (race && (race.phase === 'race' || race.phase === 'countdown')) pause();
  }
});
function finish() {
  race.phase = 'finished';
  keys.clear();
  clearJoystick();
  $('results').hidden = false;
  $('countdown').hidden = true;
  const won = race.won;
  $('result-title').innerHTML = won
    ? 'OVERTAKE<br><em>CONFIRMED.</em>'
    : race.crashReason
      ? 'CRASHED<br><em>OUT.</em>'
      : 'RIVAL<br><em>ESCAPED.</em>';
  $('result-copy').textContent = won
    ? 'You held a clean pass for five seconds. The pass is yours.'
    : race.crashReason === 'rival'
      ? 'You hit the rival. The run is over.'
      : race.crashReason === 'roadside'
        ? 'You hit the roadside. The run is over.'
        : 'Your rival reached the finish before you confirmed the pass. Brake early, then carry speed out.';
  $('final-time').textContent = won
    ? fmt(race.overtakeTime)
    : race.crashReason
      ? 'CRASHED'
      : 'ESCAPED';
  $('final-drift').textContent = `${race.driftTime.toFixed(1)}s`;
  soundUpdate();
}
function simulate() {
  const before = race.phase;
  joystickHeading = followHeading(joystickHeading, s?.[2], step);
  updateJoystickGuide();
  race.tick(readInput(keys, headingAlignedInput(joystickState, joystickHeading)));
  $('countdown').hidden = !['countdown', 'race'].includes(race.phase) || race.elapsed > 0.6;
  $('countdown').textContent =
    race.phase === 'countdown' ? Math.min(3, Math.ceil(race.count)) : 'GO';
  if (before !== 'finished' && race.phase === 'finished') {
    if (race.crashReason) effects.explode(s[0], s[1]);
    finish();
  }
}
function updateHUD() {
  $('timer').textContent = fmt(race.elapsed);
  $('speed').textContent = Math.round(s[6] * 3.6);
  $('rev').style.width = `${Math.min(100, (s[6] / 44) * 100)}%`;
  const first = s[8] >= s[18];
  $('position').innerHTML = `${first ? 1 : 2}<span>/ 2</span>`;
  const gap = Math.abs(s[8] - s[18]);
  $('gap').textContent =
    race.rivalFinish !== null
      ? 'RIVAL ESCAPED'
      : race.overtakeDuration > 0
        ? `PASS CLEAR · ${(5 - race.overtakeDuration).toFixed(1)} S`
        : gap < 3
          ? 'SIDE BY SIDE'
          : `${first ? 'OVERTAKING' : 'CHASING'} ${gap.toFixed(0)} M`;
  const passProgress = Math.min(5, race.overtakeDuration);
  const passConfirmation = $('pass-confirmation');
  passConfirmation.hidden = passProgress <= 0;
  $('pass-progress').value = passProgress;
  $('pass-time').textContent = `${(5 - passProgress).toFixed(1)} S`;
  $('percent').textContent = `${Math.min(100, Math.floor((s[8] / (length - 14)) * 100))}%`;
  $('progress').style.width = `${Math.min(100, (s[8] / (length - 14)) * 100)}%`;
  drawMap($('minimap'), true);
}
function drawMap(canvas, live = false) {
  const ctx = canvas.getContext('2d'),
    w = canvas.width,
    h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const scale = (h - 28) / -track.at(-1).y;
  const project = (p) => [w / 2 + (p.x - 60) * scale, 13 + -p.y * scale];
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  track.forEach((p, i) => {
    const [x, y] = project(p);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.strokeStyle = '#899b7e';
  ctx.lineWidth = live ? 2 : 3;
  ctx.stroke();
  for (const [p, label] of [
    [track[0], 'START'],
    [track.at(-1), 'FINISH'],
  ]) {
    const [x, y] = project(p);
    ctx.fillStyle = '#e8e7df';
    ctx.fillRect(x - 2, y - 2, 4, 4);
    if (!live) {
      ctx.fillStyle = '#83917f';
      ctx.font = '8px monospace';
      ctx.fillText(label, x + 10, y + 3);
    }
  }
  if (live) {
    for (let c = 1; c >= 0; c--) {
      const [x, y] = project({ x: s[c * 10], y: s[c * 10 + 1] });
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = c ? '#d3e7e3' : '#f88456';
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#f88456';
    ctx.font = '9px monospace';
    ctx.fillText('N', 20, 30);
    ctx.fillRect(23, 40, 1, 24);
    ctx.beginPath();
    ctx.moveTo(20, 44);
    ctx.lineTo(23.5, 39);
    ctx.lineTo(27, 44);
    ctx.strokeStyle = '#f88456';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
const dynamic = new Mesh();
function frame(now) {
  if (race.phase === 'error') return;
  const realDt = (now - last) / 1000 || 0;
  const dt = Math.min(realDt, 0.05);
  last = now;
  if (race.phase === 'race' || race.phase === 'countdown') {
    accumulator += dt;
    while (accumulator >= step) {
      simulate();
      accumulator -= step;
    }
  } else accumulator = 0;
  if (race.phase !== 'intro') updateCamera(camera, s, dt);
  dynamic.data.length = 0;
  effects.draw(race.phase === 'paused' ? 0 : dt, race.phase, s, dynamic);
  renderer.draw(camera, dynamic);
  hudTimer += dt;
  if (hudTimer > 0.075) {
    hudTimer = 0;
    if (race.phase !== 'intro') updateHUD();
    soundUpdate();
  }
  fpsFrames++;
  fpsTime += realDt;
  if (fpsTime >= 0.75) {
    $('performance').textContent = `${Math.round(fpsFrames / fpsTime)} FPS  /  WEBGPU + WASM`;
    fpsFrames = 0;
    fpsTime = 0;
  }
  requestAnimationFrame(frame);
}
function showError(error) {
  console.error(error);
  if (race) race.phase = 'error';
  soundUpdate();
  $('error').hidden = false;
  $('error-message').textContent = error.message || String(error);
}
async function init() {
  try {
    const response = await fetch(new URL('./physics.wasm', import.meta.url));
    if (!response.ok)
      throw new Error('Physics module is missing. Run npm run build, then refresh.');
    const result = await WebAssembly.instantiateStreaming(response, {
      env: {
        abort: () => {
          throw new Error('WebAssembly physics aborted');
        },
      },
    });
    wasm = result.instance.exports;
    s = new Float64Array(wasm.memory.buffer, wasm.statePointer(), 20);
    race = new Race(wasm, s);
    track.forEach((p, i) => wasm.setPoint(i, p.x, p.y, p.d));
    wasm.reset(0, 0, track[0].a);
    joystickHeading = s[2];
    updateJoystickGuide();
    renderer = await createRenderer($('game'));
    renderer.device.lost.then((info) =>
      showError(new Error(`The graphics device was lost (${info.reason}). Reload to reconnect.`)),
    );
    renderer.device.addEventListener('uncapturederror', (e) => showError(e.error));
    $('course-length').textContent = (length / 1000).toFixed(1);
    drawMap($('preview-map'));
    $('start').disabled = false;
    $('start').firstChild.textContent = 'START DESCENT ';
    requestAnimationFrame(frame);
  } catch (error) {
    showError(error);
  }
}
init();
