import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

/* ===== Helpers ===== */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp01 = v => Math.min(1, Math.max(0, v));
const escapeHTML = v => String(v).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lowPower = matchMedia('(pointer: coarse)').matches || innerWidth < 700;   /* phones and tablets */

const body = document.body;
const el = {
  glow: $('#glow'), progress: $('#progress'), cursor: $('#cursor'),
  pin: $('#services'), sticky: $('.pin-sticky'), track: $('#track'),
  stage: $('#stage'), canvas: $('#hero3d'),
};

/* ===== Theme, menu, language ===== */
const TRANSLATIONS = {
  en: { hero: 'From wireframe to live site, Nexo Studio designs and builds fast websites and web systems for UMKM and growing businesses.', cta1: 'Start a project', cta2: 'See our work' },
  id: { hero: 'Dari wireframe sampai website live, Nexo Studio mendesain dan membangun website dan sistem web yang cepat untuk UMKM dan bisnis yang sedang tumbuh.', cta1: 'Mulai proyek', cta2: 'Lihat karya kami' },
};
let lang = 'en';

function setMenu(open) {
  $('#menu').classList.toggle('open', open);
  $('#menuBtn').textContent = open ? 'Close' : 'Menu';
  document.documentElement.style.overflow = open ? 'hidden' : '';   /* lock page scroll behind the menu */
}

$('#menuBtn').onclick = () => setMenu(!$('#menu').classList.contains('open'));
$$('.menu a').forEach(a => a.onclick = () => setMenu(false));

$('#lang').onclick = () => {
  lang = lang === 'en' ? 'id' : 'en';
  $('#lang').textContent = lang.toUpperCase();
  $$('[data-i]').forEach(node => node.textContent = TRANSLATIONS[lang][node.dataset.i]);
};

/* ===== Cursor, ambient glow, card spotlight ===== */
const pointer = { x: innerWidth / 2, y: innerHeight / 2 };
const glow = { x: 70, y: 30 };

addEventListener('pointermove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  el.cursor.style.left = `${pointer.x}px`;
  el.cursor.style.top = `${pointer.y}px`;
}, { passive: true });

$$('a, button, .service, .work').forEach(node => {
  node.addEventListener('mouseenter', () => el.cursor.classList.add('hovercursor'));
  node.addEventListener('mouseleave', () => el.cursor.classList.remove('hovercursor'));
});

/* Services cards: spotlight + pointer parallax for the illustrations */
$$('.service').forEach(card => {
  card.addEventListener('pointermove', e => {
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
    card.style.setProperty('--px', ((x / r.width - .5) * 2).toFixed(3));
    card.style.setProperty('--py', ((y / r.height - .5) * 2).toFixed(3));
  });
  card.addEventListener('pointerleave', () => {
    card.style.setProperty('--px', 0);
    card.style.setProperty('--py', 0);
  });
});

/* Only animate the illustrations of cards that are on screen */
const artObserver = new IntersectionObserver(
  entries => entries.forEach(e => e.target.classList.toggle('in-view', e.isIntersecting)),
  { rootMargin: '0px 100px' }
);
$$('.service').forEach(card => artObserver.observe(card));

/* ===== Reveal on scroll ===== */
const revealObserver = new IntersectionObserver(
  entries => entries.forEach(e => e.isIntersecting && e.target.classList.add('show')),
  { threshold: .12 }
);
$$('.rv').forEach(node => revealObserver.observe(node));

/* ===== Services: vertical scroll drives horizontal movement ===== */
let servicesDistance = 0, servicesX = 0, servicesWritten = NaN;
let pinTop = 0, lastWidth = innerWidth;

/* Layout is measured once (not every frame) to keep scrolling smooth. */
function measureServices() {
  const lastCard = el.track.lastElementChild;
  const sidePadding = parseFloat(getComputedStyle(el.track).paddingRight);
  const viewport = el.sticky.offsetHeight;   /* stable height (100svh), unaffected by the mobile URL bar */
  servicesDistance = Math.max(1, lastCard.offsetLeft + lastCard.offsetWidth + sidePadding - innerWidth);
  el.pin.style.height = `${servicesDistance + viewport}px`;
  pinTop = el.pin.offsetTop;
}

addEventListener('resize', () => {
  /* On phones the URL bar changes the height while scrolling; only re-measure when the width changes. */
  if (!lowPower || innerWidth !== lastWidth) { lastWidth = innerWidth; measureServices(); }
});
addEventListener('load', measureServices);
document.fonts?.ready.then(measureServices);
const aboveServices = new ResizeObserver(measureServices);
[$('.hero'), $('#work')].forEach(node => aboveServices.observe(node));
measureServices();

function updateServices(dt) {
  const progress = clamp01((scrollY - pinTop) / servicesDistance);
  const target = -progress * servicesDistance;
  servicesX = damp(servicesX, target, reduceMotion ? 60 : lowPower ? 16 : 8, dt);
  if (Math.abs(target - servicesX) < .05) servicesX = target;
  if (servicesX !== servicesWritten) {
    servicesWritten = servicesX;
    el.track.style.transform = `translate3d(${servicesX.toFixed(2)}px,0,0)`;
  }
}

/* ===== Project builder form: browser-local persistence ===== */
const PROJECTS_KEY = 'nexo-project-inquiries-v1';
const savedProjectsNode = $('#savedProjects');
const saveStatus = $('#saveStatus');

function readProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function renderProjects() {
  const projects = readProjects();
  if (!projects.length) {
    savedProjectsNode.innerHTML = '<span class="label">No project requests saved in this browser yet.</span>';
    return;
  }
  savedProjectsNode.innerHTML = `<span class="label">Saved in this browser</span><h3>${projects.length} project ${projects.length === 1 ? 'request' : 'requests'}</h3>` +
    projects.map(project => `<article class="saved-project"><div><strong>${escapeHTML(project.name)}</strong> · ${escapeHTML(project.type)}<p>Budget: ${escapeHTML(project.budget)} · Timeline: ${escapeHTML(project.timeline)}</p><p>${escapeHTML(project.details)}</p><small>${escapeHTML(new Date(project.createdAt).toLocaleString())}</small></div><button class="pill" type="button" data-delete-project="${escapeHTML(project.id)}" aria-label="Delete ${escapeHTML(project.name)} project">Delete</button></article>`).join('');
}

savedProjectsNode.addEventListener('click', event => {
  const button = event.target.closest('[data-delete-project]');
  if (!button) return;
  const next = readProjects().filter(project => project.id !== button.dataset.deleteProject);
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(next));
    saveStatus.textContent = 'Project request deleted from this browser.';
    renderProjects();
  } catch {
    saveStatus.textContent = 'Could not update browser storage.';
  }
});

$('#builder').onsubmit = e => {
  e.preventDefault();
  const project = {
    id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: $('#name').value.trim(),
    type: $('#type').value,
    budget: $('#budget').value,
    timeline: $('#timeline').value,
    details: $('#details').value.trim() || 'No additional details yet.',
    createdAt: new Date().toISOString(),
  };

  try {
    const projects = readProjects();
    projects.unshift(project);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    saveStatus.textContent = 'Project request saved in this browser.';
    renderProjects();
  } catch {
    saveStatus.textContent = 'Browser storage is unavailable. You can still send the request by email.';
  }

  const summary = $('#summary');
  summary.style.display = 'block';
  summary.innerHTML = `
    <span class="label">Project summary</span>
    <h3>${escapeHTML(project.type)}</h3>
    <p>Hi ${escapeHTML(project.name)}, your project is <b>${escapeHTML(project.type)}</b> with a budget of <b>${escapeHTML(project.budget)}</b> and a timeline of <b>${escapeHTML(project.timeline)}</b>.</p>
    <p>${escapeHTML(project.details)}</p>
    <button class="btn main submit" type="button" id="send">Send by email</button>`;

  $('#send').onclick = () => {
    const subject = encodeURIComponent('New Nexo Studio project inquiry');
    const text = encodeURIComponent(`Hi Nexo Studio, I'm ${project.name}. I want to discuss a ${project.type} project. Budget: ${project.budget}. Timeline: ${project.timeline}. Details: ${project.details}`);
    open(`mailto:a.tanata@yahoo.com?subject=${subject}&body=${text}`, '_blank');
  };
  summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

renderProjects();

/* ===== Hero 3D: a website stack (wireframe → design → code → live) ===== */
const TAU = Math.PI * 2;
const COLOR = { blue: '#4d6bff', coral: '#ff5b6e', mint: '#5cf2c2', amber: '#ffb45b' };
const TEX_W = 512, TEX_H = 340;

function roundRect(g, x, y, w, h, r, { fill, stroke, dash = [] } = {}) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  if (fill)   { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.setLineDash(dash); g.stroke(); }
}

function heroGradient(g, x1, y1, x2, y2) {
  const gradient = g.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, COLOR.blue);
  gradient.addColorStop(1, COLOR.coral);
  return gradient;
}

function drawBrowserBar(g) {
  g.fillStyle = '#ffffff14';
  g.fillRect(0, 0, TEX_W, 34);
  [COLOR.coral, COLOR.amber, COLOR.mint].forEach((c, i) => {
    g.fillStyle = c;
    g.beginPath();
    g.arc(20 + i * 18, 17, 5, 0, TAU);
    g.fill();
  });
}

const LAYERS = [
  { background: 'rgba(11,13,26,.35)', draw(g) {           /* wireframe */
    const line = '#8d91ff', dash = [8, 6];
    [[30, 56, 452, 70], [30, 142, 210, 140], [256, 142, 226, 60], [256, 218, 226, 64]]
      .forEach(([x, y, w, h]) => roundRect(g, x, y, w, h, 8, { stroke: line, dash }));
    g.strokeStyle = line;
    g.beginPath();
    g.moveTo(30, 56);  g.lineTo(482, 126);
    g.moveTo(482, 56); g.lineTo(30, 126);
    g.stroke();
  } },
  { background: 'rgba(11,13,26,.94)', draw(g) {           /* design */
    roundRect(g, 30, 56, 452, 90, 14, { fill: heroGradient(g, 0, 0, TEX_W, 0) });
    roundRect(g, 50, 76, 190, 12, 6, { fill: '#fff' });
    roundRect(g, 50, 98, 120, 10, 5, { fill: '#ffffffaa' });
    roundRect(g, 50, 118, 80, 18, 9, { fill: '#fff' });
    for (let i = 0; i < 3; i++) roundRect(g, 30 + i * 154, 166, 144, 112, 12, { fill: '#ffffff12', stroke: '#ffffff30' });
    roundRect(g, 44, 180, 60, 60, 10, { fill: COLOR.blue });
  } },
  { background: 'rgba(11,13,26,.94)', draw(g) {           /* code */
    const colors = [COLOR.mint, COLOR.blue, COLOR.coral, COLOR.amber, '#ffffff88'];
    let y = 52;
    for (let i = 0; i < 11; i++) {
      let x = 30 + (i % 4 === 2 ? 30 : i % 4 === 1 ? 15 : 0);
      for (let j = 0; j < 3 + i % 3; j++) {
        const w = 30 + ((i * 37 + j * 53) % 80);
        roundRect(g, x, y, w, 9, 4, { fill: colors[(i + j) % 5] });
        x += w + 10;
      }
      y += 26;
    }
  } },
  { background: 'rgba(11,13,26,.94)', draw(g) {           /* live */
    roundRect(g, 0, 34, TEX_W, TEX_H - 34, 0, { fill: '#0b0d1a' });
    roundRect(g, 30, 56, 452, 100, 16, { fill: heroGradient(g, 0, 0, TEX_W, TEX_H) });
    roundRect(g, 50, 80, 200, 16, 8, { fill: '#fff' });
    roundRect(g, 50, 106, 140, 10, 5, { fill: '#ffffffcc' });
    roundRect(g, 50, 128, 96, 20, 10, { fill: '#fff' });
    [30, 184, 338].forEach(x => roundRect(g, x, 176, 144, 100, 12, { fill: '#ffffff14' }));
    g.fillStyle = COLOR.mint;
    g.beginPath(); g.arc(430, 17, 6, 0, TAU); g.fill();
    g.font = '600 14px sans-serif';
    g.fillText('live', 442, 22);
  } },
];
const EDGE_COLORS = [0x8d91ff, 0xff5b6e, 0x5cf2c2, 0x4d6bff];

function makeLayerTexture({ background, draw }) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const g = canvas.getContext('2d');
  g.fillStyle = background;
  g.fillRect(0, 0, TEX_W, TEX_H);
  drawBrowserBar(g);
  draw(g);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function createHero(canvas, stage) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.5 : 1.75));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, .1, 50);
  const root = new THREE.Group();
  const stack = new THREE.Group();
  root.add(stack);
  scene.add(root);
  stack.rotation.set(.22, -.62, 0);

  /* layers */
  const plateGeometry = new THREE.PlaneGeometry(3.3, 2.18);
  const plates = LAYERS.map((layer, i) => {
    const plate = new THREE.Mesh(plateGeometry, new THREE.MeshBasicMaterial({ map: makeLayerTexture(layer), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    plate.add(new THREE.LineSegments(new THREE.EdgesGeometry(plateGeometry), new THREE.LineBasicMaterial({ color: EDGE_COLORS[i], transparent: true, opacity: .9 })));
    plate.renderOrder = i;
    stack.add(plate);
    return plate;
  });

  /* orbiting UI chips */
  const chipGeometry = new THREE.BoxGeometry(.2, .2, .2);
  const chipColors = [0x4d6bff, 0xff5b6e, 0x5cf2c2];
  const CHIP_COUNT = lowPower ? 8 : 14;
  const chips = Array.from({ length: CHIP_COUNT }, (_, i) => {
    const chip = new THREE.Mesh(chipGeometry, new THREE.MeshBasicMaterial({ color: chipColors[i % 3], wireframe: i % 2 === 0 }));
    chip.userData = { angle: i / CHIP_COUNT * TAU, radius: 2.5 + (i % 4) * .35, speed: .15 + (i % 5) * .05, y: ((i * 29) % 10 - 5) * .28 };
    root.add(chip);
    return chip;
  });

  /* dust */
  const DUST_COUNT = lowPower ? 220 : 420;
  const positions = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    const r = 3.4 + Math.random() * 3, theta = Math.random() * TAU, phi = Math.acos(Math.random() * 2 - 1);
    positions.set([r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)], i * 3);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMaterial = new THREE.PointsMaterial({ color: 0xb8c3ff, size: .022, transparent: true, opacity: .6 });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  root.add(dust);

  /* sizing */
  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.set(0, 0, camera.aspect < .9 ? 13 : 10);
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* interaction */
  const tilt = { x: 0, y: 0, hover: false };
  let visible = true;
  const view = { rx: 0, ry: 0, explode: 0 };

  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    tilt.x = ((e.clientX - r.left) / r.width - .5) * 2;
    tilt.y = ((e.clientY - r.top) / r.height - .5) * 2;
    tilt.hover = true;
  });
  stage.addEventListener('pointerleave', () => { tilt.hover = false; tilt.x = tilt.y = 0; });
  new IntersectionObserver(([entry]) => visible = entry.isIntersecting).observe(stage);

  return {
    setLight(isLight) { dustMaterial.color.set(isLight ? 0x5d6179 : 0xb8c3ff); },

    update(time, dt, smoothScroll) {
      if (!visible) return;

      const explodeTarget = tilt.hover ? 1 : Math.min(1, scrollY / innerHeight * 1.4) * .8 + .15;
      view.explode = damp(view.explode, reduceMotion ? .5 : explodeTarget, 3.2, dt);
      const gap = .34 + view.explode * .9;

      plates.forEach((plate, i) => {
        const offset = i - 1.5;
        plate.position.z = damp(plate.position.z, offset * gap, 10, dt);
        plate.position.y = damp(plate.position.y, offset * .12 * view.explode + Math.sin(time * .9 + i * 1.1) * .045, 8, dt);
      });

      view.ry = damp(view.ry, -.62 + tilt.x * .45 + Math.sin(time * .35) * .08 + smoothScroll * 2.2, 3.4, dt);
      view.rx = damp(view.rx, .22 + tilt.y * .3, 3.4, dt);
      stack.rotation.set(view.rx, view.ry, 0);
      root.position.y = Math.sin(time * .6) * .08;

      chips.forEach((chip, i) => {
        const { angle, radius, speed, y } = chip.userData;
        const a = angle + time * speed;
        chip.position.set(Math.cos(a) * radius, y + Math.sin(time + i) * .1, Math.sin(a) * radius);
        chip.rotation.x += dt * .6;
        chip.rotation.y += dt * .8;
      });
      dust.rotation.y = time * .02;

      renderer.render(scene, camera);
    },
  };
}

const hero = createHero(el.canvas, el.stage);

/* ===== Sound: everything is synthesised with the Web Audio API (no audio files) ===== */
function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const listeners = new Set();
  let ctx = null, master = null, engine = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('nexo-muted') === '1'; } catch { /* storage unavailable */ }

  const noiseSource = () => { const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; return src; };

  function build() {
    ctx = new AudioCtx();
    const compressor = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : .9;
    master.connect(compressor);
    compressor.connect(ctx.destination);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    /* engine: three detuned oscillators through a low-pass filter, with an idle "chug" */
    const out = ctx.createGain();
    out.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.Q.value = 3; filter.frequency.value = 400;
    const mix = (type, level) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; g.gain.value = level; o.connect(g); g.connect(filter); o.start(); return o; };
    const o1 = mix('sawtooth', .5), o2 = mix('square', .22), o3 = mix('sawtooth', .3);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = 9; lfoGain.gain.value = .02;
    lfo.connect(lfoGain); lfoGain.connect(out.gain); lfo.start();
    filter.connect(out); out.connect(master);

    /* tyre screech, grass rustle and wind are filtered noise */
    const noiseLayer = (type, freq, q) => {
      const src = noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(master); src.start();
      return g;
    };
    engine = { o1, o2, o3, filter, out, rpm: .2,
      screech: noiseLayer('bandpass', 1700, 2.2), grass: noiseLayer('lowpass', 650, .7), wind: noiseLayer('lowpass', 420, .7) };
  }

  function tone(freq, { type = 'sine', dur = .3, vol = .2, slideTo = 0, delay = 0 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + .05);
  }
  function burst({ dur = .2, freq = 900, vol = .3 } = {}) {
    if (!ctx || muted) return;
    const t = ctx.currentTime, src = noiseSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + .05);
  }
  const silence = () => {
    if (!ctx || !engine) return;
    const t = ctx.currentTime;
    [engine.out, engine.screech, engine.grass, engine.wind].forEach(node => node.gain.setTargetAtTime(0, t, .12));
  };

  document.addEventListener('visibilitychange', () => { if (ctx) { if (document.hidden) ctx.suspend(); else ctx.resume(); } });

  return {
    silence,
    get muted() { return muted; },
    unlock() {                                          /* must run inside a user gesture */
      if (!AudioCtx) return;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* not supported */ }
      if (!ctx) build();
      if (ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      try { localStorage.setItem('nexo-muted', value ? '1' : '0'); } catch { /* storage unavailable */ }
      if (master) master.gain.setTargetAtTime(value ? 0 : .9, ctx.currentTime, .05);
      listeners.forEach(fn => fn(muted));
    },
    onMute(fn) { listeners.add(fn); fn(muted); },

    /* engine note follows speed through five "gears", so the revs rise and drop like a real shift */
    update(dt, { speed, throttle, onRoad, steer, active, maxSpeed }) {
      if (!ctx || !engine) return;
      if (!active) return silence();
      const t = ctx.currentTime, e = engine, GEARS = 5, span = maxSpeed / GEARS;
      const gear = Math.min(GEARS - 1, Math.floor(speed / span)), within = Math.min(1, (speed - gear * span) / span);
      const target = .18 + .72 * (within * .8 + (throttle > 0 ? .12 : 0));
      e.rpm += (target - e.rpm) * (1 - Math.exp(-10 * dt));
      const f = 36 + e.rpm * 150;
      e.o1.frequency.setTargetAtTime(f, t, .04);
      e.o2.frequency.setTargetAtTime(f * .5, t, .04);
      e.o3.frequency.setTargetAtTime(f * 1.007, t, .04);
      e.filter.frequency.setTargetAtTime(260 + e.rpm * 2100, t, .06);
      e.out.gain.setTargetAtTime(.06 + .11 * e.rpm * (throttle > 0 ? 1 : .55), t, .06);
      const slide = Math.abs(steer) * speed, braking = throttle < 0 && speed > 6 ? .08 : 0;
      e.screech.gain.setTargetAtTime(onRoad ? Math.max(braking, clamp01((slide - 7) / 8) * .12) : 0, t, .05);
      e.grass.gain.setTargetAtTime(onRoad ? 0 : clamp01(speed / 10) * .16, t, .08);
      e.wind.gain.setTargetAtTime(.012 + clamp01(speed / maxSpeed) * .05, t, .2);
    },

    chime() { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, { dur: .35, vol: .12, delay: i * .08 })); },
    tick() { tone(880, { dur: .08, vol: .05 }); },
    allDone() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { type: 'triangle', dur: .5, vol: .14, delay: i * .1 })); },
    fanfare() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, { type: 'triangle', dur: .6, vol: .15, delay: i * .09 })); },
    bump(strength = .5) { tone(130, { dur: .22, vol: .35 * strength, slideTo: 45 }); burst({ dur: .18, freq: 900, vol: .25 * strength }); },
    horn() { tone(392, { type: 'square', dur: .4, vol: .09 }); tone(494, { type: 'square', dur: .4, vol: .09 }); },
  };
}

/* ===== Playground: race track over rolling hills, sunset scene ===== */
function createGame(canvas, arena) {
  const HALF = 40;                       /* half the playable area */
  const ROAD_W = 7;
  const MAX_SPEED = 14, ACCEL = 20, BRAKE = 28, COAST = 8, TURN = 2.3;
  const PAD_COLORS = [0x4d6bff, 0xff5b6e, 0xefe3a8, 0x5cf2c2, 0x7a5bff, 0xffb45b];
  const HORIZON = 0xe0735f;
  const TRACK_POINTS = [[-4, -28], [14, -28], [28, -18], [25, -2], [28, 10], [16, 22], [0, 27], [-16, 24], [-28, 12], [-26, -6], [-18, -20]];
  const services = $$('.service').map(card => ({
    title: card.querySelector('h3').innerHTML.replace(/<br\s*\/?>/gi, ' '),
    desc: card.querySelector('p').textContent,
  }));

  /* ---------- helpers ---------- */
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .1, ...o });
  const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const srgb = (canvasEl, repeat = false) => {
    const t = new THREE.CanvasTexture(canvasEl);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; }
    return t;
  };

  function glowTexture(inner, outer) {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, inner); r.addColorStop(1, outer);
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    return srgb(c);
  }
  function labelTexture(text, done) {
    const c = makeCanvas(512, 160), g = c.getContext('2d');
    roundRect(g, 8, 28, 496, 104, 52, { fill: 'rgba(14,10,28,.78)' });
    g.fillStyle = done ? '#5cf2c2' : '#ffffff';
    g.font = '700 50px "Bricolage Grotesque", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 82);
    return srgb(c);
  }
  function skyTexture() {
    const c = makeCanvas(2, 512), g = c.getContext('2d');
    const gradient = g.createLinearGradient(0, 0, 0, 512);
    [[0, '#141238'], [.18, '#3a2b6e'], [.34, '#8a4585'], [.44, '#d9647a'], [.485, '#f0966a'], [.5, '#e0735f'], [1, '#e0735f']]
      .forEach(([t, col]) => gradient.addColorStop(t, col));
    g.fillStyle = gradient; g.fillRect(0, 0, 2, 512);
    return srgb(c);
  }
  function cloudTexture() {
    const c = makeCanvas(256, 96), g = c.getContext('2d'), r = mulberry(11);
    for (let i = 0; i < 14; i++) {
      const x = 30 + r() * 196, y = 40 + r() * 20, rad = 22 + r() * 26;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 96);
    }
    return srgb(c);
  }
  function asphaltTexture() {
    const c = makeCanvas(128, 256), g = c.getContext('2d'), r = mulberry(3);
    g.fillStyle = '#34353f'; g.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 1100; i++) { g.fillStyle = `rgba(255,255,255,${r() * .07})`; g.fillRect(r() * 128, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(34, 0, 14, 256); g.fillRect(80, 0, 14, 256);   /* worn tyre lanes */
    g.fillStyle = '#e9e6d8'; g.fillRect(6, 0, 4, 256); g.fillRect(118, 0, 4, 256);             /* edge lines */
    g.fillStyle = '#ffd36b'; for (let y = 0; y < 256; y += 64) g.fillRect(62, y, 4, 32);       /* dashed centre line */
    return srgb(c, true);
  }
  function curbTexture() {
    const c = makeCanvas(32, 64), g = c.getContext('2d');
    g.fillStyle = '#e23b4a'; g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#f3f0e8'; g.fillRect(0, 32, 32, 32);
    return srgb(c, true);
  }
  function checkerTexture() {
    const c = makeCanvas(128, 32), g = c.getContext('2d');
    for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#f3f0e8' : '#14121f'; g.fillRect(x * 16, y * 16, 16, 16); }
    return srgb(c);
  }
  function woodTexture() {
    const c = makeCanvas(128, 128), g = c.getContext('2d'), r = mulberry(5);
    g.fillStyle = '#b9824f'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 4; y++) {
      g.fillStyle = `rgba(0,0,0,${.05 + r() * .08})`; g.fillRect(0, y * 32, 128, 32);
      g.fillStyle = 'rgba(40,20,5,.55)'; g.fillRect(0, y * 32, 128, 2);
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(60,30,10,${r() * .18})`; g.fillRect(r() * 128, y * 32 + r() * 30, 20 + r() * 40, 1); }
    }
    g.strokeStyle = 'rgba(70,38,14,.9)'; g.lineWidth = 9; g.strokeRect(4, 4, 120, 120);
    g.lineWidth = 7; g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.moveTo(120, 8); g.lineTo(8, 120); g.stroke();
    return srgb(c);
  }

  /* ---------- track centre line + road height profile ---------- */
  const M = 400;
  const curve = new THREE.CatmullRomCurve3(TRACK_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const LOOP = curve.getLength();
  const samples = curve.getSpacedPoints(M).slice(0, M);
  const tangents = samples.map((_, i) => samples[(i + 1) % M].clone().sub(samples[(i + M - 1) % M]).normalize());
  const normals = tangents.map(t => new THREE.Vector3(-t.z, 0, t.x));

  /* natural hills: the road follows them (smoothed + slope-limited) so it never sits on a cliff */
  const baseHill = (x, z) => 3.4 * Math.sin(x * .065 + 1.3) * Math.cos(z * .058) + 2.2 * Math.sin((x + z) * .045 + .5) + .8 * Math.sin(x * .15) * Math.sin(z * .13);
  const fineNoise = (x, z) => .35 * Math.sin(x * .4 + z * .3) * Math.cos(z * .37 - x * .2);
  const rawH = samples.map(p => baseHill(p.x, p.z));
  const blur = (arr, r) => arr.map((_, i) => { let sum = 0; for (let k = -r; k <= r; k++) sum += arr[(i + k + M) % M]; return sum / (2 * r + 1); });
  const roadH = blur(blur(rawH, 14), 10);
  {
    const ds = LOOP / M, maxStep = Math.tan(14.5 * Math.PI / 180) * ds;
    for (let pass = 0; pass < 60; pass++) for (let i = 0; i < M; i++) {
      const j = (i + 1) % M, d = roadH[j] - roadH[i];
      if (Math.abs(d) > maxStep) { const e = (Math.abs(d) - maxStep) / 2 * Math.sign(d); roadH[i] += e; roadH[j] -= e; }
    }
  }

  const nearest = { d: 0, i: 0 };
  function nearestTrack(x, z) {
    let best = 1e9, bi = 0;
    for (let i = 0; i < M; i++) {
      const dx = x - samples[i].x, dz = z - samples[i].z, d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
    nearest.d = Math.sqrt(best); nearest.i = bi;
    return nearest;
  }

  /* ---------- heightfield ---------- */
  const wallHeight = m => 9 * smooth(HALF - 5, HALF + 4, m) * (1 - smooth(HALF + 10, HALF + 20, m));
  const SIZE = (HALF + 20) * 2, SEG = lowPower ? 110 : 160, STEP = SIZE / SEG, GW = SEG + 1;
  const heights = new Float32Array(GW * GW);
  const roadDist = new Float32Array(GW * GW).fill(99);
  for (let iz = 0; iz < GW; iz++) for (let ix = 0; ix < GW; ix++) {
    const x = -SIZE / 2 + ix * STEP, z = -SIZE / 2 + iz * STEP, k = iz * GW + ix;
    const m = Math.max(Math.abs(x), Math.abs(z));
    let d = 99, ti = 0;
    if (m <= HALF) { const n = nearestTrack(x, z); d = n.d; ti = n.i; }
    roadDist[k] = d;
    const natural = (baseHill(x, z) + fineNoise(x, z)) * (1 - smooth(HALF + 10, HALF + 20, m));
    const lift = m <= HALF ? (roadH[ti] - rawH[ti]) * (1 - smooth(ROAD_W / 2 + 3, ROAD_W / 2 + 26, d)) : 0;
    const w = smooth(ROAD_W / 2 + 1.2, ROAD_W / 2 + 11, d);
    heights[k] = (m <= HALF ? roadH[ti] * (1 - w) : 0) + (natural + lift) * w + wallHeight(m);
    heights[k] -= .14 * (1 - smooth(ROAD_W / 2 + 1.2, ROAD_W / 2 + 3, d));      /* road bed */
  }
  /* beyond the arena the ground sinks to a flat floor that lies below every valley, so the far-ground plane can never cover the playable area */
  const FLOOR = (() => {
    let lowest = 1e9;
    for (let iz = 0; iz < GW; iz++) for (let ix = 0; ix < GW; ix++) {
      const x = -SIZE / 2 + ix * STEP, z = -SIZE / 2 + iz * STEP;
      if (Math.max(Math.abs(x), Math.abs(z)) <= HALF + 4) lowest = Math.min(lowest, heights[iz * GW + ix]);
    }
    const floor = lowest - .6;
    for (let iz = 0; iz < GW; iz++) for (let ix = 0; ix < GW; ix++) {
      const x = -SIZE / 2 + ix * STEP, z = -SIZE / 2 + iz * STEP, k = iz * GW + ix;
      const f = smooth(HALF + 8, HALF + 19, Math.max(Math.abs(x), Math.abs(z)));
      heights[k] = heights[k] * (1 - f) + floor * f;
    }
    return floor;
  })();
  /* soften the spots where the nearest road point flips (keeps the road corridor itself untouched) */
  for (let pass = 0; pass < 10; pass++) {
    const copy = Float32Array.from(heights);
    for (let iz = 1; iz < GW - 1; iz++) for (let ix = 1; ix < GW - 1; ix++) {
      const k = iz * GW + ix;
      if (roadDist[k] < ROAD_W / 2 + 1.2) continue;
      let sum = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) sum += copy[k + a * GW + b];
      heights[k] = sum / 9;
    }
  }
  function heightAt(x, z) {
    const gx = (x + SIZE / 2) / STEP, gz = (z + SIZE / 2) / STEP;
    if (gx < 0 || gz < 0 || gx >= SEG || gz >= SEG) return FLOOR;
    const ix = Math.floor(gx), iz = Math.floor(gz), fx = gx - ix, fz = gz - iz;
    const h00 = heights[iz * GW + ix], h10 = heights[iz * GW + ix + 1], h01 = heights[(iz + 1) * GW + ix], h11 = heights[(iz + 1) * GW + ix + 1];
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  function normalAt(x, z, out = new THREE.Vector3()) {
    return out.set(heightAt(x - .6, z) - heightAt(x + .6, z), 1.2, heightAt(x, z - .6) - heightAt(x, z + .6)).normalize();
  }

  /* ---------- renderer, camera, fog ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.25 : 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(HORIZON, 45, 260);
  const camera = new THREE.PerspectiveCamera(52, 1, .5, 700);

  /* ---------- sky dome, sun, clouds (follow the camera) ---------- */
  const skyTex = skyTexture();
  const sunDir = new THREE.Vector3(-.52, .1, -.79).normalize();
  const sunCoreTex = glowTexture('rgba(255,244,214,1)', 'rgba(255,170,90,0)');
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })
  );
  dome.renderOrder = -1;
  const skySprite = (map, size, position, extra = {}) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false, fog: false, toneMapped: false, ...extra }));
    sprite.scale.set(size[0], size[1], 1);
    sprite.position.copy(position);
    dome.add(sprite);
    return sprite;
  };
  skySprite(sunCoreTex, [46, 46], sunDir.clone().multiplyScalar(380), { blending: THREE.AdditiveBlending });
  skySprite(glowTexture('rgba(255,160,90,.55)', 'rgba(255,120,80,0)'), [200, 200], sunDir.clone().multiplyScalar(380), { blending: THREE.AdditiveBlending });
  const cloudTex = cloudTexture();
  [[-70, 2.5, 170, 34], [-42, 4.2, 150, 30], [-15, 2, 190, 38], [14, 3.8, 160, 30], [40, 2.6, 180, 36], [66, 4.4, 150, 28]].forEach(([az, el, w, h], i) => {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    skySprite(cloudTex, [w, h], new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(380), { color: i % 2 ? 0xffa889 : 0xffc09a, transparent: true, opacity: .75 });
  });
  scene.add(dome);

  /* reflections: the sunset sky lights the paint, glass and rims */
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, toneMapped: false })));
    const envSun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunCoreTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    envSun.position.copy(sunDir).multiplyScalar(40);
    envSun.scale.set(26, 26, 1);
    envScene.add(envSun);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, .03).texture;
    scene.environmentIntensity = .6;
    pmrem.dispose();
  }

  /* ---------- sunset lighting (the shadow box follows the car, so shadows stay sharp) ---------- */
  scene.add(new THREE.HemisphereLight(0xffc9a0, 0x4a3a6a, .55));
  const sun = new THREE.DirectionalLight(0xff9a4a, 3.8);
  const sunTarget = new THREE.Object3D();
  const SUN_OFFSET = new THREE.Vector3(-38, 17, -58);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 });
  sun.shadow.bias = -.0006;
  sun.shadow.normalBias = .05;
  sun.target = sunTarget;
  scene.add(sun, sunTarget);
  const fill = new THREE.DirectionalLight(0x8f7bff, .7);
  fill.position.set(18, 10, 22);
  scene.add(fill);

  /* ---------- terrain ---------- */
  {
    const cA = new THREE.Color(0x4c7a2a), cB = new THREE.Color(0x8cb24c), cDirt = new THREE.Color(0x7b6446), cFar = new THREE.Color(0x4c7a2a), tmp = new THREE.Color();
    const colors = new Float32Array(GW * GW * 3);
    for (let iz = 0; iz < GW; iz++) for (let ix = 0; ix < GW; ix++) {
      const x = -SIZE / 2 + ix * STEP, z = -SIZE / 2 + iz * STEP, k = iz * GW + ix, m = Math.max(Math.abs(x), Math.abs(z));
      tmp.lerpColors(cA, cB, clamp01(.5 + .5 * Math.sin(x * .31) * Math.cos(z * .27) + heights[k] * .04));
      tmp.lerp(cDirt, (1 - smooth(ROAD_W / 2, ROAD_W / 2 + 2.4, roadDist[k])) * .85);
      tmp.lerp(cFar, smooth(HALF + 8, HALF + 19, m));
      colors.set([tmp.r, tmp.g, tmp.b], k * 3);
    }
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const tp = geo.attributes.position;
    for (let k = 0; k < tp.count; k++) tp.setY(k, heights[k]);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, std(0xffffff, { roughness: 1, metalness: 0, vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    terrain.receiveShadow = true;
    const farGround = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), std(0x4c7a2a, { roughness: 1, metalness: 0 }));
    farGround.rotation.x = -Math.PI / 2;
    farGround.position.y = FLOOR - .05;
    farGround.receiveShadow = true;
    scene.add(terrain, farGround);
  }

  /* ---------- road, curbs, start/finish line ---------- */
  function ribbon(from, to, a, b, lift, uvV, cols = 1) {
    const pos = [], uvs = [], idx = [], row = cols + 1;
    for (let k = from; k <= to; k++) {
      const i = ((k % M) + M) % M, p = samples[i], n = normals[i];
      for (let c = 0; c <= cols; c++) {
        const off = a + (b - a) * c / cols, x = p.x + n.x * off, z = p.z + n.z * off;
        pos.push(x, heightAt(x, z) + lift, z);
        uvs.push(c / cols, uvV(k));
      }
      if (k > from) {
        const r = k - from;
        for (let c = 0; c < cols; c++) {
          const v0 = (r - 1) * row + c, v1 = v0 + 1, v2 = r * row + c, v3 = v2 + 1;
          idx.push(v0, v1, v2, v1, v3, v2);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const flatOffset = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: THREE.DoubleSide };
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTexture(), roughness: .85, metalness: 0, ...flatOffset });
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTexture(), roughness: .7, metalness: 0, ...flatOffset });
  const lineMat = new THREE.MeshStandardMaterial({ map: checkerTexture(), roughness: .7, metalness: 0, ...flatOffset });
  [
    [ribbon(0, M, -ROAD_W / 2, ROAD_W / 2, .22, k => k / M * LOOP / 14, 6), roadMat],
    [ribbon(0, M, ROAD_W / 2, ROAD_W / 2 + .6, .3, k => k / M * LOOP / 2.2), curbMat],
    [ribbon(0, M, -ROAD_W / 2 - .6, -ROAD_W / 2, .3, k => k / M * LOOP / 2.2), curbMat],
    [ribbon(0, 3, -ROAD_W / 2, ROAD_W / 2, .26, k => k / 3, 6), lineMat],
  ].forEach(([geo, mat]) => { const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; scene.add(mesh); });

  /* ---------- scenery ---------- */
  const rand = mulberry(7);
  const obstacles = [];                  /* things the car bumps into: { x, z, r } */
  const m4 = new THREE.Matrix4(), quat = new THREE.Quaternion(), euler = new THREE.Euler(), pos = new THREE.Vector3(), scl = new THREE.Vector3(), tint = new THREE.Color();
  const cabinAt = { x: -17, z: 2 };

  function spot(minRoad, area, clearOf = []) {
    let x, z, tries = 0;
    do {
      x = (rand() - .5) * 2 * area; z = (rand() - .5) * 2 * area; tries++;
    } while (tries < 40 && (nearestTrack(x, z).d < ROAD_W / 2 + minRoad || Math.hypot(x, z) < 6 || Math.hypot(x - cabinAt.x, z - cabinAt.z) < 7 || clearOf.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)));
    return [x, z];
  }
  function instanced(geo, mat, list, { shadow = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((it, i) => {
      quat.setFromEuler(euler.set(it.rx || 0, it.ry || 0, it.rz || 0));
      pos.set(it.x, it.y, it.z);
      scl.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx);
      mesh.setMatrixAt(i, m4.compose(pos, quat, scl));
      if (it.color !== undefined) mesh.setColorAt(i, tint.set(it.color));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }
  const insideArena = (x, z) => Math.abs(x) < HALF - 2 && Math.abs(z) < HALF - 2;

  /* wind-swaying grass clumps */
  const windTime = { value: 0 };
  {
    const r = mulberry(21), gpos = [], gcol = [], gidx = [];
    for (let b = 0; b < 6; b++) {
      const ox = (r() - .5) * .4, oz = (r() - .5) * .4, a = r() * Math.PI, cx = Math.cos(a), cz = Math.sin(a), h = .45 + r() * .45, w = .06 + r() * .03, base = gpos.length / 3;
      [[-w, 0], [w, 0], [-w * .7, h * .5], [w * .7, h * .5], [0, h]].forEach(([x, y]) => {
        gpos.push(ox + cx * x, y, oz + cz * x);
        const t = y / h;
        gcol.push(.07 + .3 * t, .22 + .42 * t, .05 + .1 * t);
      });
      gidx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(gpos.map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    geo.setIndex(gidx);
    const mat = std(0xffffff, { roughness: 1, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = shader => {
      shader.uniforms.uTime = windTime;
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'uniform float uTime;\nvoid main() {')
        .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
          float sway = sin(uTime * 1.7 + instanceMatrix[3].x * .35 + instanceMatrix[3].z * .27) * .1 * position.y;
          transformed.x += sway; transformed.z += sway * .6;`);
    };
    const list = [];
    for (let i = 0; i < (lowPower ? 4500 : 12000); i++) {
      let x, z, tries = 0;
      do { x = (rand() - .5) * 2 * (HALF + 12); z = (rand() - .5) * 2 * (HALF + 12); tries++; }
      while (tries < 20 && (nearestTrack(x, z).d < ROAD_W / 2 + 1.4 || Math.hypot(x, z) < 3.8));
      const k = .9 + rand() * .9;
      list.push({ x, y: heightAt(x, z) - .04, z, rx: (rand() - .5) * .25, ry: rand() * TAU, rz: (rand() - .5) * .25, sx: k, sy: k * (.8 + rand() * .7), sz: k, color: new THREE.Color(.82 + rand() * .35, .88 + rand() * .3, .72 + rand() * .3).getHex() });
    }
    instanced(geo, mat, list, { shadow: false });
  }

  /* flowers */
  {
    const palette = [0xffd23f, 0xff6b9a, 0xffffff, 0xff9f43, 0xb98cff], list = [];
    for (let i = 0; i < (lowPower ? 300 : 700); i++) {
      const [x, z] = spot(1.6, HALF + 8);
      const k = .8 + rand() * .7;
      list.push({ x, y: heightAt(x, z) + .32 * k, z, sx: k, sy: k * .8, color: palette[Math.floor(rand() * palette.length)] });
    }
    instanced(new THREE.SphereGeometry(.1, 6, 5), std(0xffffff, { roughness: .8 }), list, { shadow: false });
  }

  /* pines (three stacked cones) and autumn trees */
  {
    const pines = [], broad = [];
    const PINES = lowPower ? 34 : 64, BROAD = lowPower ? 14 : 28;
    for (let i = 0; i < PINES + BROAD; i++) {
      let x, z;
      if (rand() < .65) [x, z] = spot(4, HALF + 6);
      else { const a = rand() * TAU, r = 62 + rand() * 33; x = Math.cos(a) * r; z = Math.sin(a) * r; }
      const k = .85 + rand() * 1.0, y = heightAt(x, z) - .05;
      (i < PINES ? pines : broad).push({ x, y, z, k });
      if (insideArena(x, z)) obstacles.push({ x, z, r: .5 * k });
    }
    const pineGreens = [0x1f4d3a, 0x2a5e3c, 0x2f6b3a, 0x24543f];
    const trunkMat = std(0x4a3226, { roughness: 1 });
    instanced(new THREE.CylinderGeometry(.22, .34, 1.6, 6), trunkMat, [...pines, ...broad].map(t => ({ x: t.x, y: t.y + .8 * t.k, z: t.z, sx: t.k })));
    [[1.7, 2.4, 1.9], [1.35, 2.2, 3.0], [1.0, 2.0, 4.0]].forEach(([radius, height, lift]) => {
      instanced(new THREE.ConeGeometry(radius, height, 8), std(0xffffff, { roughness: 1 }),
        pines.map(t => ({ x: t.x, y: t.y + lift * t.k, z: t.z, sx: t.k, ry: rand() * TAU, color: pineGreens[Math.floor(rand() * pineGreens.length)] })));
    });
    const autumn = [0xe0822f, 0xd9a23a, 0xc2493a, 0x7da83c, 0xe8b04a];
    instanced(new THREE.IcosahedronGeometry(1.5, 1), std(0xffffff, { roughness: .9, flatShading: true }),
      broad.map(t => ({ x: t.x, y: t.y + 3.1 * t.k, z: t.z, sx: t.k, sy: t.k * .85, ry: rand() * TAU, color: autumn[Math.floor(rand() * autumn.length)] })));
  }

  /* rocks and bushes */
  {
    const rocks = [], bushes = [], rockColors = [0x8a8190, 0x7a7080, 0x9a8f98, 0x6f6678];
    for (let i = 0; i < (lowPower ? 26 : 50); i++) {
      const [x, z] = spot(2.5, HALF + 6), sx = .8 + rand() * 1.1, sy = .5 + rand() * .6, sz = .8 + rand() * 1.0;
      rocks.push({ x, y: heightAt(x, z) + .1 * sy, z, sx, sy, sz, ry: rand() * TAU, rx: (rand() - .5) * .4, color: rockColors[Math.floor(rand() * rockColors.length)] });
      if (insideArena(x, z) && sx > 1.1) obstacles.push({ x, z, r: .62 * sx });
    }
    instanced(new THREE.IcosahedronGeometry(.7, 0), std(0xffffff, { roughness: .95, flatShading: true }), rocks);
    const greens = [0x3f7a35, 0x4f8a3a, 0x35693a, 0x6a8f3a];
    for (let i = 0; i < (lowPower ? 30 : 60); i++) {
      const [x, z] = spot(2.2, HALF + 6), k = .8 + rand() * .9;
      bushes.push({ x, y: heightAt(x, z) + .3 * k, z, sx: k, sy: k * .8, ry: rand() * TAU, color: greens[Math.floor(rand() * greens.length)] });
    }
    instanced(new THREE.IcosahedronGeometry(.8, 1), std(0xffffff, { roughness: 1 }), bushes);
  }

  /* tyre barriers on the outside of the sharp corners */
  {
    const stacks = [];
    for (let i = 0; i < M; i += 3) {
      const t1 = tangents[(i + M - 6) % M], t2 = tangents[(i + 6) % M];
      const turn = t1.x * t2.z - t1.z * t2.x, angle = Math.abs(Math.atan2(turn, t1.dot(t2)));
      if (angle > .2 && stacks.length < 44) {
        const side = -Math.sign(turn) * (ROAD_W / 2 + 1.8);
        stacks.push({ x: samples[i].x + normals[i].x * side, z: samples[i].z + normals[i].z * side, c: stacks.length });
      }
    }
    const tires = [];
    stacks.forEach(st => {
      const y = heightAt(st.x, st.z);
      [.17, .5].forEach(dy => tires.push({ x: st.x, y: y + dy, z: st.z, rx: Math.PI / 2, sx: 1, color: st.c % 2 ? 0xf0ece4 : 0xd8323f }));
      obstacles.push({ x: st.x, z: st.z, r: .55 });
    });
    instanced(new THREE.TorusGeometry(.36, .17, 8, 16), std(0xffffff, { roughness: .8 }), tires);
  }

  /* cabin by the track */
  {
    const base = Math.max(...[[-2.4, -2], [2.4, -2], [-2.4, 2], [2.4, 2], [0, 0]].map(([dx, dz]) => heightAt(cabinAt.x + dx, cabinAt.z + dz)));
    const cabin = new THREE.Group();
    cabin.position.set(cabinAt.x, base, cabinAt.z);
    cabin.rotation.y = .5;
    const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; cabin.add(m); return m; };
    part(new THREE.BoxGeometry(5.6, 3.5, 4.6), std(0x6e6a78, { roughness: 1 }), 0, -1.2, 0);                       /* stone foundation */
    part(new THREE.BoxGeometry(5, 2.6, 4), std(0xc9915c, { roughness: .9 }), 0, 1.3, 0);                           /* walls */
    const roof = part(new THREE.ConeGeometry(4.1, 2.1, 4), std(0x8a3b3b, { roughness: .8 }), 0, 3.9, 0);
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, .86);
    part(new THREE.BoxGeometry(.9, 1.9, .12), std(0x4a2f22, { roughness: .9 }), 0, .95, 2.04);                      /* door */
    part(new THREE.BoxGeometry(.5, 1.6, .5), std(0x5a4a4a, { roughness: 1 }), 1.6, 4.4, -.8);                       /* chimney */
    [[-1.6, 1.5, 2.03], [1.6, 1.5, 2.03]].forEach(([x, y, z]) => part(new THREE.BoxGeometry(.9, .8, .06), glow(0xffc27a), x, y, z));
    scene.add(cabin);
    obstacles.push({ x: cabinAt.x, z: cabinAt.z, r: 3.4 });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,200,130,.8)', 'rgba(255,150,80,0)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(7, 5, 1);
    halo.position.set(cabinAt.x + Math.sin(.5) * 2.2, base + 2.3, cabinAt.z + Math.cos(.5) * 2.2);
    scene.add(halo);
  }

  /* lamps along the road */
  const lampGlow = glowTexture('rgba(255,214,150,.55)', 'rgba(255,150,80,0)');
  [30, 100, 170, 240, 310, 370].forEach(i => {
    const x = samples[i].x + normals[i].x * (ROAD_W / 2 + 1.8), z = samples[i].z + normals[i].z * (ROAD_W / 2 + 1.8), y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.12, .15, 3.2, 8), std(0x1a1626));
    pole.position.set(x, y + 1.6, z);
    pole.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.28, 12, 12), glow(0xffd9a0));
    bulb.position.set(x, y + 3.3, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampGlow, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    halo.scale.set(3.2, 3.2, 1);
    halo.position.copy(bulb.position);
    scene.add(pole, bulb, halo);
    obstacles.push({ x, z, r: .3 });
  });

  /* distant mountains + floating dust motes */
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * TAU + rand() * .3, r = 170 + rand() * 30, h = 22 + rand() * 28;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(30 + rand() * 20, h, 5), std(0x2a1f45, { roughness: 1, flatShading: true }));
    mountain.position.set(Math.cos(a) * r, FLOOR + h / 2 - 2.5, Math.sin(a) * r);
    mountain.rotation.y = rand() * TAU;
    scene.add(mountain);
  }
  const motes = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(Float32Array.from({ length: (lowPower ? 50 : 90) * 3 }, (_, i) => i % 3 === 1 ? 1 + rand() * 8 : (rand() - .5) * 90), 3)),
    new THREE.PointsMaterial({ color: 0xffc890, size: .14, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })
  );
  scene.add(motes);

  /* ---------- car: extruded side profile, glossy paint, glass, detailed wheels ---------- */
  function extrudeProfile(points, depth, bevel) {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 });
    geo.rotateY(-Math.PI / 2);
    geo.translate(depth / 2, 0, 0);
    return geo;
  }
  const car = new THREE.Group();
  const body = new THREE.Group();
  car.add(body);
  const add = (geo, mat, x, y, z) => { const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = true; body.add(mesh); return mesh; };
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x3d63ff, roughness: .35, metalness: .25, clearcoat: 1, clearcoatRoughness: .2 });
  const glass = std(0x10162e, { roughness: .08, metalness: .7 });
  const trim = std(0x10121e, { roughness: .6 });
  const white = std(0xf3f0e8, { roughness: .4 });
  add(extrudeProfile([[-1.12, .28], [-1.16, .5], [-1.06, .7], [-.3, .72], [.5, .72], [1.02, .62], [1.16, .48], [1.1, .28]], 1.16, .06), paint, 0, 0, 0);
  add(extrudeProfile([[-.66, .72], [-.42, 1.12], [.2, 1.14], [.56, .76]], .98, .035), glass, 0, 0, 0);
  add(new THREE.BoxGeometry(1.02, .04, .62), paint, 0, 1.17, -.1);
  add(new THREE.BoxGeometry(.16, .012, 2.2), white, 0, .79, 0);
  add(new THREE.BoxGeometry(.16, .012, .6), white, 0, 1.2, -.1);
  add(new THREE.BoxGeometry(.5, .12, .05), trim, 0, .5, 1.19);
  [1.16, -1.16].forEach(z => add(new THREE.BoxGeometry(1.12, .14, .1), trim, 0, .33, z));
  [-.4, .4].forEach(x => {
    add(new THREE.BoxGeometry(.26, .13, .06), glow(0xfff1c9), x, .58, 1.19);
    add(new THREE.BoxGeometry(.3, .1, .05), glow(0xff3b4e), x * 1.05, .6, -1.19);
    add(new THREE.CylinderGeometry(.05, .05, .2, 8), std(0xc9ceea, { metalness: .8, roughness: .3 }), x * .75, .3, -1.22).rotation.x = Math.PI / 2;
    add(new THREE.BoxGeometry(.12, .1, .07), paint, x * 1.6, .86, .42);
    add(new THREE.BoxGeometry(.05, .2, .05), trim, x * .9, .98, -1.02);
  });
  add(new THREE.BoxGeometry(1.1, .05, .3), std(0xff5b6e, { roughness: .4 }), 0, 1.1, -1.04);
  add(new THREE.BoxGeometry(.5, .04, .03), glow(0xff3b4e), 0, .62, -1.2);
  const tireMat = std(0x0b0d1a, { roughness: .9 }), rimMat = std(0xc9ceea, { roughness: .25, metalness: .8 });
  const wheels = [[-.66, .72], [.66, .72], [-.66, -.72], [.66, -.72]].map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, .32, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .26, 20), tireMat);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .28, 14), rimMat);
    [tire, rim].forEach(m => { m.rotation.z = Math.PI / 2; m.castShadow = true; pivot.add(m); });
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(.04, .34, .06), rimMat);
      spoke.position.x = Math.sign(x) * .14;
      spoke.rotation.x = k / 5 * Math.PI;
      pivot.add(spoke);
    }
    body.add(pivot);
    return pivot;
  });
  const headlight = new THREE.SpotLight(0xffe2b0, 90, 26, .5, .6, 1.6);
  headlight.position.set(0, .7, 1.1);
  headlight.target.position.set(0, 0, 9);
  car.add(headlight, headlight.target);
  scene.add(car);

  /* ---------- pads: ring that follows the slope + light beam + floating label ---------- */
  function makePad({ x, z, color, text, radius = 2, beamHeight = 6 }) {
    const group = new THREE.Group();
    group.position.set(x, heightAt(x, z) + .4, z);
    const flat = new THREE.Group();
    flat.quaternion.setFromUnitVectors(UP, normalAt(x, z));
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius - .5, radius, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius - .5, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .16, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    [ring, disc].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.y = .03; flat.add(m); });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * .8, radius * .8, beamHeight, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false })
    );
    beam.position.y = beamHeight / 2;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, false), transparent: true, toneMapped: false, fog: false }));
    sprite.scale.set(5.2, 1.63, 1);
    sprite.position.y = 3.2;
    group.add(flat, beam, sprite);
    scene.add(group);
    const recolor = c => [ring, disc, beam].forEach(m => m.material.color.set(c));
    return { group, beam, sprite, recolor, x, z };
  }

  const pads = services.map((service, i) => {
    const at = samples[Math.round(45 + i * M / services.length) % M];
    const pad = makePad({ x: at.x, z: at.z, color: PAD_COLORS[i], text: `${String(i + 1).padStart(2, '0')}  ${service.title}` });
    pad.visited = false;
    return pad;
  });
  const finish = makePad({ x: 0, z: 0, color: 0xffd9a0, text: 'Start a project →', radius: 2.7, beamHeight: 9 });
  finish.group.visible = false;
  finish.unlocked = false;
  finish.scale = 0;
  const FINISH_ID = pads.length;

  /* ---------- pushable wooden crates ---------- */
  const woodMap = woodTexture();
  const crateTints = [0xffffff, 0xffe0c0, 0xe8b88a];
  const crates = [[-8, -6], [8, 6], [-5, 10], [6, -10], [-12, 4], [12, -2], [3, 14], [-2, -14], [14, 12], [-14, -12], [10, -14], [-10, 14], [21, -23], [-22, -13], [26, 4]].map(([x, z], i) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), std(crateTints[i % 3], { map: woodMap, roughness: .85, metalness: 0 }));
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, x, z, vx: 0, vz: 0, spin: 0, r: .75 };
  });

  /* ---------- dust and smoke puffs from the wheels ---------- */
  const puffTex = glowTexture('rgba(255,255,255,.95)', 'rgba(255,255,255,0)');
  const puffs = Array.from({ length: lowPower ? 28 : 56 }, () => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }));
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 };
  });
  let puffNext = 0, puffClock = 0;
  const wheelWorld = new THREE.Vector3();
  function emitPuff(wheel, color) {
    wheel.getWorldPosition(wheelWorld);
    const p = puffs[puffNext++ % puffs.length];
    p.life = p.max = .7 + Math.random() * .5;
    p.vx = (Math.random() - .5) * 1.2; p.vz = (Math.random() - .5) * 1.2; p.vy = .8 + Math.random() * .6;
    p.size = .7 + Math.random() * .5;
    p.sprite.material.color.set(color);
    p.sprite.position.set(wheelWorld.x, wheelWorld.y - .1, wheelWorld.z);
    p.sprite.visible = true;
  }
  function updatePuffs(dt) {
    for (const p of puffs) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      const t = 1 - p.life / p.max;
      p.sprite.position.x += p.vx * dt; p.sprite.position.y += p.vy * dt; p.sprite.position.z += p.vz * dt;
      p.sprite.scale.setScalar(p.size * (1 + t * 2.4));
      p.sprite.material.opacity = .45 * (1 - t);
    }
  }

  /* ---------- HUD ---------- */
  const hud = $('#hud'), toast = $('#toast'), stickEl = $('#stick'), knob = $('i', stickEl);
  const muteBtn = $('#mute'), fsBtn = $('#fs'), spNum = $('#spNum'), spVal = $('#spVal'), spGear = $('#spGear');
  let shownKmh = -1, shownGear = '', audioClock = 0, bumpCool = 0;
  arena.classList.toggle('touch-ui', lowPower);
  const audio = createAudio();
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  const ICON = {
    sound: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
    muted: svg('<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
    fs: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    fsExit: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
  };
  audio.onMute(isMuted => {
    muteBtn.innerHTML = isMuted ? ICON.muted : ICON.sound;
    muteBtn.setAttribute('aria-pressed', String(isMuted));
    muteBtn.setAttribute('aria-label', isMuted ? 'Unmute sound' : 'Mute sound');
  });
  muteBtn.onclick = () => audio.setMuted(!audio.muted);
  const dots = services.map(() => { const d = document.createElement('span'); d.className = 'dot'; hud.append(d); return d; });
  let toastTimer = 0;
  function showToast(html, persist = false) {
    toast.innerHTML = html;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    if (!persist) toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
  }
  function hideToast() { clearTimeout(toastTimer); toast.classList.remove('show'); }
  toast.addEventListener('click', e => { if (e.target.closest('a')) { stop(); exitFull(); } });

  /* every pad shows its info card while the car is on it */
  let activePad = -1;
  function enterPad(id) {
    if (id < 0) return hideToast();
    if (id === FINISH_ID) {
      audio.fanfare();
      return showToast('<strong>Ready to build yours?</strong><span>Tell us about your project.</span><a class="btn main" href="#contact">Start a project →</a>', true);
    }
    const pad = pads[id], first = !pad.visited;
    if (first) audio.chime(); else audio.tick();
    let note = '';
    if (first) {
      pad.visited = true;
      pad.recolor(0x5cf2c2);
      pad.sprite.material.map = labelTexture(`✓  ${services[id].title}`, true);
      pad.sprite.material.needsUpdate = true;
      dots[id].classList.add('on');
      if (pads.every(p => p.visited)) {
        finish.unlocked = true;
        setTimeout(() => audio.allDone(), 450);
        finish.group.visible = true;
        note = '<span class="note">All services visited. A glowing pad appeared in the middle of the track.</span>';
      }
    }
    showToast(`<strong>${escapeHTML(services[id].title)}</strong><span>${escapeHTML(services[id].desc)}</span>${note}`, true);
  }
  function padUnderCar() {
    for (let i = 0; i < pads.length; i++) if (Math.hypot(state.x - pads[i].x, state.z - pads[i].z) < 2.4) return i;
    if (finish.unlocked && Math.hypot(state.x - finish.x, state.z - finish.z) < 2.8) return FINISH_ID;
    return -1;
  }

  /* ---------- input: keyboard + drag stick ---------- */
  const keys = new Set();
  const stickVec = { x: 0, y: 0 };
  let origin = null, playing = false, visible = false;

  /* fullscreen: native where available, a CSS fallback for iPhone */
  let pseudo = false;
  const isFull = () => document.fullscreenElement === arena || document.webkitFullscreenElement === arena || pseudo;
  function syncFs() {
    fsBtn.innerHTML = isFull() ? ICON.fsExit : ICON.fs;
    fsBtn.setAttribute('aria-label', isFull() ? 'Exit fullscreen' : 'Fullscreen');
  }
  async function enterFull() {
    try {
      if (arena.requestFullscreen) await arena.requestFullscreen({ navigationUI: 'hide' });
      else if (arena.webkitRequestFullscreen) arena.webkitRequestFullscreen();
      else throw new Error('no fullscreen api');
      try { await screen.orientation?.lock?.('landscape'); } catch { /* not allowed on this device */ }
    } catch {
      pseudo = true;
      arena.classList.add('pseudo-full');
      document.documentElement.style.overflow = 'hidden';
    }
    syncFs();
  }
  function exitFull() {
    if (pseudo) {
      pseudo = false;
      arena.classList.remove('pseudo-full');
      document.documentElement.style.overflow = '';
    } else if (document.fullscreenElement) document.exitFullscreen?.();
    else if (document.webkitFullscreenElement) document.webkitExitFullscreen?.();
    try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
    syncFs();
  }
  fsBtn.onclick = () => isFull() ? exitFull() : enterFull();
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  syncFs();

  function start() {
    playing = true;
    arena.classList.add('playing');
    audio.unlock();
    if (lowPower && !isFull()) enterFull();             /* phones: go fullscreen when the game starts */
  }
  function stop() {
    playing = false; keys.clear(); origin = null; stickVec.x = stickVec.y = 0;
    stickEl.hidden = true; arena.classList.remove('playing');
    $$('#touch button').forEach(b => b.classList.remove('active'));
    audio.silence();
    activePad = -1; hideToast();
  }
  $('#start').onclick = start;
  $('#exit').onclick = () => { stop(); exitFull(); };

  addEventListener('keydown', e => {
    if (!playing) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { stop(); exitFull(); return; }
    if (k === 'h') return audio.horn();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  arena.addEventListener('pointerdown', e => {
    if (!playing || lowPower || e.target.closest('button, a')) return;      /* phones use the on-screen buttons */
    const r = arena.getBoundingClientRect();
    origin = { x: e.clientX, y: e.clientY };
    stickEl.style.left = `${e.clientX - r.left}px`;
    stickEl.style.top = `${e.clientY - r.top}px`;
    stickEl.hidden = false;
    arena.setPointerCapture(e.pointerId);
  });
  arena.addEventListener('pointermove', e => {
    if (!origin) return;
    const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const len = Math.hypot(dx, dy) || 1, m = Math.min(1, len / 50);
    stickVec.x = dx / len * m;
    stickVec.y = dy / len * m;
    knob.style.transform = `translate(${stickVec.x * 40}px, ${stickVec.y * 40}px)`;
  });
  const release = () => { origin = null; stickVec.x = stickVec.y = 0; stickEl.hidden = true; knob.style.transform = ''; };
  arena.addEventListener('pointerup', release);
  arena.addEventListener('pointercancel', release);

  $$('#touch button').forEach(btn => {
    const key = btn.dataset.key;
    const press = e => { e.preventDefault(); keys.add(key); btn.classList.add('active'); try { btn.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
    const release = () => { keys.delete(key); btn.classList.remove('active'); };
    btn.addEventListener('pointerdown', press);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => btn.addEventListener(ev, release));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  function readInput() {
    let throttle = (keys.has('arrowup') || keys.has('w') ? 1 : 0) - (keys.has('arrowdown') || keys.has('s') ? 1 : 0);
    let steer = (keys.has('arrowleft') || keys.has('a') ? 1 : 0) - (keys.has('arrowright') || keys.has('d') ? 1 : 0);
    if (origin) {
      if (Math.abs(stickVec.y) > .15) throttle = -stickVec.y;
      else if (Math.abs(stickVec.x) > .15) throttle = .5;       /* creep forward while only steering */
      if (Math.abs(stickVec.x) > .15) steer = -stickVec.x;
    }
    return { throttle, steer };
  }

  /* ---------- simulation ---------- */
  const startPoint = samples[10], startDir = samples[12].clone().sub(samples[8]);
  const state = { x: startPoint.x, z: startPoint.z, h: Math.atan2(startDir.x, startDir.z), speed: 0, steer: 0, throttle: 0, onRoad: true };
  const camPos = { x: state.x, y: heightAt(state.x, state.z), z: state.z };
  let camLift = 0, carLift = 0;
  const carNormal = new THREE.Vector3(0, 1, 0), nTarget = new THREE.Vector3(), qTilt = new THREE.Quaternion(), qYaw = new THREE.Quaternion();

  function bump(impact) {                                                         /* collision sound, rate-limited */
    if (bumpCool > 0 || impact < 2) return;
    audio.bump(clamp01(impact / 10));
    bumpCool = .3;
  }

  function step(dt) {
    const { throttle, steer } = playing ? readInput() : { throttle: 0, steer: 0 };
    state.steer = steer;
    state.throttle = throttle;
    bumpCool -= dt;
    state.onRoad = nearestTrack(state.x, state.z).d < ROAD_W / 2 + .6;
    const maxSpeed = state.onRoad ? MAX_SPEED : MAX_SPEED * .65;

    if (throttle) state.speed += throttle * (throttle * state.speed >= 0 ? ACCEL : BRAKE) * dt;
    else state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), COAST * dt);
    if (!state.onRoad) state.speed -= state.speed * .9 * dt;                    /* grass slows you down */
    if (state.speed > maxSpeed) state.speed -= (state.speed - maxSpeed) * Math.min(1, 4 * dt);

    const fx = Math.sin(state.h), fz = Math.cos(state.h);
    const slope = (heightAt(state.x + fx * .6, state.z + fz * .6) - heightAt(state.x - fx * .6, state.z - fz * .6)) / 1.2;
    state.speed -= slope * 9 * dt;                                               /* uphill slows, downhill speeds up */

    state.speed = Math.max(-MAX_SPEED * .4, Math.min(MAX_SPEED, state.speed));
    state.h += steer * TURN * Math.min(1, Math.abs(state.speed) / 4) * Math.sign(state.speed) * dt;
    state.x += Math.sin(state.h) * state.speed * dt;
    state.z += Math.cos(state.h) * state.speed * dt;

    const lim = HALF - 1.2;
    if (Math.abs(state.x) > lim) { bump(Math.abs(state.speed)); state.x = Math.sign(state.x) * lim; state.speed *= -.35; }
    if (Math.abs(state.z) > lim) { bump(Math.abs(state.speed)); state.z = Math.sign(state.z) * lim; state.speed *= -.35; }

    for (const o of obstacles) {                                                  /* trees, rocks, tyres, cabin, lamps */
      const dx = state.x - o.x, dz = state.z - o.z, min = o.r + 1, d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || .001;
        state.x = o.x + dx / d * min; state.z = o.z + dz / d * min;
        bump(Math.abs(state.speed));
        state.speed *= .4;
      }
    }

    const carVx = Math.sin(state.h) * state.speed, carVz = Math.cos(state.h) * state.speed;
    const crateLim = HALF - .75, drag = Math.exp(-2.4 * dt);
    crates.forEach((c, i) => {
      c.x += c.vx * dt; c.z += c.vz * dt;
      c.vx *= drag; c.vz *= drag; c.spin *= drag;
      if (Math.abs(c.x) > crateLim) { c.x = Math.sign(c.x) * crateLim; c.vx *= -.5; }
      if (Math.abs(c.z) > crateLim) { c.z = Math.sign(c.z) * crateLim; c.vz *= -.5; }

      let dx = c.x - state.x, dz = c.z - state.z, d = Math.hypot(dx, dz) || .001;
      const min = c.r + 1.05;
      if (d < min) {
        const nx = dx / d, nz = dz / d;
        c.x = state.x + nx * min; c.z = state.z + nz * min;
        const rel = (c.vx - carVx) * nx + (c.vz - carVz) * nz;
        if (rel < 0) { bump(-rel * .8); c.vx -= 1.7 * rel * nx; c.vz -= 1.7 * rel * nz; c.spin += (Math.random() - .5) * 6; state.speed *= .96; }
      }
      for (let j = i + 1; j < crates.length; j++) {
        const o = crates[j];
        dx = o.x - c.x; dz = o.z - c.z; d = Math.hypot(dx, dz) || .001;
        if (d < c.r * 2) {
          const nx = dx / d, nz = dz / d, push = (c.r * 2 - d) / 2;
          c.x -= nx * push; c.z -= nz * push; o.x += nx * push; o.z += nz * push;
          const rel = (o.vx - c.vx) * nx + (o.vz - c.vz) * nz;
          if (rel < 0) { c.vx += rel * nx; c.vz += rel * nz; o.vx -= rel * nx; o.vz -= rel * nz; }
        }
      }
      c.mesh.position.set(c.x, heightAt(c.x, c.z) + .74, c.z);
      c.mesh.rotation.y += c.spin * dt;
    });

    const here = padUnderCar();
    if (here !== activePad) { activePad = here; enterPad(here); }
  }

  /* ---------- sizing + visibility ---------- */
  function resize() {
    const { width, height } = arena.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(arena);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (!visible) stop(); }).observe(arena);

  return {
    setLight() { /* the scene stays at sunset in both site themes */ },

    update(time, dt) {
      if (!visible) return;
      step(dt);
      windTime.value = time;

      /* engine sound (30 Hz is plenty) + speedometer */
      audioClock += dt;
      if (audioClock >= .033) {
        audio.update(audioClock, { speed: Math.abs(state.speed), throttle: state.throttle, onRoad: state.onRoad, steer: state.steer, active: playing, maxSpeed: MAX_SPEED });
        audioClock = 0;
      }
      const kmh = Math.round(Math.abs(state.speed) * 12.86);
      if (kmh !== shownKmh) {
        shownKmh = kmh;
        spNum.textContent = kmh;
        spVal.style.strokeDasharray = `${226 * clamp01(kmh / 180)} 302`;
      }
      const gearText = Math.abs(state.speed) < .3 ? 'N' : state.speed < 0 ? 'R' : `D${Math.min(5, Math.floor(state.speed / (MAX_SPEED / 5)) + 1)}`;
      if (gearText !== shownGear) { shownGear = gearText; spGear.textContent = gearText; }

      /* the car follows the terrain: height + tilt to the slope */
      carLift = damp(carLift, state.onRoad ? .26 : .06, 12, dt);                    /* sit on the asphalt, settle into the grass */
      car.position.set(state.x, heightAt(state.x, state.z) + carLift, state.z);
      normalAt(state.x, state.z, nTarget);
      carNormal.lerp(nTarget, 1 - Math.exp(-10 * dt)).normalize();
      qTilt.setFromUnitVectors(UP, carNormal);
      qYaw.setFromAxisAngle(UP, state.h);
      car.quaternion.copy(qTilt).multiply(qYaw);
      wheels.forEach(w => w.rotation.x += state.speed * dt / .32);

      /* dust on grass, tyre smoke when drifting on the road */
      puffClock += dt;
      if (puffClock > .045) {
        puffClock = 0;
        const fast = Math.abs(state.speed);
        if (!state.onRoad && fast > 2.5) { emitPuff(wheels[2], 0xc9a878); emitPuff(wheels[3], 0xc9a878); }
        else if (state.onRoad && fast > 8 && Math.abs(state.steer) > .7) { emitPuff(wheels[2], 0xe6e0da); emitPuff(wheels[3], 0xe6e0da); }
      }
      updatePuffs(dt);

      pads.forEach((pad, i) => {
        pad.sprite.position.y = 3.2 + Math.sin(time * 2 + i) * .15;
        pad.beam.material.opacity = (pad.visited ? .06 : .13) + Math.sin(time * 2 + i) * .02;
      });
      if (finish.group.visible) {
        finish.scale = damp(finish.scale, 1, 4, dt);
        finish.group.scale.setScalar(Math.max(.001, finish.scale));
        finish.sprite.position.y = 3.6 + Math.sin(time * 2.4) * .2;
      }
      motes.rotation.y = time * .02;

      sunTarget.position.set(state.x, car.position.y, state.z);
      sun.position.copy(sunTarget.position).add(SUN_OFFSET);

      camPos.x = damp(camPos.x, state.x, 4, dt);
      camPos.y = damp(camPos.y, car.position.y, 3, dt);
      camPos.z = damp(camPos.z, state.z, 4, dt);
      const portrait = camera.aspect < .9;
      const up = portrait ? 18 : 7, back = portrait ? 22 : 12.5;
      /* camera collision: rise above any hill between the camera and the car */
      let need = 0;
      for (let t = .3; t <= 1.0001; t += .1) need = Math.max(need, (heightAt(camPos.x, camPos.z + back * t) + 1.4 - (camPos.y + up * t)) / t);
      camLift = need > camLift ? need : damp(camLift, need, 2.5, dt);
      camera.position.set(camPos.x, camPos.y + up + camLift, camPos.z + back);
      camera.lookAt(camPos.x, camPos.y + (portrait ? 0 : .5), camPos.z - (portrait ? 4 : 5.5));
      dome.position.copy(camera.position);

      renderer.render(scene, camera);
    },
  };
}

/* create the game only when the section is about to be seen */
let game = null;
new IntersectionObserver(([entry], observer) => {
  if (!entry.isIntersecting) return;
  game = createGame($('#game3d'), $('#arena'));
  game.setLight(body.classList.contains('light'));
  observer.disconnect();
}, { rootMargin: '200px' }).observe($('#arena'));

/* theme toggle (needs hero to recolor the 3D dust) */
$('#theme').onclick = () => {
  const isLight = body.classList.toggle('light');
  $('meta[name=theme-color]').content = isLight ? '#eef0fa' : '#07080f';
  hero.setLight(isLight);
  game?.setLight(isLight);
};

/* ===== Main loop ===== */
let lastFrame = performance.now();
let smoothScroll = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastFrame) / 1000, .05);
  lastFrame = now;

  /* ambient glow follows the pointer (skipped on touch devices: repainting a full-screen gradient every frame is costly) */
  if (!lowPower) {
    glow.x = damp(glow.x, pointer.x / innerWidth * 100, 3, dt);
    glow.y = damp(glow.y, pointer.y / innerHeight * 100, 3, dt);
    el.glow.style.setProperty('--mx', `${glow.x.toFixed(2)}%`);
    el.glow.style.setProperty('--my', `${glow.y.toFixed(2)}%`);
  }

  /* page progress bar */
  const maxScroll = document.documentElement.scrollHeight - innerHeight;
  smoothScroll = damp(smoothScroll, maxScroll > 0 ? scrollY / maxScroll : 0, 8, dt);
  el.progress.style.transform = `scaleX(${smoothScroll})`;

  updateServices(dt);
  hero.update(now / 1000, dt, smoothScroll);
  game?.update(now / 1000, dt);
}
requestAnimationFrame(frame);
