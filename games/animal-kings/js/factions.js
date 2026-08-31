/* The five kingdoms and their rosters.

   Every faction fields the same five roles, but its stats come from an archetype
   multiplied by a faction modifier, and each faction overrides one or two entries
   outright — the sheep get a healer where everyone else gets an archer, the cows
   get a siege ox. That is what keeps five rosters from being one roster in five
   colours.

   Body glyph is the animal; the class reads from a small badge glyph drawn at the
   shoulder. There simply are not five distinct emoji per animal, and this solves
   it without inventing sprites.

   DOM-free: imported directly by the test suite. */

export const CLASS_ORDER = ['worker', 'scout', 'warrior', 'ranged', 'champion'];

export const ARCHETYPES = {
  worker: {
    key: 'worker', name: 'Thợ', badge: '⚒', worker: true,
    hp: 70, dmg: 5, range: 30, atkEvery: 1.1, speed: 78, pop: 1, build: 12,
    cost: { food: 50, wood: 0, gold: 0 }, from: 'barracks'
  },
  scout: {
    key: 'scout', name: 'Trinh Sát', badge: '👁',
    hp: 60, dmg: 8, range: 32, atkEvery: 0.9, speed: 134, pop: 1, build: 10,
    cost: { food: 40, wood: 20, gold: 0 }, from: 'barracks'
  },
  warrior: {
    key: 'warrior', name: 'Chiến Binh', badge: '⚔',
    hp: 140, dmg: 15, range: 34, atkEvery: 1.0, speed: 84, pop: 2, build: 18,
    cost: { food: 70, wood: 20, gold: 0 }, from: 'barracks'
  },
  ranged: {
    key: 'ranged', name: 'Xạ Thủ', badge: '🏹', projectile: '🪶',
    hp: 85, dmg: 12, range: 200, atkEvery: 1.2, speed: 80, pop: 2, build: 20,
    cost: { food: 50, wood: 45, gold: 0 }, from: 'barracks'
  },
  champion: {
    key: 'champion', name: 'Dũng Sĩ', badge: '🛡', needs: 'shrine',
    hp: 240, dmg: 28, range: 38, atkEvery: 1.25, speed: 82, pop: 3, build: 30,
    cost: { food: 110, wood: 40, gold: 35 }, from: 'barracks'
  }
};

/* ── the five kingdoms ────────────────────────────────────────────────────── */

export const FACTIONS = [
  {
    id: 'pig', name: 'Vương Quốc Lợn', emoji: '🐷', king: '🐷', color: '#ff9ec4',
    blurb: 'Chậm, dày máu, càng đánh lâu càng khỏe.',
    affinity: 'food',
    body: { worker: '🐖', scout: '🐷', warrior: '🐖', ranged: '🐷', champion: '🐗' },
    mod: { hp: 1.25, dmg: 1.0, speed: 0.9, cost: 1.0, build: 1.05 },
    passive: {
      name: 'Bội Thu', icon: '🍎',
      desc: 'Thu hoạch thức ăn +35%. Quân đứng yên gần nhà tự hồi máu.',
      foodBonus: 0.35, idleRegen: 3.5
    },
    ability: {
      name: 'Tiệc Lớn', icon: '🍖',
      desc: 'Hồi máu toàn bộ quân ta quanh Vua.',
      radius: 300, heal: 120
    },
    building: {
      key: 'trough', name: 'Máng Ăn', glyph: '🛢️', foot: 1, hp: 420,
      cost: { food: 0, wood: 70, gold: 0 }, build: 10,
      desc: 'Hồi 6 máu/giây cho quân ta quanh nó.',
      aura: { kind: 'heal', radius: 220, value: 6 }
    },
    overrides: {
      champion: { name: 'Lợn Lòi', hp: 300, dmg: 30, armor: 0.25, speed: 88 }
    }
  },
  {
    id: 'chicken', name: 'Vương Quốc Gà', emoji: '🐔', king: '🐔', color: '#ffd35c',
    blurb: 'Rẻ, nhanh, đông. Chết cũng nhanh.',
    affinity: 'gold',
    body: { worker: '🐔', scout: '🐤', warrior: '🐔', ranged: '🐤', champion: '🐓' },
    mod: { hp: 0.7, dmg: 0.85, speed: 1.2, cost: 0.6, build: 0.55 },
    passive: {
      name: 'Bầy Đàn', icon: '🐣',
      desc: 'Quân rẻ hơn 40% và luyện nhanh hơn gần gấp đôi.',
    },
    ability: {
      name: 'Gà Gáy', icon: '📢',
      desc: 'Đoàn tùy tùng đánh nhanh hơn 70% trong 8 giây.',
      radius: 340, duration: 8, atkSpeed: 1.7
    },
    building: {
      key: 'nest', name: 'Ổ Trứng', glyph: '🥚', foot: 1, hp: 380,
      cost: { food: 60, wood: 60, gold: 0 }, build: 12,
      desc: 'Cứ 25 giây đẻ ra một chú gà con miễn phí.',
      spawner: { every: 25, cls: 'scout', free: true }
    },
    overrides: {
      ranged: { name: 'Gà Ném Trứng', projectile: '🥚', range: 185 },
      champion: { name: 'Gà Trống', hp: 190, dmg: 24, aura: { kind: 'atkSpeed', radius: 190, value: 1.25 } }
    }
  },
  {
    id: 'cow', name: 'Vương Quốc Bò', emoji: '🐄', king: '🐄', color: '#e8e2d4',
    blurb: 'Ít quân, đắt quân, nhưng mỗi cú húc là một cái hố.',
    affinity: 'wood',
    body: { worker: '🐄', scout: '🐃', warrior: '🐄', ranged: '🐃', champion: '🐂' },
    mod: { hp: 1.3, dmg: 1.3, speed: 0.85, cost: 1.35, build: 1.3 },
    passive: {
      name: 'Sức Trâu', icon: '💪',
      desc: 'Máu và sát thương cao hơn hẳn, đổi lại chậm và đắt.'
    },
    ability: {
      name: 'Giẫm Đạp', icon: '🐾',
      desc: 'Vua và tùy tùng lao thẳng, giẫm nát mọi thứ trên đường.',
      duration: 2.6, speed: 2.2, trample: 34
    },
    building: {
      key: 'bell', name: 'Chuông Trận', glyph: '🔔', foot: 1, hp: 460,
      cost: { food: 40, wood: 80, gold: 20 }, build: 13,
      desc: 'Quân ta quanh nó gây thêm 20% sát thương.',
      aura: { kind: 'damage', radius: 240, value: 1.2 }
    },
    overrides: {
      champion: { name: 'Bò Mộng', hp: 340, dmg: 34, siege: 3, speed: 74 }
    }
  },
  {
    id: 'sheep', name: 'Vương Quốc Cừu', emoji: '🐑', king: '🐑', color: '#cfe6ff',
    blurb: 'Xây tường, chữa thương, đứng yên và không chịu chết.',
    affinity: 'wood',
    body: { worker: '🐑', scout: '🐑', warrior: '🐏', ranged: '🐑', champion: '🐏' },
    mod: { hp: 1.05, dmg: 0.85, speed: 0.95, cost: 0.9, build: 1.0 },
    passive: {
      name: 'Lông Dày', icon: '🧶',
      desc: 'Giảm 15% sát thương phải chịu. Tường len rẻ như cho.',
      armor: 0.15
    },
    ability: {
      name: 'Tường Len', icon: '🧱',
      desc: 'Dựng tức thì một vòng tường quanh Vua.',
      walls: 6, radius: 92
    },
    building: {
      key: 'wall', name: 'Tường Len', glyph: '🧱', foot: 1, hp: 900,
      cost: { food: 0, wood: 25, gold: 0 }, build: 3,
      desc: 'Rẻ, dày, chắn đường. Xây thành hàng là thành lũy.',
      blocks: true
    },
    overrides: {
      /* the only faction whose ranged slot is not an attacker at all */
      ranged: {
        name: 'Thầy Lang', badge: '✚', heal: true, dmg: 16, range: 170,
        atkEvery: 1.0, hp: 95, projectile: '💚'
      },
      champion: { name: 'Cừu Đực', hp: 265, dmg: 26, knockback: 90 }
    }
  },
  {
    id: 'rabbit', name: 'Vương Quốc Thỏ', emoji: '🐰', king: '🐰', color: '#c7a6ff',
    blurb: 'Mỏng như giấy, nhanh như tin đồn, và biết chui hầm.',
    affinity: 'gold',
    body: { worker: '🐰', scout: '🐇', warrior: '🐰', ranged: '🐇', champion: '🐇' },
    mod: { hp: 0.8, dmg: 1.05, speed: 1.35, cost: 0.95, build: 0.85 },
    passive: {
      name: 'Nhanh Chân', icon: '💨',
      desc: 'Quân nhanh nhất trong game, kể cả khi rút chạy.'
    },
    ability: {
      name: 'Đào Hầm', icon: '🕳️',
      desc: 'Vua và tùy tùng chui hầm về bất kỳ công trình nào của mình.',
      pickBuilding: true
    },
    building: {
      key: 'burrow', name: 'Cửa Hầm', glyph: '🕳️', foot: 1, hp: 400,
      cost: { food: 0, wood: 60, gold: 30 }, build: 9,
      desc: 'Điểm chui hầm thứ hai. Quân tự đi giữa các cửa hầm.',
      anchor: true
    },
    overrides: {
      champion: { name: 'Thỏ Sát Thủ', hp: 150, dmg: 44, speed: 128, burst: 2.2 }
    }
  }
];

export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map(f => [f.id, f]));

/* ── derivation ───────────────────────────────────────────────────────────── */

const roundCost = (cost, k) => ({
  food: Math.round((cost.food || 0) * k),
  wood: Math.round((cost.wood || 0) * k),
  gold: Math.round((cost.gold || 0) * k)
});

/* Archetype × faction modifier × faction override. Pure — the same faction and
   class always produce the same block, which is what the test asserts. */
export function unitStats(factionId, classKey) {
  const f = FACTION_BY_ID[factionId];
  if (!f) throw new Error('unknown faction: ' + factionId);
  const a = ARCHETYPES[classKey];
  if (!a) throw new Error('unknown class: ' + classKey);

  const m = f.mod;
  const base = {
    ...a,
    faction: factionId,
    glyph: f.body[classKey],
    hp: Math.round(a.hp * m.hp),
    dmg: Math.round(a.dmg * m.dmg),
    speed: Math.round(a.speed * m.speed),
    build: +(a.build * m.build).toFixed(2),
    cost: roundCost(a.cost, m.cost),
    armor: 0
  };
  /* workers are labour, not troops — faction combat modifiers should not make
     one kingdom's economy accidentally cheaper than its army */
  if (classKey === 'worker') base.cost = roundCost(a.cost, 1);

  const o = f.overrides?.[classKey];
  return o ? { ...base, ...o, cost: o.cost ? roundCost(o.cost, 1) : base.cost } : base;
}

export function roster(factionId) {
  return CLASS_ORDER.map(k => unitStats(factionId, k));
}

export function factionList() { return FACTIONS.map(f => f.id); }
