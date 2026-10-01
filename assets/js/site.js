import { Roster, World, Puppet, feedAt, anyPet, traitOf, TRAIT_LABEL, MOVE_LABEL } from './pets.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`perchies.${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`perchies.${key}`, JSON.stringify(value));
    } catch {}
  },
};

const themeBtn = $('[data-theme-toggle]');
const themeMeta = $('meta[name="theme-color"]');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeMeta?.setAttribute('content', theme === 'dark' ? '#150e28' : '#f4ecff');
  if (!themeBtn) return;
  themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  themeBtn.innerHTML = `<i class="ph-bold ph-${theme === 'dark' ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
}

applyTheme(document.documentElement.dataset.theme ?? 'light');
themeBtn?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  store.set('theme', next);
  applyTheme(next);
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (store.get('theme', null) == null) applyTheme(e.matches ? 'dark' : 'light');
});

const FAMILY_NAME = {
  bunny: 'Bunny', cat: 'Cat', penguin: 'Penguin', mushroom: 'Mushroom', monster: 'Monster',
  panda: 'Panda', bear: 'Bear', redpanda: 'Red panda', koala: 'Koala', chick: 'Chick',
  duckling: 'Duckling', pig: 'Pig', beaver: 'Beaver',
};
const FAMILY_TABS = {
  bunny: 'Bunnies', cat: 'Cats', penguin: 'Penguins', panda: 'Pandas', koala: 'Koalas',
  redpanda: 'Red pandas', bear: 'Bears', chick: 'Chicks', duckling: 'Ducklings', pig: 'Pigs',
  beaver: 'Beavers', monster: 'Monsters', mushroom: 'Mushrooms',
};

const reveal = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('in');
      reveal.unobserve(e.target);
    }
  }
}, { threshold: 0.12 });
$$('.reveal').forEach((el) => reveal.observe(el));

const roster = await Roster.load('assets/pets/');
const byFamily = roster.families();
const firstOf = (family) => byFamily.get(family)[0];
const anyOf = (family) => pick(byFamily.get(family));

/* Page squad */

const layer = document.createElement('div');
layer.className = 'pets-layer';
layer.setAttribute('aria-hidden', 'true');
document.body.append(layer);

const wide = () => innerWidth >= 1200;
const squadSize = () => {
  const forced = Number(document.body.dataset.squad);
  if (forced) return forced;
  return wide() ? 5 : innerWidth >= 760 ? 3 : 2;
};
const nav = $('.nav');
const page = new World(layer, roster, {
  fixed: true,
  root: document,
  perch: '[data-perch]',
  scale: innerWidth < 600 ? 0.4 : 0.52,
  top: nav ? nav.getBoundingClientRect().bottom : 0,
});

function randomSquad(n) {
  return shuffle([...byFamily.keys()]).slice(0, n).map((f) => anyOf(f).id);
}

let squad = store.get('squad', null);
if (!Array.isArray(squad) || !squad.every((id) => roster.byId.has(id))) squad = randomSquad(5);
let out = store.get('out', true);

function letOut() {
  out = true;
  store.set('out', true);
  const ids = squad.slice(-squadSize());
  ids.forEach((id, i) => setTimeout(() => page.add(roster.byId.get(id), 'drop'), 350 + i * 650));
  syncDock();
}

function callHome() {
  out = false;
  store.set('out', false);
  for (const p of [...page.pets]) page.remove(p);
  syncDock();
}

function addToSquad(c) {
  squad = [...squad.filter((id) => id !== c.id), c.id].slice(-5);
  store.set('squad', squad);
  if (!out) return letOut();
  const live = page.pets.filter((p) => !p.leaving);
  if (live.length >= squadSize()) page.remove(live[0]);
  const dupe = live.find((p) => p.c.id === c.id);
  if (dupe) page.remove(dupe);
  page.add(c, 'drop');
}

function newSquad() {
  squad = randomSquad(5);
  store.set('squad', squad);
  for (const p of [...page.pets]) page.remove(p);
  out = false;
  letOut();
}

/* Dock and treats */

const TREATS = ['cookie', 'cupcake', 'donut', 'icecream', 'pancakes', 'pizza', 'popcorn', 'watermelon', 'gummy', 'burger', 'fries', 'drumstick'];
const TREAT_NAME = {
  cookie: 'a cookie', cupcake: 'a cupcake', donut: 'a donut', icecream: 'ice cream', pancakes: 'pancakes', pizza: 'pizza',
  popcorn: 'popcorn', watermelon: 'watermelon', gummy: 'a gummy', burger: 'a burger', fries: 'fries', drumstick: 'a drumstick',
};

const dock = document.createElement('div');
dock.className = 'dock glass';
dock.setAttribute('data-perch', '');
dock.innerHTML = `
  <button type="button" data-treats aria-expanded="false" aria-controls="tray"><i class="ph-bold ph-cookie" aria-hidden="true"></i><span>Treats</span></button>
  <button type="button" data-home><i class="ph-bold ph-house" aria-hidden="true"></i><span>Call home</span></button>`;
document.body.append(dock);

const tray = document.createElement('div');
tray.className = 'tray glass';
tray.id = 'tray';
tray.innerHTML = `<p>Drag a treat onto any pet, or tap one to feed someone.</p>
  <div class="tray-grid">${TREATS.map((t) => `<button class="treat" type="button" data-treat="${t}" aria-label="Feed ${TREAT_NAME[t]}"><img src="assets/treats/${t}.png" alt=""></button>`).join('')}</div>`;
document.body.append(tray);
page.refreshPerches();

const treatsBtn = $('[data-treats]', dock);
const homeBtn = $('[data-home]', dock);

function syncDock() {
  homeBtn.innerHTML = out
    ? '<i class="ph-bold ph-house" aria-hidden="true"></i><span>Call home</span>'
    : '<i class="ph-bold ph-paw-print" aria-hidden="true"></i><span>Let them out</span>';
}

function setTray(open) {
  tray.classList.toggle('open', open);
  treatsBtn.setAttribute('aria-expanded', String(open));
}

treatsBtn.addEventListener('click', () => setTray(!tray.classList.contains('open')));
homeBtn.addEventListener('click', () => (out ? callHome() : letOut()));
$$('[data-open-treats]').forEach((b) => b.addEventListener('click', () => {
  if (!out) letOut();
  setTray(true);
}));
$$('[data-shuffle]').forEach((b) => b.addEventListener('click', newSquad));
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') setTray(false);
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tray, .dock, [data-open-treats], .pp-hit')) setTray(false);
});

function crumb(p, src) {
  const [hx, hy] = p.headAt(0.55);
  const img = document.createElement('img');
  img.className = 'crumb';
  img.src = src;
  img.alt = '';
  img.style.left = `${p.w.ox + hx - 20}px`;
  img.style.top = `${p.w.oy + hy - 20}px`;
  document.body.append(img);
  setTimeout(() => img.remove(), 750);
}

function feedSomeone(btn) {
  const src = $('img', btn).src;
  const tile = btn.closest('.tile');
  const local = tile && stageWorlds.get(tile);
  const p = (local?.pets[0]) ?? anyPet();
  if (!p) return;
  p.eat();
  crumb(p, src);
}

document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.treat');
  if (!btn || e.button > 0) return;
  e.preventDefault();
  const src = $('img', btn).src;
  const ghost = document.createElement('img');
  ghost.className = 'ghost-treat';
  ghost.src = src;
  ghost.alt = '';
  const startX = e.clientX;
  const startY = e.clientY;
  let dragging = false;
  const place = (x, y) => {
    ghost.style.transform = `translate3d(${x - 26}px,${y - 26}px,0)`;
  };
  const move = (ev) => {
    if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) {
      dragging = true;
      document.body.append(ghost);
    }
    if (dragging) place(ev.clientX, ev.clientY);
  };
  const up = (ev) => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    ghost.remove();
    if (!dragging) return feedSomeone(btn);
    const p = feedAt(ev.clientX, ev.clientY);
    if (p) crumb(p, src);
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.treat');
  if (btn && e.detail === 0) feedSomeone(btn);
});

syncDock();
if (out) letOut();

/* Characters */

const familiesEl = $('#families');
if (familiesEl) {
  const castPuppetHost = $('#cast-puppet');
  const sideA = $('#cast-a');
  const sideB = $('#cast-b');
  const moves = $('#cast-moves');
  let featured = null;
  let mainPuppet = null;
  const sidePuppets = [];

  for (const [family, label] of Object.entries(FAMILY_TABS)) {
    if (!byFamily.has(family)) continue;
    const b = document.createElement('button');
    b.className = 'family';
    b.type = 'button';
    b.textContent = label;
    b.dataset.family = family;
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => showFamily(family));
    familiesEl.append(b);
  }

  function feature(c) {
    featured = c;
    mainPuppet?.destroy();
    mainPuppet = new Puppet(roster, c, castPuppetHost, { height: innerWidth < 860 ? 150 : 190 });
    $('#cast-name').textContent = c.name;
    $('#cast-meta').textContent = `${FAMILY_NAME[c.family]}, ${TRAIT_LABEL[traitOf(c)]}`;
    moves.innerHTML = '';
    for (const anim of Object.keys(c.anims)) {
      const chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = MOVE_LABEL[anim] ?? anim;
      chip.setAttribute('aria-pressed', String(anim === 'idle'));
      chip.addEventListener('click', () => {
        $$('.chip', moves).forEach((x) => x.setAttribute('aria-pressed', 'false'));
        chip.setAttribute('aria-pressed', 'true');
        mainPuppet.play(anim);
      });
      moves.append(chip);
    }
    const rest = byFamily.get(c.family).filter((x) => x !== c);
    [sideA, sideB].forEach((side, i) => {
      sidePuppets[i]?.destroy();
      const other = rest[i];
      side.innerHTML = '<div class="puppet"></div><div><h3></h3><p class="cast-meta"></p></div>';
      $('h3', side).textContent = other.name;
      $('.cast-meta', side).textContent = 'Tap to meet';
      side.setAttribute('aria-label', `Meet ${other.name}`);
      sidePuppets[i] = new Puppet(roster, other, $('.puppet', side), { height: 92 });
      side.onclick = () => feature(other);
    });
    page.refreshPerches();
  }

  function showFamily(family) {
    $$('.family', familiesEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.family === family)));
    feature(firstOf(family));
  }

  $('#cast-out').addEventListener('click', () => {
    if (featured) addToSquad(featured);
  });

  showFamily(pick([...byFamily.keys()]));
}

/* Demo tiles */

const stageWorlds = new Map();

function stage(id, opts, cast) {
  const el = document.getElementById(id);
  if (!el) return;
  const host = el.parentElement;
  const world = new World(el, roster, {
    root: host,
    perch: '[data-stage]',
    ...opts,
    onFirstSeen: (w) => cast().forEach((c, i) => setTimeout(() => w.add(c, i === 0 && opts.place ? 'place' : 'drop'), 250 + i * 500)),
  });
  if (host.classList.contains('tile')) stageWorlds.set(host, world);
}

stage('phone-stage', { scale: 0.4, top: 34, floorPad: 70 }, () => [anyOf('bunny'), anyOf('cat'), anyOf('redpanda')]);
stage('stage-float', { scale: 0.42, top: 170, floorPad: 26, weights: { climb: 4, hopUp: 0.3 } }, () => [anyOf('redpanda'), anyOf('beaver'), anyOf('penguin')]);
stage('stage-feed', { scale: 0.5, top: 110, floorPad: 84, place: true, weights: { walk: 0.6 } }, () => [anyOf('koala')]);
stage('stage-nudge', { scale: 0.46, top: 100, floorPad: 8, weights: { say: 3, hopUp: 2 }, lines: ['Drink some water!', 'Stretch break?', 'Rest your eyes', 'Time for a walk'] }, () => [anyOf('chick')]);
stage('stage-squad', { scale: 0.42, top: 120, floorPad: 8, weights: { boop: 2, walk: 1.4 } }, () => [anyOf('monster'), anyOf('pig'), anyOf('duckling')]);
stage('stage-fling', { scale: 0.5, top: 60, floorPad: 8 }, () => [anyOf('bunny'), anyOf('mushroom')]);

addEventListener('resize', () => {
  page.top = nav ? nav.getBoundingClientRect().bottom : 0;
});
