/* The restaurant itself: guests, tickets, stoves, plates and the staff that
   move them around. One simulation drives both modes — `mode` only changes the
   arrival rate, whether patience is scored, and what happens when it runs out.

   The player is just another waiter with a keyboard attached; every job an NPC
   waiter can take is a job the player can take first. */

import {
  ARRIVAL, EAT_TIME, GUEST_SPEED, HANDOFF_TIME, MOOD_GREEN, MOOD_YELLOW,
  NPC_SPEED, PATIENCE, PAY_TIME, PLAYER_SPEED, READ_MENU_TIME, REACH,
  SHIFT_SECONDS, CLOSING_GRACE, TIP_BY_MOOD, FOOD_COST_RATIO, CHEF_SPEED,
  dist, pick, vnd
} from './config.js';
import {
  ADULT_FACES, DISH, GROUP_KINDS, KID_FACES, weightedPick
} from './data.js';
import { buildWorld, findPath, followPath, moveWithCollision } from './world.js';
import { derived } from './state.js';

let nextId = 1;

export function createSim(save, mode = 'shift') {
  const d = derived(save);
  const world = buildWorld(d.tables);

  const sim = {
    mode, save, d, world,
    t: 0,
    timeLeft: mode === 'shift' ? SHIFT_SECONDS : Infinity,
    closing: false,
    closingFor: 0,
    over: false,
    events: [],                       // drained by main.js for sound and toasts

    player: {
      x: world.door.x, y: world.door.y - 1.6, dir: 'u',
      carry: [], tickets: [], busy: 0, busyMax: 0, busyLabel: ''
    },
    npcs: [],
    chefs: [],
    parties: [],
    queue: [],                        // groups waiting outside for a table
    kitchen: { orders: [], stoves: [], plated: [], pass: [] },

    stats: {
      revenue: 0, tips: 0, foodCost: 0, groups: 0, plates: 0,
      tickets: 0, angry: 0, lost: 0, trashed: 0, green: 0, yellow: 0, red: 0, guests: 0
    },
    target: shiftTarget(d),
    /* a good run at the wholesale market makes every plate cheaper */
    foodCost: Math.max(0.15, FOOD_COST_RATIO - (save.marketBuff?.cut || 0)),
    trendId: save.trend?.id || null
  };

  for (let i = 0; i < d.waiters; i++) {
    sim.npcs.push({
      x: 4 + i * 1.4, y: 6.5, dir: 'd', carry: [], tickets: [],
      busy: 0, job: null, emoji: '🧑', cool: 0
    });
  }
  for (let i = 0; i < d.chefs; i++) {
    const spot = world.stoves[i] || world.stoves[0];
    sim.chefs.push({
      x: spot.x + 0.5, y: spot.y - 0.2,
      home: { x: spot.x + 0.5, y: spot.y - 0.2 },   // in front of the stove, not on it
      holding: null, wander: null, wanderT: 0,
      emoji: i === 0 ? '🧑‍🍳' : (i === 1 ? '👩‍🍳' : '👨‍🍳')
    });
    sim.kitchen.stoves.push(null);
  }

  sim.nextArrival = mode === 'shift' ? 2.5 : 6;
  Object.assign(sim, API);
  return sim;
}

/* What a ca is worth if it goes well: how many groups the floor can turn over,
   times what a group spends, times the slice a competent waiter actually
   catches. One star is "you kept up"; three is "you barely stopped moving". */
export function shiftTarget(d) {
  /* Measured against the headless bot, including the closing stretch after the
     bell — a table turns over about seven times a ca, and one waiter can see
     around thirty-three tables through from menu to money. */
  const byTables  = d.tables * 7;
  const byServers = (1 + d.waiters) * 33;
  /* The kitchen is usually the real ceiling, and leaving it out of the target
     produced goals a flawless waiter could not hit: eight tables are worth
     nothing if one chef can only plate thirty dishes in a ca. The 0.7 is stove
     idle time — no kitchen runs back-to-back for three and a half minutes. */
  const byKitchen = (SHIFT_SECONDS * d.chefs / Math.max(1, d.cookPerGroup)) * 0.7;
  const groups = Math.min(byTables, byServers, byKitchen);
  return Math.round(groups * d.tableBill * 0.62 * (d.targetMult || 1) / 10000) * 10000;
}

/* ── moods ────────────────────────────────────────────────────────────────*/
function moodOf(party) {
  if (!party.waitMax) return 'green';
  const left = 1 - party.wait / party.waitMax;
  return left > MOOD_GREEN ? 'green' : left > MOOD_YELLOW ? 'yellow' : 'red';
}

const API = {

update(dt) {
  if (this.over) return;
  this.t += dt;
  if (this.mode === 'shift') {
    if (!this.closing) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.beginClosing(); }
    } else {
      this.closingFor += dt;
      if (this.floorClear() || this.closingFor > CLOSING_GRACE) { this.finish(); return; }
    }
  }
  this.arrivals(dt);
  this.stepQueue(dt);
  for (const p of this.parties) this.stepParty(p, dt);
  this.parties = this.parties.filter(p => !p.gone);
  this.purgeDead();
  this.stepKitchen(dt);
  for (const n of this.npcs) this.stepNpc(n, dt);
  if (this.player.busy > 0) this.player.busy = Math.max(0, this.player.busy - dt);
},

/* ── closing time ─────────────────────────────────────────────────────────
   The door shuts, the queue outside goes home, and the floor plays itself out:
   food already on the stove still gets cooked, carried and paid for. */
beginClosing() {
  this.closing = true;
  this.closingFor = 0;
  this.groupsAtBell = this.stats.groups;
  this.queue = [];                 // nobody new is getting a table tonight
  this.emit('closing', { tables: this.busyTables() });
},

busyTables() {
  return this.parties.reduce((n, p) => n + (p.state === 'LEAVING' ? 0 : 1), 0);
},

floorClear() {
  return this.busyTables() === 0;
},

/* ── arrivals ─────────────────────────────────────────────────────────────*/
arrivals(dt) {
  if (this.closing) return;        // the door is shut
  this.nextArrival -= dt;
  if (this.nextArrival > 0) return;

  const cfg = ARRIVAL[this.mode];
  const minutes = this.t / 60;
  const perTable = Math.max(cfg.min, cfg.base - minutes * cfg.rampPerMin);
  const n = this.world.tables.length;
  const spread = cfg.sqrt ? Math.sqrt(n) : n;
  const gap = perTable / (spread * this.d.draw * this.d.level.flow);
  this.nextArrival = gap * (0.75 + Math.random() * 0.5);

  if (this.queue.length >= 3) return;

  /* Nobody walks into a quán where every table is already waving at a waiter.
     Without this the floor fills with guests who time out before anyone can
     reach them, and serving *more* tables earns *less* — the arrival rate has
     to stay tethered to how many hands are actually on the floor. */
  const servers = 1 + this.d.waiters;
  const room = servers * 2 + Math.floor(this.world.tables.length / 3);
  const pending = this.parties.reduce((n, p) =>
    n + (p.state === 'WANT_MENU' || p.state === 'ORDER_READY' || p.state === 'WANT_BILL' ? 1 : 0), 0);
  if (pending > room) { this.stats.lost++; this.emit('lost'); return; }

  /* And do not seat anyone the kitchen cannot feed. One cook physically cannot
     keep five tables fed, and letting them all sit down anyway just spreads the
     food thin: every table waits, nobody gets a last dish, nobody pays. Turning
     the extra guests away instead is what a one-cook quán actually does — and
     it makes hiring a second chef the obvious next purchase. */
  if (this.kitchenBacklog() > PATIENCE.WAIT_FOOD * this.d.comfort * 0.75) {
    this.stats.lost++; this.emit('lost'); return;
  }

  this.queue.push(makeParty(this.d));
},

stepQueue(dt) {
  for (const g of this.queue) g.queueWait += dt;

  /* the head of the line takes the first free table */
  while (this.queue.length) {
    const table = this.world.tables.find(t => !t.party);
    if (!table) break;
    const g = this.queue.shift();
    table.party = g;
    g.table = table;
    g.state = 'WALK_IN';
    g.members.forEach((m, i) => {
      m.seat = table.seats[i % table.seats.length];
      m.x = this.world.door.x + (i - 1) * 0.35;
      m.y = this.world.door.y + 1.2;
      m.path = findPath(this.world, m, m.seat) || [{ ...m.seat }];
    });
    this.parties.push(g);
    this.stats.guests += g.members.length;
    this.emit('seat');
  }

  /* nobody waits outside forever */
  const patience = this.mode === 'shift' ? 26 : 18;
  const before = this.queue.length;
  this.queue = this.queue.filter(g => g.queueWait < patience);
  /* Somebody who never got a table is a customer you lost, not a customer you
     upset — it costs revenue but it does not spoil a clean ca. */
  if (this.queue.length < before) {
    this.stats.lost += before - this.queue.length;
    this.emit('lost');
  }
},

/* ── one party's life ─────────────────────────────────────────────────────*/
stepParty(p, dt) {
  const w = this.world;

  switch (p.state) {
    case 'WALK_IN': {
      let all = true;
      for (const m of p.members) if (!followPath(m, GUEST_SPEED, dt)) all = false;
      if (all) this.setWait(p, 'WANT_MENU', PATIENCE.WANT_MENU);
      break;
    }

    case 'WANT_MENU':
    case 'ORDER_READY':
    case 'WAIT_FOOD':
    case 'WANT_BILL':
      p.wait += dt;
      if (p.wait >= p.waitMax) this.giveUp(p);
      break;

    case 'READING':
      p.timer -= dt;
      if (p.timer <= 0) {
        p.ticket = { partyId: p.id, tableId: p.table.id, dishes: p.members.flatMap(m => m.dishes) };
        this.setWait(p, 'ORDER_READY', PATIENCE.ORDER_READY);
      }
      break;

    case 'EATING': {
      let allDone = true;
      for (const m of p.members) {
        if (m.done) continue;
        if (m.servedCount < m.dishes.length) { allDone = false; continue; }
        m.eating -= dt;
        if (m.eating <= 0) m.done = true; else allDone = false;
      }
      if (allDone) {
        this.setWait(p, 'WANT_BILL', PATIENCE.WANT_BILL);
        if (this.d.autoPay) p.autoPayIn = 2.2;
      }
      break;
    }

    case 'LEAVING': {
      let all = true;
      for (const m of p.members) if (!followPath(m, GUEST_SPEED, dt)) all = false;
      if (all) p.gone = true;
      break;
    }
  }

  /* a thu ngân settles the bill without anyone walking over */
  if (p.state === 'WANT_BILL' && p.autoPayIn != null) {
    p.autoPayIn -= dt;
    if (p.autoPayIn <= 0) this.settle(p, 'green');
  }
},

setWait(p, state, base) {
  p.state = state;
  p.wait = 0;
  p.waitMax = base * this.d.comfort;
  p.claimedBy = null;
},

giveUp(p) {
  if (this.mode === 'shift') {
    this.stats.angry++;
    this.emit('angry', p.table ? { x: p.table.x, y: p.table.y - 1.2, text: '😡' } : null);
  }
  p.mad = this.mode === 'shift';
  this.leave(p);
},

leave(p) {
  p.state = 'LEAVING';
  p.claimedBy = null;
  /* Hand the table back the moment they stand up, and forget it immediately —
     they walk out over the next few seconds, and by then the table belongs to
     whoever sat down next. */
  if (p.table) { p.table.party = null; p.table = null; }
  p.members.forEach((m, i) => {
    m.path = findPath(this.world, m, { x: this.world.door.x + (i - 1) * 0.3, y: this.world.door.y + 2.4 })
          || [{ x: this.world.door.x, y: this.world.door.y + 2.4 }];
  });
  /* Nothing to unwind here: their demand simply disappears, and the next
     reconcile drops any of it that had not started cooking. Whatever was
     already cooked stays on the hatch for whoever else ordered the same. */
},

/* ── the kitchen ──────────────────────────────────────────────────────────
   The stove cooks whether or not anyone is standing at it — a pot of phở does
   not care — but a finished dish only reaches the hatch once a chef carries it
   there. That is what puts the kitchen in motion without throttling it. */
/* Cook to what is still owed, not to a list of past requests.

   Because a plate goes to whoever ordered that dish, food routinely crosses
   tables — and then the table it was cooked for is short. Any per-party ledger
   drifts out of step with reality within a couple of swaps, and the symptom is
   a table that gets its first dish and then waits forever for a second nobody
   is making. Counting outstanding demand against everything already in flight
   cannot drift: whatever is missing gets queued, whatever is surplus is
   dropped, every frame. */
reconcileOrders() {
  const k = this.kitchen;
  const bump = (m, id, n = 1) => m.set(id, (m.get(id) || 0) + n);

  const need = new Map();
  for (const p of this.parties) {
    if (!p.ordered) continue;                       // ticket has not reached the kitchen
    if (p.state !== 'WAIT_FOOD' && p.state !== 'EATING') continue;
    for (const m of p.members) {
      const want = new Map();
      for (const id of m.dishes) bump(want, id);
      for (const id of m.got) want.set(id, (want.get(id) || 0) - 1);
      for (const [id, n] of want) if (n > 0) bump(need, id, n);
    }
  }

  const have = new Map();
  for (const pl of k.pass)    bump(have, pl.dishId);
  for (const pl of k.plated)  bump(have, pl.dishId);
  for (const o of k.orders)   bump(have, o.dishId);
  for (const j of k.stoves)   if (j) bump(have, j.dishId);
  for (const c of this.chefs) if (c.holding) bump(have, c.holding.dishId);
  for (const who of [this.player, ...this.npcs]) {
    for (const pl of who.carry) if (!pl.dead) bump(have, pl.dishId);
  }

  for (const [id, n] of need) {
    for (let i = (have.get(id) || 0); i < n; i++) {
      const p = this.neediestFor(id);
      k.orders.push({ dishId: id, partyId: p ? p.id : null, tableId: p && p.table ? p.table.id : 0 });
    }
  }

  /* stop cooking what nobody is waiting for any more */
  for (let i = k.orders.length - 1; i >= 0; i--) {
    const id = k.orders[i].dishId;
    if ((have.get(id) || 0) > (need.get(id) || 0)) {
      k.orders.splice(i, 1);
      have.set(id, have.get(id) - 1);
    }
  }
},

/* seconds of cooking already promised, spread across the stoves */
kitchenBacklog() {
  const k = this.kitchen;
  let secs = 0;
  for (const o of k.orders) secs += DISH[o.dishId].cook * this.d.cookMult;
  for (const j of k.stoves) if (j) secs += Math.max(0, j.left);
  for (const pl of k.plated) secs += 1;              // still to be carried out
  return secs / Math.max(1, this.d.chefs);
},

stepKitchen(dt) {
  const k = this.kitchen;
  this.reconcileOrders();
  for (let i = 0; i < k.stoves.length; i++) {
    let job = k.stoves[i];
    if (!job && k.orders.length && k.plated.length < 4) {
      const order = k.orders.shift();
      const cook = DISH[order.dishId].cook * this.d.cookMult;
      job = k.stoves[i] = { ...order, left: cook, total: cook };
    }
    if (!job) continue;
    job.left -= dt;
    if (job.left <= 0) {
      k.plated.push({ partyId: job.partyId, tableId: job.tableId, dishId: job.dishId });
      k.stoves[i] = null;
    }
  }
  for (let i = 0; i < this.chefs.length; i++) this.stepChef(this.chefs[i], i, dt);
},

stepChef(chef, i, dt) {
  const k = this.kitchen;
  const plating = { x: this.world.plating.x + (i - 1) * 0.55, y: this.world.plating.y };

  if (!chef.holding && k.plated.length && k.pass.length < this.d.passSlots) {
    chef.holding = k.plated.shift();
  }

  let target;
  if (chef.holding) target = plating;
  else if (k.stoves[i]) target = chef.home;
  else {
    chef.wanderT -= dt;
    if (chef.wanderT <= 0 || !chef.wander) {
      chef.wander = pick(this.world.prep);
      chef.wanderT = 2.5 + Math.random() * 3.5;
    }
    target = chef.wander;
  }
  drift(chef, target.x, target.y, dt, CHEF_SPEED);

  if (chef.holding && dist(chef.x, chef.y, plating.x, plating.y) < 0.35) {
    if (k.pass.length >= this.d.passSlots) return;      // hatch full, hold the plate
    /* A plate goes out if ANYBODY still wants that dish. Checking the party it
       was nominally cooked for was throwing away perfectly good food every time
       an order got filled from another table's plate — which, now that plates
       are matched by dish, is most of them. */
    if (this.neediestFor(chef.holding.dishId)) {
      k.pass.push({ ...chef.holding, dead: false, claimedBy: null });
      this.emit('ding');
    }
    chef.holding = null;
  }
},

/* ── who is owed what ─────────────────────────────────────────────────────
   Plates are matched by dish, not by table. A bánh mì is a bánh mì: whoever
   ordered one can eat this one, and the waiter never has to remember which
   table a particular plate was cooked for. */
memberNeeds(m, dishId) {
  let want = 0, got = 0;
  for (const id of m.dishes) if (id === dishId) want++;
  for (const id of m.got)    if (id === dishId) got++;
  return want > got;
},

partyNeeds(p, dishId) {
  if (!p || (p.state !== 'WAIT_FOOD' && p.state !== 'EATING')) return false;
  return p.members.some(m => this.memberNeeds(m, dishId));
},

/* how many dishes a party is still owed */
outstanding(p) {
  let total = 0;
  for (const m of p.members) total += m.dishes.length - m.got.length;
  return Math.max(0, total);
},

/* Who should get this plate. Finishing a table beats feeding a new one: when
   the kitchen cannot keep up, spreading plates evenly across every table means
   nobody ever gets their last dish, nobody pays, and nobody leaves — the floor
   locks solid while the till stays empty. Among tables this plate would
   complete, the one closest to walking out wins. */
neediestFor(dishId) {
  let best = null, bestScore = Infinity;
  for (const p of this.parties) {
    if (!p.table || !this.partyNeeds(p, dishId)) continue;
    const left = p.waitMax ? p.waitMax - p.wait : 999;
    const score = (this.outstanding(p) === 1 ? 0 : 1000) + left;
    if (score < bestScore) { bestScore = score; best = p; }
  }
  return best;
},

/* 1-based table number to print on a plate, or null when nobody wants it */
hintTableFor(dishId) {
  const p = this.neediestFor(dishId);
  return p && p.table ? p.table.id + 1 : null;
},

/* ── interaction ──────────────────────────────────────────────────────────
   `who` is the player or an NPC; both go through the same door so the two can
   never drift apart in behaviour.

   Reach is measured to the *edge* of the table, not to one corner spot, so
   walking up to any side works — which is what standing next to a table means. */
tableReach(who, t) {
  const dx = Math.max(0, Math.abs(who.x - t.x) - 1);
  const dy = Math.max(0, Math.abs(who.y - t.y) - 1);
  return Math.hypot(dx, dy);
},

tableAction(who, t) {
  const p = t.party;
  if (!p) return null;
  if (who.carry.some(pl => !pl.dead && this.partyNeeds(p, pl.dishId))) return 'serve';
  if (p.state === 'WANT_MENU')   return 'menu';
  if (p.state === 'ORDER_READY') return 'ticket';
  if (p.state === 'WANT_BILL')   return 'bill';
  return null;
},

targetFor(who) {
  const w = this.world;
  const near = (p) => dist(who.x, who.y, p.x, p.y) <= REACH;

  /* the nearest table within arm's reach that actually wants something */
  let best = null, bestKind = null, bestD = Infinity;
  for (const t of w.tables) {
    const d = this.tableReach(who, t);
    if (d > REACH || d >= bestD) continue;
    const kind = this.tableAction(who, t);
    if (!kind) continue;
    best = t; bestKind = kind; bestD = d;
  }
  if (best) return { kind: bestKind, table: best, party: best.party };

  if (near(w.bin) && who.carry.length) {
    const dead = who.carry.filter(pl => pl.dead).length;
    return { kind: 'trash', dead, count: dead || who.carry.length };
  }
  if (who.tickets.length && near(w.window)) return { kind: 'handoff' };
  if (this.kitchen.pass.length && who.carry.length < this.d.carry && near(w.pass)) return { kind: 'pickup' };
  return null;
},

interact(who = this.player) {
  if (who.busy > 0) return null;
  const target = this.targetFor(who);
  if (!target) return null;

  switch (target.kind) {
    case 'menu': {
      const p = target.party;
      this.score(p);
      p.state = 'READING';
      p.timer = READ_MENU_TIME * this.d.menuMult;
      p.claimedBy = null;
      this.emit('menu');
      return 'menu';
    }
    case 'ticket': {
      const p = target.party;
      this.score(p);
      const ticket = p.ticket;
      who.tickets.push(ticket);
      p.ticket = null;
      this.setWait(p, 'WAIT_FOOD', PATIENCE.WAIT_FOOD);
      this.stats.tickets++;
      if (who === this.player) this.save.progress.tickets++;
      this.emit('ticket', {
        player: who === this.player,
        table: target.table.id + 1,
        text: orderSummary(ticket.dishes)
      });
      return 'ticket';
    }
    case 'handoff': {
      const ticket = who.tickets.shift();
      const party = this.parties.find(x => x.id === ticket.partyId);
      if (party) party.ordered = true;      // the kitchen now cooks for them
      this.busyFor(who, HANDOFF_TIME, 'Đưa phiếu');
      this.emit('handoff');
      return 'handoff';
    }
    case 'pickup': {
      let taken = 0;
      while (who.carry.length < this.d.carry && this.kitchen.pass.length) {
        who.carry.push(this.kitchen.pass.shift());
        taken++;
      }
      if (taken) this.emit('pickup');
      return taken ? 'pickup' : null;
    }
    case 'serve': {
      const p = target.party, t = target.table;
      const keep = [];
      const servedIds = [];
      let served = 0;
      for (const plate of who.carry) {
        if (plate.dead) { keep.push(plate); continue; }
        const m = p.members.find(mm => this.memberNeeds(mm, plate.dishId));
        if (!m) { keep.push(plate); continue; }
        m.got.push(plate.dishId);
        servedIds.push(plate.dishId);
        m.servedCount++;
        if (m.servedCount >= m.dishes.length) m.eating = EAT_TIME;
        served++;
      }
      who.carry = keep;
      if (!served) return null;
      if (p.state === 'WAIT_FOOD') this.score(p);
      this.stats.plates += served;
      if (who === this.player) this.save.progress.plates += served;
      p.state = 'EATING';
      p.claimedBy = null;
      this.emit('serve', {
        player: who === this.player,
        table: t.id + 1,
        text: orderSummary(servedIds)
      });
      return 'serve';
    }
    case 'trash': {
      const dead = who.carry.filter(pl => pl.dead);
      const toss = dead.length ? dead : who.carry.slice();
      if (!toss.length) return null;
      who.carry = who.carry.filter(pl => !toss.includes(pl));
      this.stats.trashed += toss.length;
      this.emit('trash', { n: toss.length });
      return 'trash';
    }
    case 'bill': {
      const p = target.party;
      const mood = moodOf(p);
      this.score(p);
      this.busyFor(who, PAY_TIME * this.d.payMult, 'Thanh toán');
      this.settle(p, mood);
      return 'bill';
    }
  }
  return null;
},

busyFor(who, secs, label) {
  who.busy = secs; who.busyMax = secs; who.busyLabel = label;
},

/* Drinks and desserts, one per head, at the rate the quán actually sells them.
   No plate, no delivery — just money, which is why the drinks board matters. */
sideRevenue(p) {
  const sides = this.d.sides;
  if (!sides.length) return 0;
  let total = 0;
  for (const m of p.members) {
    if (Math.random() < 0.55) total += pick(sides).price;
  }
  return total;
},

/* record the colour the guest was on when they finally got attention */
score(p) {
  const mood = moodOf(p);
  p.moods.push(mood);
  this.stats[mood]++;
  if (mood === 'green') this.save.progress.green++;
},

settle(p, mood) {
  /* The meal is the only thing the kitchen cooks, but a table of four still
     orders trà đá and a chè round while they sit — those go straight on the
     bill instead of becoming another plate to carry. That is what keeps the
     drink and dessert recipes worth buying. */
  let meal = p.members.reduce((sum, m) => sum + m.dishes.reduce((a, id) => a + DISH[id].price, 0), 0);
  /* word got around that this dish is worth queuing for */
  if (this.trendId && p.meal === this.trendId) meal = Math.round(meal * 1.25);
  const bill = meal + this.sideRevenue(p);
  const tipRate = this.mode === 'shift' ? TIP_BY_MOOD[mood] * this.d.charm : 0.04 * this.d.charm;
  const tip = Math.round(bill * tipRate);
  const cost = Math.round(bill * this.foodCost);

  this.stats.revenue += bill;
  this.stats.tips += tip;
  this.stats.foodCost += cost;
  this.stats.groups++;
  this.save.money += bill + tip - cost;
  this.save.progress.groups++;

  p.paid = bill + tip;
  const at = p.table ? { x: p.table.x, y: p.table.y - 1.2 } : null;
  this.emit('pay', { ...at, text: '+' + vnd(bill + tip - cost) });
  this.leave(p);
},

/* ── NPC waiters ──────────────────────────────────────────────────────────
   No planner, just a priority list re-evaluated whenever they finish a job.
   Claims stop two of them walking to the same table. */
stepNpc(n, dt) {
  if (n.busy > 0) { n.busy = Math.max(0, n.busy - dt); return; }
  n.cool = Math.max(0, n.cool - dt);

  if (!n.job || !this.jobStillValid(n)) { n.job = this.pickJob(n); n.path = null; }
  const job = n.job;
  if (!job) { drift(n, 6 + (n.idleDrift = (n.idleDrift ?? Math.random() * 6)), 7.5, dt); return; }

  const spot = job.spot;
  if (!n.path) n.path = findPath(this.world, n, spot) || [{ ...spot }];
  if (!followPath(n, NPC_SPEED, dt)) return;

  if (dist(n.x, n.y, spot.x, spot.y) <= REACH) {
    const did = this.interact(n);
    if (!did) n.cool = 0.4;
    this.releaseClaim(n);
    n.job = null; n.path = null;
  }
},

jobStillValid(n) {
  const j = n.job;
  if (!j) return false;
  if (j.kind === 'handoff') return n.tickets.length > 0;
  if (j.kind === 'trash')   return n.carry.some(pl => pl.dead);
  if (j.kind === 'pickup')  return this.kitchen.pass.length > 0 && n.carry.length < this.d.carry;
  if (j.kind === 'serve')   return n.carry.some(pl => !pl.dead && this.neediestFor(pl.dishId));
  const p = this.parties.find(x => x.id === j.partyId);
  return !!p && p.state === j.state;
},

releaseClaim(n) {
  for (const p of this.parties) if (p.claimedBy === n) p.claimedBy = null;
},

pickJob(n) {
  const w = this.world;
  for (const pl of n.carry) {
    if (pl.dead) continue;
    const target = this.neediestFor(pl.dishId);
    if (target && target.table) return { kind: 'serve', dishId: pl.dishId, spot: target.table.stand };
  }
  if (n.carry.some(pl => pl.dead)) return { kind: 'trash', spot: w.bin };
  if (n.tickets.length) return { kind: 'handoff', spot: w.window };

  /* whoever is closest to walking out gets served first */
  let best = null, bestLeft = Infinity;
  for (const p of this.parties) {
    if (p.claimedBy && p.claimedBy !== n) continue;
    if (!['WANT_MENU', 'ORDER_READY', 'WANT_BILL'].includes(p.state)) continue;
    if (p.state === 'WANT_BILL' && this.d.autoPay) continue;
    const left = p.waitMax - p.wait;
    if (left < bestLeft) { bestLeft = left; best = p; }
  }
  if (best && bestLeft < 12) {
    best.claimedBy = n;
    return { kind: best.state, partyId: best.id, state: best.state, spot: best.table.stand };
  }
  if (this.kitchen.pass.length && n.carry.length < this.d.carry) return { kind: 'pickup', spot: w.pass };
  if (best) {
    best.claimedBy = n;
    return { kind: best.state, partyId: best.id, state: best.state, spot: best.table.stand };
  }
  return null;
},

/* ── player movement ──────────────────────────────────────────────────────*/
movePlayer(ax, ay, dt) {
  const p = this.player;
  if (p.busy > 0) return;
  if (!ax && !ay) return;
  const len = Math.hypot(ax, ay) || 1;
  const step = PLAYER_SPEED * dt;
  moveWithCollision(this.world, p, (ax / len) * step, (ay / len) * step);
  p.dir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'r' : 'l') : (ay > 0 ? 'd' : 'u');
},

/* A plate is only rubbish when nobody left in the room ordered that dish — and
   it stops being rubbish the moment somebody does, because a bánh mì sitting on
   the tray is still a perfectly good bánh mì. */
purgeDead() {
  const wanted = new Set();
  for (const p of this.parties) {
    if (p.state !== 'WAIT_FOOD' && p.state !== 'EATING') continue;
    for (const m of p.members) for (const id of m.dishes) if (this.memberNeeds(m, id)) wanted.add(id);
  }
  const live = new Set(this.parties.filter(p => p.state !== 'LEAVING').map(p => p.id));

  for (const who of [this.player, ...this.npcs]) {
    let spoiled = 0;
    for (const pl of who.carry) {
      const orphan = !wanted.has(pl.dishId);
      if (orphan && !pl.dead) { pl.dead = true; spoiled++; }
      else if (!orphan && pl.dead) pl.dead = false;   // a new guest ordered it
    }
    const hadTickets = who.tickets.length;
    who.tickets = who.tickets.filter(tk => live.has(tk.partyId));
    if (spoiled || who.tickets.length < hadTickets) {
      if (who.job) who.job = null;
      if (spoiled) this.emit('waste', { n: spoiled });
    }
  }
  this.kitchen.plated = this.kitchen.plated.filter(pl => live.has(pl.partyId) || wanted.has(pl.dishId));
  for (const c of this.chefs) {
    if (c.holding && !live.has(c.holding.partyId) && !wanted.has(c.holding.dishId)) c.holding = null;
  }
},

/* debug hook: put another group on the pavement right now */
spawnGuest() {
  const party = makeParty(this.d);
  this.queue.push(party);
  return party;
},

emit(kind, extra = null) { this.events.push(extra ? { kind, ...extra } : { kind }); },

drainEvents() { const e = this.events; this.events = []; return e; },

/* ── the bell ─────────────────────────────────────────────────────────────*/
finish() {
  this.over = true;
  const s = this.stats;
  const net = s.revenue + s.tips - s.foodCost;
  const stars = s.revenue >= this.target * 1.75 ? 3
              : s.revenue >= this.target * 1.35 ? 2
              : s.revenue >= this.target ? 1 : 0;
  this.report = {
    revenue: s.revenue, tips: s.tips, foodCost: s.foodCost, net,
    groups: s.groups, plates: s.plates, angry: s.angry, lost: s.lost, trashed: s.trashed,
    green: s.green, yellow: s.yellow, red: s.red,
    guests: s.guests, target: this.target, stars, passed: stars > 0,
    servedAfterBell: s.groups - (this.groupsAtBell ?? s.groups),
    closingFor: this.closingFor
  };
  this.emit(stars > 0 ? 'win' : 'lose');
}

};

/* ── party factory ────────────────────────────────────────────────────────*/
function makeParty(d) {
  const total = GROUP_KINDS.reduce((a, k) => a + k.weight, 0);
  let roll = Math.random() * total, kind = GROUP_KINDS[0];
  for (const k of GROUP_KINDS) { roll -= k.weight; if (roll <= 0) { kind = k; break; } }

  /* A table orders one meal, however many people are sitting at it. Everyone
     shares it, so there is exactly one plate to cook and one plate to carry —
     the whole order fits in a single thought bubble. */
  const mains = d.menu.filter(x => x.kind === 'main');
  const meal = (mains.length ? weightedPick(mains, d.level.n) : d.menu[0]).id;
  const members = [];
  for (let i = 0; i < kind.size; i++) {
    const kid = kind.size >= 3 && i >= 2;
    members.push({
      face: kid ? pick(KID_FACES) : pick(ADULT_FACES),
      dishes: i === 0 ? [meal] : [],   // one plate lands on the table, shared
      got: [], servedCount: 0, eating: 0, done: false,
      x: 0, y: 0, path: null
    });
  }

  return {
    id: nextId++, kind: kind.id, members,
    state: 'QUEUE', wait: 0, waitMax: 0, timer: 0,
    queueWait: 0, moods: [], ticket: null, table: null,
    claimedBy: null, gone: false, mad: false, autoPayIn: null, ordered: false,
    meal
  };
}

/* "Phở bò tái nạm ×2, Trà đá" — what the waiter is actually carrying */
export function orderSummary(dishIds) {
  const count = new Map();
  for (const id of dishIds) count.set(id, (count.get(id) || 0) + 1);
  return [...count].map(([id, n]) => DISH[id].name + (n > 1 ? ` ×${n}` : '')).join(', ');
}

/* free-walking drift for chefs and idle waiters — no pathfinding, no collision.
   The kitchen is one open room, so nothing in there needs to path around. */
function drift(e, tx, ty, dt, speed = NPC_SPEED * 0.55) {
  const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy);
  if (len < 0.08) return;
  const step = Math.min(len, speed * dt);
  e.x += dx / len * step; e.y += dy / len * step;
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'd' : 'u');
}

export { moodOf };
