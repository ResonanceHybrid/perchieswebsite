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
    for (const p of [...this.pets]) p.update(dt);
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

class Pet {
  constructor(world, c) {
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
  get speed() { return 80 * this.s * (this.trait === 'napper' ? 0.8 : 1); }

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
      if (this.t > this.bubbleUntil) this.hush();
    }
  }

  say(text, seconds = 1.8) {
    this.saidAt = clock;
    if (!this.bubble) {
      this.bubble = document.createElement('div');
      this.bubble.className = 'pp-bubble';
      this.w.layer.append(this.bubble);
    }
    this.bubble.textContent = text;
    this.bubbleUntil = this.t + seconds;
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
        const step = this.speed * (this.mode === 'leave' ? 2.4 : 1) * dt;
        if (this.mode === 'leave' && this.t - this.leftAt > 1.4 && !this.fading) {
          this.fading = true;
          this.sprite.el.classList.add('gone');
          this.hush();
          setTimeout(() => this.destroy(), 450);
        }
        this.facing = Math.sign(dx) || this.facing;
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
        if (this.timer <= 0) this.think();
    }
    if (this.mode !== 'leave' && this.mode !== 'roll') this.x = clamp(this.x, b.min, Math.max(b.min, b.max));
    if (this.surface.kind === 'ledge') this.surface.off = this.x - b.L.x1;
  }

  rest(seconds = rand(1.2, 3.5)) {
    this.mode = 'idle';
    this.goal = null;
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
