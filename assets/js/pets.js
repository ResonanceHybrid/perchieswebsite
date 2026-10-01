const FPS = 12;
const COLS = 8;
const GRAVITY = 2100;
const FALLBACK = { fly: ['jump'], roll: ['walk'], stunned: ['idle'], hit: ['jump'], jump: ['idle'] };
const TRAITS = {
  bunny: 'hopper', chick: 'hopper', duckling: 'hopper',
  cat: 'napper', bear: 'napper', koala: 'napper', panda: 'napper', pig: 'napper',
  monster: 'brawler', redpanda: 'climber', beaver: 'climber',
};
export const TRAIT_LABEL = {
  wanderer: 'Wanderer', hopper: 'Hopper', climber: 'Climber', napper: 'Napper', brawler: 'Brawler',
};
export const MOVE_LABEL = {
  idle: 'Chill', walk: 'Stroll', jump: 'Hop', fly: 'Float', roll: 'Roll', stunned: 'Dizzy', hit: 'Boop',
};
export const traitOf = (c) => TRAITS[c.family] ?? 'wanderer';

export const modes = { vibe: 'playful', social: true, moonwalk: true, climb: true };
export const VIBES = {
  calm: {
    label: 'Calm', blurb: 'Quiet company. They wander, nap and never fight.',
    eventGap: [20, 40], brawl: 0, grudge: 0, greetGap: 40, chatty: 0.4,
    idle: 1.6, walk: 0.8, roll: 0.5, hop: 0.7, boop: 0, speed: 0.85,
  },
  playful: {
    label: 'Playful', blurb: 'Parades, games of tag and the odd scuffle.',
    eventGap: [8, 20], brawl: 1, grudge: 0.7, greetGap: 18, chatty: 1,
    idle: 1, walk: 1, roll: 1, hop: 1, boop: 1, speed: 1,
  },
  chaos: {
    label: 'Chaos', blurb: 'Brawls, chases and grudges. Never a dull second.',
    eventGap: [3, 8], brawl: 3, grudge: 1, greetGap: 8, chatty: 1.6,
    idle: 0.5, walk: 1.2, roll: 2, hop: 1.5, boop: 3, speed: 1.2,
  },
};
const vibe = () => VIBES[modes.vibe] ?? VIBES.playful;
const FX = { pop: { w: 96, h: 96, n: 12 }, poof: { w: 115, h: 112, n: 12 } };
const GREETS = [['hi!', 'hello!'], ['hey you', 'hehe'], ['nice hat', 'thanks!'], ['wanna play?', 'yes!'], ['move over', 'no, you'], ['snack?', 'yum']];

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const CHATTER = ['hi!', 'hmm', 'la la la', 'hello there', 'what a nice page', 'boop', 'snack time?', 'wheee'];
const POKED = ['hi!', 'hey!', 'hehe', 'that tickles', 'boop!'];
const YUM = ['yum!', 'nom nom', 'thanks!', 'so good'];

export class Roster {
  static async load(base) {
    const res = await fetch(`${base}pets.json`);
    return new Roster(await res.json(), base);
  }

  constructor(list, base) {
    this.list = list;
    this.base = base;
    this.byId = new Map(list.map((c) => [c.id, c]));
    this.loaded = new Map();
  }

  sheet(c, anim) {
    return `${this.base}${c.id}/${anim}.webp`;
  }

  anim(c, name) {
    for (const a of [name, ...(FALLBACK[name] ?? []), 'idle']) if (c.anims[a]) return a;
    return 'idle';
  }

  preload(c, anims = Object.keys(c.anims)) {
    return Promise.all(
      anims.map((a) => {
        const src = this.sheet(c, a);
        if (!this.loaded.has(src)) {
          const img = new Image();
          img.src = src;
          this.loaded.set(src, img.decode().catch(() => {}));
        }
        return this.loaded.get(src);
      }),
    );
  }

  families() {
    const out = new Map();
    for (const c of this.list) {
      if (!out.has(c.family)) out.set(c.family, []);
      out.get(c.family).push(c);
    }
    return out;
  }
}

export class Sprite {
  constructor(roster, c, scale) {
    this.roster = roster;
    this.c = c;
    this.scale = scale;
    this.el = document.createElement('div');
    this.el.className = 'pp';
    this.frameEl = document.createElement('div');
    this.frameEl.className = 'pp-frame';
    this.el.append(this.frameEl);
    this.anim = null;
    this.frame = -1;
  }

  show(name, frame) {
    const a = this.roster.anim(this.c, name);
    const sh = this.c.anims[a];
    const cols = Math.min(sh.n, COLS);
    if (a !== this.anim) {
      this.anim = a;
      this.frame = -1;
      Object.assign(this.frameEl.style, {
        width: `${sh.w}px`,
        height: `${sh.h}px`,
        left: `${sh.dx}px`,
        top: `${sh.dy}px`,
        backgroundImage: `url("${this.roster.sheet(this.c, a)}")`,
        backgroundSize: `${cols * sh.w}px ${Math.ceil(sh.n / cols) * sh.h}px`,
      });
    }
    const i = ((frame % sh.n) + sh.n) % sh.n;
    if (i !== this.frame) {
      this.frame = i;
      this.frameEl.style.backgroundPosition = `${-(i % cols) * sh.w}px ${-Math.floor(i / cols) * sh.h}px`;
    }
  }

  place(x, y, flip = false, angle = 0) {
    const s = this.scale;
    this.el.style.transform =
      `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${angle.toFixed(3)}rad) scale(${flip ? -s : s},${s})`;
  }
}

const worlds = new Set();
const puppets = new Set();
let clock = 0;
let last = 0;
let running = false;

function frame(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  clock += dt;
  for (const w of worlds) if (w.active) w.tick(dt);
  for (const p of puppets) if (p.visible) p.sprite.show(p.anim, reduced.matches ? 0 : Math.floor(clock * FPS));
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  requestAnimationFrame(frame);
}

const seen = new IntersectionObserver((entries) => {
  for (const e of entries) e.target._onSeen?.(e.isIntersecting);
}, { rootMargin: '120px' });

export class Puppet {
  constructor(roster, c, host, { height = 120, anim = 'idle' } = {}) {
    this.sprite = new Sprite(roster, c, height / c.bh);
    this.anim = anim;
    this.visible = false;
    this.sprite.el.style.transform = `scale(${this.sprite.scale})`;
    host.append(this.sprite.el);
    this.host = host;
    roster.preload(c, [roster.anim(c, anim)]);
    this.sprite.show(anim, 0);
    host._onSeen = (v) => { this.visible = v; };
    seen.observe(host);
    puppets.add(this);
    start();
  }

  play(anim) {
    this.anim = anim;
    this.sprite.roster.preload(this.sprite.c, [this.sprite.roster.anim(this.sprite.c, anim)]);
  }

  destroy() {
    puppets.delete(this);
    seen.unobserve(this.host);
    this.sprite.el.remove();
  }
}

export class World {
  constructor(layer, roster, opts = {}) {
    this.layer = layer;
    this.roster = roster;
    this.fixed = !!opts.fixed;
    this.scale = opts.scale ?? 0.5;
    this.top = opts.top ?? 0;
    this.floorPad = opts.floorPad ?? 4;
    this.root = opts.root ?? layer;
    this.perchSel = opts.perch ?? '[data-perch]';
    this.weights = opts.weights ?? {};
    this.lines = opts.lines ?? CHATTER;
    this.pets = [];
    this.event = null;
    this.eventIn = rand(4, 8);
    this.cool = new Map();
    this.grudges = new Map();
    this.clock = 0;
    this.active = this.fixed;
    this.refreshPerches();
    if (!this.fixed) {
      let first = opts.onFirstSeen;
      layer._onSeen = (v) => {
        this.active = v;
        if (v && first) {
          first(this);
          first = null;
        }
      };
      seen.observe(layer);
    }
    worlds.add(this);
    start();
  }

  refreshPerches() {
    this.perches = [...this.root.querySelectorAll(this.perchSel)];
  }

  measure() {
    if (this.fixed) {
      this.w = innerWidth;
      this.h = innerHeight;
      this.ox = 0;
      this.oy = 0;
    } else {
      const r = this.layer.getBoundingClientRect();
      this.w = r.width;
      this.h = r.height;
      this.ox = r.left;
      this.oy = r.top;
    }
    this.floor = this.h - this.floorPad;
    this.ledges = [];
    for (const el of this.perches) {
      const L = this.ledgeOf(el);
      if (L) this.ledges.push(L);
    }
  }

  ledgeOf(el) {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.isConnected) return null;
    const y = r.top - this.oy;
    const x1 = r.left - this.ox + 6;
    const x2 = r.right - this.ox - 6;
    if (x2 - x1 < 48 || x2 < 0 || x1 > this.w) return null;
    return { el, x1: Math.max(x1, 0), x2: Math.min(x2, this.w), y, raw: y };
  }

  usable(L) {
    return L && L.y > this.top + 40 && L.y < this.floor - 46;
  }

  tick(dt) {
    this.measure();
    this.clock += dt;
    for (const p of [...this.pets]) p.update(dt);
    if (!reduced.matches) this.life(dt);
  }

  ready(key) {
    return (this.cool.get(key) ?? 0) <= this.clock;
  }

  rest(key, seconds) {
    this.cool.set(key, this.clock + seconds);
  }

  fx(kind, x, y, scale = 0.35, tint = '#ffffff') {
    if (reduced.matches) return;
    const f = FX[kind];
    const el = document.createElement('div');
    el.className = 'pp-fx';
    el.style.cssText = `width:${f.w}px;height:${f.h}px;--sheet:url("${new URL(`../fx/${kind}.webp`, new URL(this.roster.base, location.href)).href}");--strip:${f.w * f.n}px;--h:${f.h}px;--tint:${tint};transform:translate3d(${(x - f.w / 2).toFixed(1)}px,${(y - f.h / 2).toFixed(1)}px,0) scale(${(scale * this.scale * 2).toFixed(3)})`;
    el.addEventListener('animationend', () => el.remove());
    this.layer.append(el);
  }

  free(floorOnly = true) {
    return shuffle(this.pets.filter((p) => !p.directed && p.grounded && (!floorOnly || p.surface.kind === 'floor')));
  }

  life(dt) {
    const live = this.pets.filter((p) => !p.leaving);
    this.bump(live);
    if (!modes.social || live.length < 2) {
      if (this.event && !(this.event instanceof Herald)) this.endEvent();
      if (this.event) this.direct(dt);
      return;
    }
    this.greet(live);
    this.direct(dt);
  }

  bump(live) {
    for (const a of live) {
      if (a.mode !== 'air' || Math.hypot(a.vx, a.vy) < 650) continue;
      for (const b of live) {
        if (a === b || !b.grounded || !this.ready(b)) continue;
        if (!overlaps(a.body(), b.body(), 4)) continue;
        const dir = a.vx === 0 ? (b.x < a.x ? -1 : 1) : Math.sign(a.vx);
        b.knock(a.vx * 0.5 + dir * 160, -360 - Math.random() * 260);
        b.say(pick(['oof', 'hey!', 'ouch']), 1.2);
        a.vx *= 0.6;
        a.vy *= 0.6;
        this.fx('pop', (a.x + b.x) / 2, (a.y - a.height / 2 + b.y - b.height / 2) / 2, 0.35);
        this.rest(b, 0.8);
        if (modes.social && Math.random() < vibe().grudge) this.grudges.set(b, { by: a, until: this.clock + 12 });
      }
    }
  }

  greet(live) {
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        if (a.directed || b.directed || !a.grounded || !b.grounded || !sameSurface(a, b)) continue;
        if (Math.abs(a.x - b.x) > (a.half + b.half) * 1.15) continue;
        const key = `${a.id}-${b.id}`;
        if (!this.ready(key)) continue;
        this.rest(key, vibe().greetGap * (1 + Math.random()));
        a.face(b.x);
        b.face(a.x);
        const [x, y] = pick(GREETS);
        a.say(x);
        setTimeout(() => b.say(y), 700);
        a.idleFor(1.4 + Math.random());
        if (Math.random() < 0.4) b.hopInPlace(260);
        else b.idleFor(1.6 + Math.random());
      }
    }
  }

  direct(dt) {
    const e = this.event;
    if (e) {
      e.t += dt;
      if (e.broken() || !e.tick(dt)) this.endEvent();
      return;
    }
    if (this.settle()) return;
    this.eventIn -= dt;
    if (this.eventIn > 0) return;
    this.eventIn = 3;
    const v = vibe();
    const hour = new Date().getHours();
    const brawlers = this.pets.some((p) => p.trait === 'brawler');
    const options = [
      ['parade', 3, Parade],
      ['tag', 3, Tag],
      ['brawl', Math.round((brawlers ? 5 : 2) * v.brawl), Brawl],
      ['leapfrog', 2, Leapfrog],
      ['nap', hour >= 22 || hour < 6 ? 5 : 1, NapPile],
      ['party', 2, Party],
    ].filter((o) => o[0] !== this.lastEvent && o[1] > 0);
    let roll = Math.random() * options.reduce((sum, o) => sum + o[1], 0);
    for (const [name, weight, Kind] of shuffle(options)) {
      if ((roll -= weight) > 0) continue;
      const ev = Kind.make(this);
      if (!ev) return;
      this.lastEvent = name;
      this.begin(ev);
      return;
    }
  }

  begin(ev) {
    this.event = ev;
    for (const p of ev.cast) p.directed = true;
    ev.start();
  }

  endEvent() {
    const e = this.event;
    if (!e) return;
    this.event = null;
    for (const p of e.cast) {
      p.directed = false;
      p.walkMul = 1;
    }
    e.end?.();
    const [lo, hi] = vibe().eventGap;
    this.eventIn = rand(lo, hi);
  }

  settle() {
    for (const [victim, g] of this.grudges) {
      if (g.until < this.clock || !this.pets.includes(victim) || !this.pets.includes(g.by)) {
        this.grudges.delete(victim);
        continue;
      }
      const culprit = g.by;
      if (![victim, culprit].every((p) => p.grounded && !p.directed && !p.leaving) || !sameSurface(victim, culprit)) continue;
      this.grudges.delete(victim);
      victim.say('you again!', 1.5);
      this.begin(new Brawl(this, [victim, culprit]));
      return true;
    }
    return false;
  }

  herald(text) {
    if (this.event instanceof Herald) this.endEvent();
    const p = this.free(false)[0] ?? this.pets.find((q) => q.grounded && !q.leaving);
    if (!p) return false;
    if (this.event) this.endEvent();
    this.begin(new Herald(this, [p], text));
    return true;
  }

  scatter() {
    for (const p of this.pets) {
      if (p.leaving || p.mode === 'held') continue;
      p.knock(rand(-900, 900), rand(-1500, -900));
      p.say(pick(['wheee', 'whoa!', 'aaah']), 1.2);
    }
  }

  async add(c, how = 'drop', at) {
    await this.roster.preload(c);
    const p = new Pet(this, c);
    this.pets.push(p);
    this.layer.append(p.sprite.el);
    this.measure();
    if (how === 'drop') {
      p.x = at ?? rand(p.half + 20, this.w - p.half - 20);
      p.y = this.top + p.height + rand(10, 60);
      p.vx = rand(-40, 40);
      p.vy = 60;
      p.chute = !!c.anims.fly;
      p.mode = 'air';
    } else {
      p.x = at ?? rand(p.half, this.w - p.half);
      p.y = this.floor;
      p.mode = 'idle';
      p.timer = rand(0.3, 2);
    }
    p.update(0);
    return p;
  }

  remove(p, walkOff = true) {
    if (!walkOff || reduced.matches) return p.destroy();
    p.leave();
  }

  petAt(clientX, clientY, pad = 18) {
    const x = clientX - this.ox;
    const y = clientY - this.oy;
    let best = null;
    for (const p of this.pets) {
      if (p.leaving) continue;
      const [hx, hy] = p.headAt(0.5);
      const d = Math.hypot(hx - x, hy - y);
      if (d < p.height * 0.6 + pad && (!best || d < best.d)) best = { p, d };
    }
    return best?.p ?? null;
  }
}

function shuffle(list) {
  return list.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
}

function overlaps(a, b, inset = 0) {
  return a.l < b.r - inset && a.r > b.l + inset && a.t < b.b - inset && a.b > b.t + inset;
}

function sameSurface(a, b) {
  return a.surface.kind === b.surface.kind && (a.surface.kind === 'floor' || a.surface.el === b.surface.el);
}

class Event {
  constructor(world, cast) {
    this.w = world;
    this.cast = cast;
    this.t = 0;
  }

  broken() {
    return this.cast.some((p) => p.mode === 'held' || p.leaving || !this.w.pets.includes(p));
  }
}

class Parade extends Event {
  static make(w) {
    const f = w.free();
    return f.length < 2 ? null : new Parade(w, f);
  }

  get leader() { return this.cast[0]; }

  march() {
    const l = this.leader;
    l.walkTo(l.x < this.w.w / 2 ? this.w.w - l.half * 2 : l.half * 2, 0.9);
  }

  start() {
    this.legs = 0;
    this.gap = Math.max(...this.cast.map((p) => p.half * 2)) * 0.9;
    this.leader.say(pick(['parade!', 'follow me', 'march!']), 3);
    this.march();
  }

  tick() {
    const l = this.leader;
    if (l.mode === 'idle' && l.t > 0.6) {
      if (++this.legs >= 2) return false;
      this.march();
      l.say('about turn!', 1.2);
    }
    const behind = l.facing > 0 ? -1 : 1;
    this.cast.slice(1).forEach((p, i) => {
      const x = l.x + behind * this.gap * (i + 1);
      if (Math.abs(p.x - x) > 6) p.walkTo(x, 1.35);
      else if (p.mode === 'idle') p.facing = l.facing;
    });
    return this.t < 22;
  }
}

class Tag extends Event {
  static make(w) {
    const f = w.free(false);
    for (const a of f) {
      for (const b of f) {
        if (a !== b && sameSurface(a, b) && a.span() > a.half * 10) return new Tag(w, [a, b]);
      }
    }
    return null;
  }

  start() {
    this.caughtAt = -1;
    this.cast[0].say(pick(['tag!', "you're it!", 'gotcha soon']), 2);
    this.cast[1].say(pick(['eek!', 'nope!', 'run!']), 2);
  }

  tick() {
    const [chaser, runner] = this.cast;
    if (this.caughtAt >= 0) return this.t - this.caughtAt < 1.6;
    if (!runner.grounded || !chaser.grounded) return this.t < 11;
    const b = runner.bounds();
    if (!b) return false;
    const away = runner.x >= chaser.x ? 1 : -1;
    const edge = away > 0 ? b.max : b.min;
    const gap = Math.abs(runner.x - chaser.x);
    if (Math.abs(runner.x - edge) < 12 && gap < 110) {
      runner.leapTo(clamp(chaser.x - away * 110, b.min, b.max), chaser.height + 30);
      runner.say('hup!', 1);
    } else {
      runner.walkTo(edge, 1.55);
    }
    chaser.walkTo(runner.x, 1.85);
    if (gap < (chaser.half + runner.half) * 0.8) {
      chaser.boop();
      chaser.say("you're it!", 1.5);
      runner.knock(away * 320, -420);
      runner.say('oof', 1.5);
      this.caughtAt = this.t;
    }
    if (this.t > 11) {
      chaser.say('phew', 1.5);
      return false;
    }
    return true;
  }
}

class Brawl extends Event {
  static make(w) {
    const f = w.free(false).sort((a, b) => (b.trait === 'brawler') - (a.trait === 'brawler'));
    for (const a of f) for (const b of f) if (a !== b && sameSurface(a, b)) return new Brawl(w, [a, b]);
    return null;
  }

  start() {
    this.clashAt = -1;
    this.doneAt = -1;
    this.beat = 0;
    this.cast[0].say(pick(['hey!', 'grr', 'come here']), 2);
    this.cast[1].say(pick(['oh yeah?', 'bring it', 'hmph']), 2);
  }

  tick(dt) {
    if (this.doneAt >= 0) return this.aftermath();
    const [a, b] = this.cast;
    const mid = (a.x + b.x) / 2;
    if (this.clashAt < 0) {
      if (Math.abs(a.x - b.x) > a.half + b.half) {
        a.walkTo(mid, 1.3);
        b.walkTo(mid, 1.3);
      } else if (a.grounded && b.grounded) {
        this.clashAt = this.t;
        this.clashFor = 1.4 + Math.random() * 1.2;
      }
      return this.t < 10;
    }
    this.beat -= dt;
    if (this.beat <= 0) {
      this.beat = 0.3;
      a.face(b.x);
      b.face(a.x);
      for (const p of this.cast) {
        if (!p.grounded) continue;
        if (Math.random() < 0.5) p.boop();
        else p.hopInPlace(160 + Math.random() * 120);
        if (Math.random() < 0.35) p.say(pick(['pow!', 'grr', 'take that', 'hey!']), 0.6);
      }
      this.w.fx('pop', mid + rand(-20, 20), a.y - a.height * rand(0.3, 0.7), 0.4);
    }
    if (this.t - this.clashAt < this.clashFor) return true;
    const odds = (a.trait === 'brawler' ? 0.65 : 0.5) - (b.trait === 'brawler' ? 0.15 : 0);
    const win = Math.random() < odds ? a : b;
    const lose = win === a ? b : a;
    const dir = lose.x >= win.x ? 1 : -1;
    lose.knock(dir * (480 + Math.random() * 320), -520);
    lose.say(pick(['ow!', 'no fair', 'oof']), 1.6);
    win.say(pick(['ha!', 'too easy', 'champion']), 2);
    win.hopInPlace(320);
    this.w.fx('poof', lose.x, lose.y - lose.height / 2, 0.4, '#ffd27a');
    this.win = win;
    this.doneAt = this.t;
    const ally = this.w.free(false).find((p) => p.c.family === lose.c.family && sameSurface(p, win));
    if (ally && Math.random() < 0.45) {
      this.avenger = ally;
      ally.directed = true;
      this.cast.push(ally);
      ally.say(pick(['you!', 'leave them alone', 'my turn']), 2);
    }
    return true;
  }

  aftermath() {
    const av = this.avenger;
    const w = this.win;
    if (!av) return this.t - this.doneAt < 2;
    if (!av.grounded) return this.t - this.doneAt < 6;
    if (Math.abs(av.x - w.x) > av.half + w.half) {
      if (w.grounded) av.walkTo(w.x, 1.9);
      return this.t - this.doneAt < 7;
    }
    av.boop();
    av.say('take that', 1.2);
    w.knock((w.x >= av.x ? 1 : -1) * 520, -480);
    w.say('ow!', 1.5);
    this.w.fx('pop', (av.x + w.x) / 2, w.y - w.height / 2, 0.4);
    this.avenger = null;
    return true;
  }
}

class Leapfrog extends Event {
  static make(w) {
    const f = w.free(false).sort((a, b) => (b.trait === 'hopper') - (a.trait === 'hopper'));
    for (const a of f) for (const b of f) if (a !== b && sameSurface(a, b) && a.c.anims.jump) return new Leapfrog(w, [a, b]);
    return null;
  }

  start() {
    this.jumped = false;
    this.cast[1].idleFor(99);
    this.cast[1].say('uh oh', 2);
  }

  tick() {
    const [frog, post] = this.cast;
    if (this.jumped) return frog.mode === 'hop' || frog.t < 0.3 ? this.t < 8 : false;
    const dir = post.x >= frog.x ? 1 : -1;
    if (Math.abs(post.x - frog.x) > post.half + frog.half + 40) {
      frog.walkTo(post.x - dir * (post.half + frog.half + 30), 1.4);
      return this.t < 10;
    }
    if (!frog.grounded) return true;
    const b = frog.bounds();
    if (!b) return false;
    frog.leapTo(clamp(post.x + dir * (post.half + frog.half + 30), b.min, b.max), post.height + 40);
    frog.say(pick(['hup!', 'leapfrog!', 'wheee']), 1.4);
    this.jumped = true;
    return true;
  }
}

class NapPile extends Event {
  static make(w) {
    const f = w.free();
    return f.length < 2 ? null : new NapPile(w, f);
  }

  start() {
    this.spot = this.cast[0].x;
    this.sleptAt = -1;
    this.cast[0].say('*yawn*', 2);
  }

  tick() {
    if (this.sleptAt >= 0) return this.t - this.sleptAt < 9;
    let all = true;
    this.cast.forEach((p, i) => {
      const x = this.spot + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * p.half * 1.3;
      if (Math.abs(p.x - x) > 6) {
        all = false;
        if (p.grounded) p.walkTo(x, 0.8);
      }
    });
    if (all || this.t > 9) {
      this.sleptAt = this.t;
      for (const p of this.cast) {
        p.face(this.spot);
        p.idleFor(99);
      }
      this.cast[0].say('zzz', 9);
    }
    return true;
  }
}

class Party extends Event {
  static make(w) {
    const f = w.free(false);
    return f.length < 2 ? null : new Party(w, f);
  }

  start() {
    this.beat = 0;
    this.until = 6 + Math.random();
    this.cast[0].say(pick(['party!', 'dance time', 'music!']), 2.5);
  }

  tick(dt) {
    this.beat -= dt;
    if (this.beat <= 0) {
      this.beat = 0.9 + Math.random() * 0.6;
      for (const p of this.cast) if (p.grounded && Math.random() < 0.7) p.dance();
    }
    return this.t < this.until;
  }
}

class Herald extends Event {
  constructor(world, cast, text) {
    super(world, cast);
    this.text = text;
  }

  start() {
    const p = this.cast[0];
    this.beat = 0;
    p.note(this.text, () => this.w.event === this && this.w.endEvent());
    p.walkTo(this.w.w / 2, 1.4);
  }

  tick(dt) {
    const p = this.cast[0];
    this.beat -= dt;
    if (p.mode === 'idle' && this.beat <= 0) {
      this.beat = 1.6;
      p.hopInPlace(300);
    }
    if (this.t > 30) {
      p.hush();
      return false;
    }
    return !!p.bubble;
  }
}

export function feedAt(clientX, clientY) {
  for (const w of worlds) {
    if (!w.active) continue;
    const p = w.petAt(clientX, clientY);
    if (p) {
      p.eat();
      return p;
    }
  }
  return null;
}

export function anyPet() {
  const all = [...worlds].filter((w) => w.active).flatMap((w) => w.pets.filter((p) => !p.leaving));
  return all.length ? pick(all) : null;
}

let nextId = 1;

class Pet {
  constructor(world, c) {
    this.id = nextId++;
    this.directed = false;
    this.walkMul = 1;
    this.w = world;
    this.c = c;
    this.sprite = new Sprite(world.roster, c, world.scale);
    this.trait = traitOf(c);
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.mode = 'idle';
    this.t = 0;
    this.timer = rand(0.5, 2);
    this.surface = { kind: 'floor' };
    this.angle = 0;
    this.chute = false;
    this.goal = null;
    this.saidAt = -99;

    const hit = document.createElement('div');
    hit.className = 'pp-hit';
    Object.assign(hit.style, {
      left: `${-c.bw / 2}px`,
      top: `${-c.bh}px`,
      width: `${c.bw}px`,
      height: `${c.bh}px`,
    });
    hit.setAttribute('aria-hidden', 'true');
    this.sprite.el.append(hit);
    this.hit = hit;
    hit.addEventListener('pointerdown', (e) => this.grab(e));
    hit.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && clock - this.saidAt > 8) this.say(`I'm ${c.name}`);
    });
  }

  get s() { return this.w.scale; }
  get half() { return (this.c.bw * this.s) / 2; }
  get height() { return this.c.bh * this.s; }
  get speed() { return 80 * this.s * (this.trait === 'napper' ? 0.8 : 1) * vibe().speed; }
  get grounded() { return !this.leaving && ['idle', 'walk', 'roll', 'stun', 'boop'].includes(this.mode); }

  body() {
    return { l: this.x - this.half, r: this.x + this.half, t: this.y - this.height, b: this.y };
  }

  span() {
    const b = this.bounds();
    return b ? b.max - b.min : 0;
  }

  face(x) {
    if (x !== this.x) this.facing = Math.sign(x - this.x);
  }

  idleFor(seconds) {
    if (!this.grounded) return;
    this.mode = 'idle';
    this.goal = null;
    this.timer = seconds;
  }

  walkTo(x, mul = 1) {
    if (!this.grounded || this.mode === 'stun') return;
    if (this.mode !== 'walk') this.t = 0;
    this.mode = 'walk';
    this.goal = null;
    this.moon = false;
    this.tx = x;
    this.walkMul = mul;
  }

  hopInPlace(v) {
    if (!this.grounded) return;
    this.angle = 0;
    this.mode = 'air';
    this.t = 0;
    this.vx = 0;
    this.vy = -v * this.s * 2;
    this.flung = false;
  }

  knock(vx, vy) {
    if (this.mode === 'held' || this.leaving) return;
    this.angle = 0;
    this.chute = false;
    this.mode = 'air';
    this.t = 0;
    this.vx = vx * this.s * 2;
    this.vy = vy * this.s * 2;
    this.flung = true;
  }

  boop() {
    if (!this.grounded) return;
    this.t = 0;
    if (this.c.anims.hit) {
      this.mode = 'boop';
      this.timer = 0.6;
    } else {
      this.hopInPlace(200);
    }
  }

  dance() {
    this.facing = -this.facing;
    this.hopInPlace(180 + Math.random() * 120);
  }

  leapTo(tx, apex) {
    if (!this.grounded) return;
    const L = this.surface.kind === 'ledge' ? this.w.ledgeOf(this.surface.el) : null;
    this.hopTo(L, tx);
    this.hopArc = apex;
  }

  note(text, onDone) {
    this.say(text, 30, true);
    this.bubble.classList.add('note');
    this.bubble.onclick = () => {
      this.hush();
      this.say(pick(['nice!', 'good job', 'yay']), 1.4);
      onDone?.();
    };
  }

  headAt(f = 1) {
    const h = this.height * f;
    return [this.x + Math.sin(this.angle) * h, this.y - Math.cos(this.angle) * h];
  }

  update(dt) {
    this.t += dt;
    const handler = {
      air: this.air, hop: this.hopStep, climb: this.climbStep, hang: this.hangStep, held: null,
    }[this.mode];
    if (handler) handler.call(this, dt);
    else if (this.mode !== 'held') this.ground(dt);
    this.draw();
  }

  anim() {
    switch (this.mode) {
      case 'walk': case 'climb': case 'leave': return 'walk';
      case 'hop': case 'held': return 'jump';
      case 'air': return this.chute ? 'fly' : 'jump';
      case 'roll': return 'roll';
      case 'stun': return 'stunned';
      case 'boop': return 'hit';
      default: return 'idle';
    }
  }

  draw() {
    const frame = reduced.matches && this.mode === 'idle' ? 0 : Math.floor(this.t * FPS);
    this.sprite.show(this.anim(), frame);
    this.sprite.place(this.x, this.y, this.facing < 0, this.angle);
    if (this.bubble) {
      const [hx, hy] = this.headAt();
      this.bubble.style.transform = `translate3d(${hx.toFixed(1)}px,${(hy - 8).toFixed(1)}px,0) translate(-50%,-100%)`;
      if (clock > this.bubbleUntil) this.hush();
    }
  }

  say(text, seconds = 1.8, force = false) {
    if (this.bubble?.classList.contains('note') && !force) return;
    this.saidAt = clock;
    for (const p of this.w.pets) {
      if (p !== this && p.bubble && !p.bubble.classList.contains('note')) p.hush();
    }
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'pp-bubble';
      this.w.layer.append(this.bubble);
    }
    this.bubble.textContent = text;
    this.bubble.classList.remove('note');
    this.bubble.onclick = null;
    this.bubbleUntil = clock + seconds;
  }

  hush() {
    this.bubble?.remove();
    this.bubble = null;
  }

  destroy() {
    this.hush();
    this.sprite.el.remove();
    this.w.pets = this.w.pets.filter((p) => p !== this);
  }

  bounds() {
    const s = this.surface;
    if (s.kind === 'ledge') {
      const L = this.w.ledgeOf(s.el);
      if (!L) return null;
      return { L, min: L.x1 + this.half * 0.5, max: L.x2 - this.half * 0.5, y: L.y };
    }
    return { min: this.half, max: this.w.w - this.half, y: this.w.floor };
  }

  ground(dt) {
    const b = this.bounds();
    if (this.surface.kind === 'ledge') {
      if (!b || b.L.y > this.w.floor - 20) return this.land({ kind: 'floor' });
      if (b.L.y < this.w.top + 20) return this.drop(0);
      this.y = b.y;
      this.x = b.L.x1 + this.surface.off;
    } else {
      this.y = b.y;
    }

    switch (this.mode) {
      case 'walk': case 'leave': {
        const target = this.mode === 'leave' ? this.exitX : this.tx;
        const dx = target - this.x;
        const step = this.speed * (this.mode === 'leave' ? 2.4 : this.walkMul * (this.moon ? 0.8 : 1)) * dt;
        if (this.mode === 'leave' && this.t - this.leftAt > 1.4 && !this.fading) {
          this.fading = true;
          this.sprite.el.classList.add('gone');
          this.hush();
          setTimeout(() => this.destroy(), 450);
        }
        this.facing = (this.moon ? -Math.sign(dx) : Math.sign(dx)) || this.facing;
        if (Math.abs(dx) <= step) {
          this.x = target;
          if (this.mode === 'leave') return this.destroy();
          if (this.goal === 'climb') return this.startClimb();
          this.rest();
        } else {
          this.x += Math.sign(dx) * step;
        }
        break;
      }
      case 'roll': {
        this.x += this.vx * dt;
        this.vx *= Math.max(0, 1 - 2.2 * dt);
        if (this.surface.kind === 'ledge' && (this.x < b.min - this.half * 0.4 || this.x > b.max + this.half * 0.4)) {
          return this.drop(this.vx);
        }
        if (this.x < this.half || this.x > this.w.w - this.half) {
          this.x = clamp(this.x, this.half, this.w.w - this.half);
          this.vx = -this.vx * 0.5;
        }
        if (Math.abs(this.vx) < 40) this.rest();
        break;
      }
      default:
        this.timer -= dt;
        if (this.timer <= 0) {
          if (!this.directed) this.think();
          else if (this.mode !== 'idle') this.idleFor(0.5);
        }
    }
    if (this.mode !== 'leave' && this.mode !== 'roll') this.x = clamp(this.x, b.min, Math.max(b.min, b.max));
    if (this.surface.kind === 'ledge') this.surface.off = this.x - b.L.x1;
  }

  rest(seconds = rand(1.2, 3.5)) {
    this.mode = 'idle';
    this.goal = null;
    this.moon = false;
    this.walkMul = 1;
    this.timer = seconds;
  }

  think() {
    if (reduced.matches) return this.rest(5);
    const b = this.bounds();
    const onLedge = this.surface.kind === 'ledge';
    const canHop = !!this.c.anims.jump;
    const W = {
      idle: 3, walk: 5, hopUp: canHop ? 2 : 0, hopDown: onLedge ? 1.6 : 0,
      climb: onLedge ? 0 : 0.7, roll: this.c.anims.roll ? 0.5 : 0, say: 0.5, boop: 0,
    };
    if (this.trait === 'hopper') { W.hopUp *= 2.2; W.hopDown *= 1.5; }
    if (this.trait === 'napper') W.idle *= 2.4;
    if (this.trait === 'climber') { W.climb *= 3.5; W.hopUp *= 1.4; }
    if (this.trait === 'wanderer') W.walk *= 1.5;
    if (this.trait === 'brawler') { W.walk *= 1.4; W.boop = this.c.anims.hit ? 1.2 : 0; W.hopDown = onLedge ? 1.2 : 0; }
    for (const [k, v] of Object.entries(this.w.weights)) if (k in W) W[k] *= v;
    const v = vibe();
    W.idle *= v.idle;
    W.walk *= v.walk;
    W.roll *= v.roll;
    W.hopUp *= v.hop;
    W.boop *= v.boop;
    W.say *= v.chatty;
    if (!modes.climb) W.climb = 0;

    let r = Math.random() * Object.values(W).reduce((a, v) => a + v, 0);
    let act = 'idle';
    for (const [k, v] of Object.entries(W)) {
      if ((r -= v) <= 0) { act = k; break; }
    }

    switch (act) {
      case 'walk': {
        if (b.max - b.min < 40) return this.rest(1);
        let tx = rand(b.min, b.max);
        if (Math.abs(tx - this.x) < 50) tx = clamp(this.x + (Math.random() < 0.5 ? -1 : 1) * rand(60, 200), b.min, b.max);
        this.tx = tx;
        this.mode = 'walk';
        this.moon = modes.moonwalk && Math.random() < 0.1;
        if (this.moon) this.say(pick(['smooth', 'watch this', 'hee hee']), 1.6);
        return;
      }
      case 'hopUp': return this.hopUp() || this.rest(1);
      case 'hopDown': return this.hopDown() || this.rest(1);
      case 'climb': {
        const side = this.x < this.w.w / 2 ? -1 : 1;
        this.goal = 'climb';
        this.climbSide = side;
        this.tx = side < 0 ? this.half : this.w.w - this.half;
        this.mode = 'walk';
        return;
      }
      case 'roll':
        this.vx = this.facing * rand(200, 300);
        this.mode = 'roll';
        return;
      case 'say':
        this.say(pick(this.w.lines), 2.4);
        return this.rest(2.5);
      case 'boop':
        this.mode = 'boop';
        this.t = 0;
        this.timer = 1;
        return;
      default:
        if (this.trait === 'napper' && Math.random() < 0.45) {
          this.say('zzz', 3);
          return this.rest(rand(5, 9));
        }
        return this.rest();
    }
  }

  hopUp() {
    const options = this.w.ledges.filter((L) => this.w.usable(L) && L.y < this.y - 36 && L.y > this.y - 440
      && L.x2 > this.x - 380 && L.x1 < this.x + 380 && L.x2 - L.x1 > this.half * 2 && L.el !== this.surface.el);
    if (!options.length) return false;
    const L = pick(options);
    this.hopTo(L, clamp(this.x + rand(-160, 160), L.x1 + this.half, L.x2 - this.half));
    return true;
  }

  hopDown() {
    const lower = this.w.ledges.filter((L) => this.w.usable(L) && L.y > this.y + 36
      && L.x2 > this.x - 300 && L.x1 < this.x + 300 && L.x2 - L.x1 > this.half * 2);
    if (lower.length && Math.random() < 0.5) {
      const L = pick(lower);
      this.hopTo(L, clamp(this.x + rand(-140, 140), L.x1 + this.half, L.x2 - this.half));
    } else {
      this.hopTo(null, clamp(this.x + rand(-220, 220), this.half, this.w.w - this.half));
    }
    return true;
  }

  hopTo(L, tx) {
    this.mode = 'hop';
    this.t = 0;
    this.from = { x: this.x, y: this.y };
    this.hopLedge = L?.el ?? null;
    this.hopOff = L ? tx - L.x1 : tx;
    const ty = L ? L.y : this.w.floor;
    const dist = Math.hypot(tx - this.x, ty - this.y);
    this.hopDur = 0.45 + dist / 1300;
    this.hopArc = 50 + Math.max(0, this.y - ty) * 0.2;
    this.facing = Math.sign(tx - this.x) || this.facing;
  }

  hopStep() {
    let tx = this.hopOff;
    let ty = this.w.floor;
    if (this.hopLedge) {
      const L = this.w.ledgeOf(this.hopLedge);
      if (!L || !this.w.usable(L)) return this.drop(this.facing * 60);
      tx = L.x1 + this.hopOff;
      ty = L.y;
    }
    const u = Math.min(1, this.t / this.hopDur);
    this.x = this.from.x + (tx - this.from.x) * u;
    this.y = this.from.y + (ty - this.from.y) * u - this.hopArc * 4 * u * (1 - u);
    if (u >= 1) this.land(this.hopLedge ? { kind: 'ledge', el: this.hopLedge } : { kind: 'floor' });
  }

  startClimb() {
    this.goal = null;
    this.mode = 'climb';
    this.surface = { kind: 'wall', side: this.climbSide };
    this.x = this.climbSide < 0 ? 0 : this.w.w;
    this.angle = this.climbSide < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.facing = this.climbSide < 0 ? -1 : 1;
    this.ty = Math.max(this.w.top + this.height + 30, this.w.floor - rand(0.3, 0.65) * this.w.h);
  }

  climbStep(dt) {
    this.x = this.climbSide < 0 ? 0 : this.w.w;
    this.y -= this.speed * 0.8 * dt;
    if (this.y <= this.ty) {
      this.mode = 'hang';
      this.timer = rand(1.5, 3.5);
      if (Math.random() < 0.4) this.say(pick(['look at me', 'up here!', 'nice view']), 2);
    }
  }

  hangStep(dt) {
    this.x = this.climbSide < 0 ? 0 : this.w.w;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.angle = 0;
      this.x = this.climbSide < 0 ? this.half : this.w.w - this.half;
      this.facing = -this.climbSide;
      this.mode = 'air';
      this.vx = -this.climbSide * rand(80, 160);
      this.vy = -120;
      this.flung = false;
    }
  }

  drop(vx) {
    this.mode = 'air';
    this.vx = vx;
    this.vy = -60;
    this.angle = 0;
    this.flung = false;
  }

  air(dt) {
    const prevY = this.y;
    this.vy += GRAVITY * dt;
    if (!this.chute && this.c.anims.fly && this.vy > 250 && this.w.floor - this.y > 220) this.chute = true;
    if (this.chute) {
      this.vy = Math.min(this.vy, 150);
      this.vx *= Math.max(0, 1 - 1.5 * dt);
      this.angle = Math.sin(this.t * 2.2) * 0.1;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < this.half || this.x > this.w.w - this.half) {
      if (Math.abs(this.vx) > 700) this.hard = true;
      this.x = clamp(this.x, this.half, this.w.w - this.half);
      this.vx = -this.vx * 0.45;
      this.facing = Math.sign(this.vx) || this.facing;
    }
    if (this.y - this.height < this.w.top) {
      this.y = this.w.top + this.height;
      this.vy = Math.abs(this.vy) * 0.3;
    }
    if (this.vy > 0) {
      for (const L of this.leaving ? [] : this.w.ledges) {
        if (this.w.usable(L) && prevY <= L.y && this.y >= L.y && this.x >= L.x1 && this.x <= L.x2) {
          return this.land({ kind: 'ledge', el: L.el }, this.vy);
        }
      }
      if (this.y >= this.w.floor) return this.land({ kind: 'floor' }, this.vy);
    }
  }

  land(surface, impact = 0) {
    const L = surface.kind === 'ledge' ? this.w.ledgeOf(surface.el) : null;
    this.surface = L ? { kind: 'ledge', el: surface.el, off: clamp(this.x, L.x1, L.x2) - L.x1 } : { kind: 'floor' };
    this.y = L ? L.y : this.w.floor;
    this.angle = 0;
    this.chute = false;
    this.t = 0;
    if (this.leaving) return L ? this.drop(0) : this.walkOff();
    if (impact > 1500 || this.hard) {
      this.hard = false;
      this.mode = 'stun';
      this.timer = 1.4;
      this.say(pick(['oof', 'ouch', 'whoa']), 1.4);
    } else if (this.flung && Math.abs(this.vx) > 260 && this.c.anims.roll) {
      this.mode = 'roll';
    } else {
      this.rest(rand(0.6, 1.6));
    }
    this.flung = false;
  }

  grab(e) {
    if (this.mode === 'leave') return;
    e.preventDefault();
    this.hit.setPointerCapture(e.pointerId);
    this.hit.classList.add('held');
    const start = { x: e.clientX, y: e.clientY, at: performance.now() };
    const dx = this.x - (e.clientX - this.w.ox);
    const dy = this.y - (e.clientY - this.w.oy);
    const samples = [];
    let moved = false;
    const prevMode = this.mode;
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return;
      if (!moved) {
        moved = true;
        this.mode = 'held';
        this.angle = 0;
        this.chute = false;
        this.say(pick(['whoa!', 'wheee', 'put me down!', 'hehe']), 1.2);
      }
      this.x = clamp(ev.clientX - this.w.ox + dx, this.half, this.w.w - this.half);
      this.y = clamp(ev.clientY - this.w.oy + dy, this.w.top + this.height, this.w.floor);
      samples.push({ t: performance.now(), x: this.x, y: this.y });
      while (samples.length > 2 && samples[0].t < samples.at(-1).t - 100) samples.shift();
    };
    const up = () => {
      this.hit.removeEventListener('pointermove', move);
      this.hit.removeEventListener('pointerup', up);
      this.hit.removeEventListener('pointercancel', up);
      this.hit.classList.remove('held');
      if (!moved) return this.poke(prevMode);
      const a = samples[0];
      const z = samples.at(-1);
      const span = a && z && z.t > a.t ? (z.t - a.t) / 1000 : 1;
      this.vx = a ? clamp((z.x - a.x) / span, -2600, 2600) : 0;
      this.vy = a ? clamp((z.y - a.y) / span, -2600, 2600) : 0;
      this.flung = Math.hypot(this.vx, this.vy) > 500;
      this.mode = 'air';
      this.t = 0;
    };
    this.hit.addEventListener('pointermove', move);
    this.hit.addEventListener('pointerup', up);
    this.hit.addEventListener('pointercancel', up);
  }

  poke(prevMode) {
    if (prevMode === 'climb' || prevMode === 'hang' || prevMode === 'air' || prevMode === 'hop') return;
    this.say(pick(POKED), 1.4);
    this.t = 0;
    if (this.c.anims.hit) {
      this.mode = 'boop';
      this.timer = 0.9;
    } else {
      this.mode = 'air';
      this.vx = 0;
      this.vy = -420;
      this.flung = false;
    }
  }

  eat() {
    if (this.mode === 'leave') return;
    this.say(pick(YUM), 1.8);
    if (this.mode === 'climb' || this.mode === 'hang' || this.mode === 'held') return;
    this.angle = 0;
    this.mode = 'air';
    this.t = 0;
    this.vx = 0;
    this.vy = -460;
    this.flung = false;
    this.chute = false;
  }

  leave() {
    if (this.leaving) return;
    this.leaving = true;
    this.say(pick(['bye!', 'see you', 'home time']), 1.6);
    const grounded = ['idle', 'walk', 'roll', 'stun', 'boop'].includes(this.mode);
    if (grounded && this.surface.kind === 'floor') return this.walkOff();
    if (this.mode === 'climb') this.mode = 'hang';
    if (this.mode === 'hang') this.timer = 0;
    else if (grounded) this.drop(0);
  }

  walkOff() {
    this.surface = { kind: 'floor' };
    this.angle = 0;
    this.exitX = this.x < this.w.w / 2 ? -this.half * 2 : this.w.w + this.half * 2;
    this.mode = 'leave';
    this.leftAt = this.t;
  }
}
