/* ============================================================
   番茄鐘地下城 — script.js
   Complete Game Logic
============================================================ */
'use strict';

// ═══════════════════════════════════════════════════════════
//  DATA TABLES
// ═══════════════════════════════════════════════════════════

const FORGE_RECIPES = [
  { id:'iron_sword',  name:'鐵劍',    emoji:'⚔️',  type:'weapon', cost:{iron:20,wood:8},  stats:{atk:12,def:0},  desc:'ATK +12' },
  { id:'steel_blade', name:'鋼刃',    emoji:'🗡️',  type:'weapon', cost:{iron:40,wood:15}, stats:{atk:22,def:0},  desc:'ATK +22' },
  { id:'wood_shield', name:'木盾',    emoji:'🛡️',  type:'armor',  cost:{iron:0, wood:18}, stats:{atk:0, def:10}, desc:'DEF +10' },
  { id:'iron_armor',  name:'鐵甲',    emoji:'🥋',  type:'armor',  cost:{iron:28,wood:10}, stats:{atk:0, def:18}, desc:'DEF +18' },
];

const KITCHEN_RECIPES = [
  { id:'berry_elixir', name:'漿果藥水', emoji:'🧪', key:'berryElixir', cost:{berries:5,meat:0}, qty:2, desc:'恢復 40 HP' },
  { id:'hearty_stew',  name:'豐盛燉鍋', emoji:'🍲', key:'heartyStew',  cost:{berries:0,meat:4}, qty:1, desc:'恢復 70 HP' },
  { id:'power_tonic',  name:'力量補液', emoji:'⚗️', key:'powerTonic',  cost:{berries:3,meat:3}, qty:1, desc:'恢復 30HP＋ATK+8（30秒）' },
];

const CONSUMABLES = {
  berryElixir: { name:'漿果藥水', emoji:'🧪', eff:{ type:'heal',    val:40 } },
  heartyStew:  { name:'豐盛燉鍋', emoji:'🍲', eff:{ type:'heal',    val:70 } },
  powerTonic:  { name:'力量補液', emoji:'⚗️', eff:{ type:'healBuff',heal:30, buff:{ stat:'atk', val:8, dur:30 } } },
};

const FLOORS = [
  { name:'哥布林斥候', emoji:'👺', hp:40,  atk:7,  def:2,  exp:18,  drop:.50, boss:false },
  { name:'石像鬼',     emoji:'🦇', hp:65,  atk:12, def:5,  exp:32,  drop:.55, boss:false },
  { name:'骷髏騎士',   emoji:'💀', hp:88,  atk:17, def:8,  exp:55,  drop:.60, boss:false },
  { name:'黑暗女巫',   emoji:'🧙', hp:72,  atk:24, def:5,  exp:68,  drop:.65, boss:false },
  { name:'石魔君主',   emoji:'🗿', hp:160, atk:30, def:15, exp:130, drop:.95, boss:true  },
];

const RARITIES = [
  { name:'普通', cls:'r-common',    w:50, atkL:5,  atkH:10 },
  { name:'優秀', cls:'r-uncommon',  w:25, atkL:11, atkH:18 },
  { name:'稀有', cls:'r-rare',      w:15, atkL:19, atkH:28 },
  { name:'史詩', cls:'r-epic',      w:8,  atkL:29, atkH:40 },
  { name:'傳說', cls:'r-legendary', w:2,  atkL:41, atkH:60 },
];

const WP_NAMES  = ['裂傷劍','暗影刃','血月刀','破甲長劍','鬼牙','龍骨刃','深淵之爪','冥府劍','滅世刃','魔將劍'];
const WP_EMOJI  = ['⚔️','🗡️','🔱','⚡','🌙','🔥','❄️','💜','🌟','🩸'];

// ═══════════════════════════════════════════════════════════
//  GAME STATE
// ═══════════════════════════════════════════════════════════

const GS = {
  phase: 'focus',

  // Timer
  timerDur:  25 * 60,
  timerLeft: 25 * 60,
  timerOn:   false,
  timerIv:   null,

  // Resource accumulators (fractional)
  acc:  { iron:0, wood:0, berries:0, meat:0, exp:0 },
  // Display gains (floor of acc)
  gain: { iron:0, wood:0, berries:0, meat:0, exp:0 },

  // Stored resources — start with small amount so prototype is playable immediately
  res: { iron:50, wood:30, berries:20, meat:15 },

  // Player
  pl: {
    lv: 1, exp: 0, expNxt: 100,
    maxHp: 120, hp: 120,
    baseAtk: 8, baseDef: 4,
    weapon: null,  // { id, name, emoji, atk, rarity, cls }
    armor:  null,  // { id, name, emoji, def, rarity, cls }
  },

  // Consumables bag
  bag: { berryElixir:0, heartyStew:0, powerTonic:0 },

  // Weapon inventory
  wpInv: [],

  // Active buffs
  buffs: [],   // { name, stat, val, left }
  buffIv: null,

  // Dungeon
  dg: {
    on:      false,
    floor:   0,
    mob:     null,
    plIv:    null,
    mobIv:   null,
    plTick:  0,
    mobTick: 0,
    plSpd:   2000,   // ms between player attacks
    mobSpd:  2600,   // ms between monster attacks
  },
};

// ═══════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════

const $ = id => document.getElementById(id);
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function fmt(s) { return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0'); }

function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className   = 'toast ' + type;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 3200);
}

function modal(html, onOk) {
  $('modal-body').innerHTML = html;
  $('modal').classList.remove('hidden');
  $('modal-ok').onclick = () => {
    $('modal').classList.add('hidden');
    if (onOk) onOk();
  };
}

function dmgFloat(txt, x, y, color) {
  const el = document.createElement('div');
  el.className   = 'dmg-float';
  el.textContent = txt;
  Object.assign(el.style, { left: x+'px', top: y+'px', color, fontSize:'1.15rem' });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

// ═══════════════════════════════════════════════════════════
//  PARTICLES
// ═══════════════════════════════════════════════════════════

function initParticles() {
  const c = $('particles');
  // Warm ember colors matching the amber/fire palette
  const colors = ['#e8891a','#f5aa30','#c84020','#ff9940','#ffd060'];
  for (let i = 0; i < 22; i++) {
    const p = document.createElement('div');
    p.className = 'ember';
    const sz = rand(1, 3);
    const drift = (rand(0,1) ? 1 : -1) * rand(10, 50) + 'px';
    Object.assign(p.style, {
      left:             rand(0, 100) + '%',
      width:            sz + 'px',
      height:           sz + 'px',
      background:       colors[rand(0, colors.length - 1)],
      '--drift':        drift,
      animationDuration: rand(8, 22) + 's',
      animationDelay:    rand(0, 20) + 's',
    });
    c.appendChild(p);
  }
}

// ═══════════════════════════════════════════════════════════
//  PHASE MANAGEMENT
// ═══════════════════════════════════════════════════════════

function setPhase(p) {
  GS.phase = p;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.phase-pill').forEach(d => d.classList.remove('active'));

  const screenMap = { focus:'screen-focus', village:'screen-village', dungeon:'screen-dungeon' };
  const navMap    = { focus:'pnav-focus',   village:'pnav-village',   dungeon:'pnav-dungeon'   };

  $(screenMap[p]).classList.add('active');
  $(navMap[p]).classList.add('active');

  if (p === 'village') renderVillage();
  updateHeader();
}

// ═══════════════════════════════════════════════════════════
//  HEADER
// ═══════════════════════════════════════════════════════════

function updateHeader() {
  const p = GS.pl;
  $('h-level').textContent    = `Lv.${p.lv} 勇者`;
  $('h-hp-fill').style.width  = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  $('h-hp-text').textContent  = `${p.hp}/${p.maxHp}`;
  $('h-exp-fill').style.width = clamp(p.exp / p.expNxt * 100, 0, 100) + '%';
  $('h-exp-text').textContent = `${p.exp}/${p.expNxt} EXP`;
  $('h-iron').textContent    = GS.res.iron;
  $('h-wood').textContent    = GS.res.wood;
  $('h-berries').textContent = GS.res.berries;
  $('h-meat').textContent    = GS.res.meat;
}

// ═══════════════════════════════════════════════════════════
//  FOCUS PHASE / TIMER
// ═══════════════════════════════════════════════════════════

// Resource gain per second
const RATES = { iron:.1, wood:.083, berries:.05, meat:.04, exp:.45 };

function initFocus() {
  $('btn-start').onclick       = startTimer;
  $('btn-pause').onclick       = togglePause;
  $('btn-end').onclick         = () => endSession(false);
  $('btn-skip-to-village').onclick = () => setPhase('village');

  $('timer-input').onchange = () => {
    const v = clamp(parseInt($('timer-input').value) || 25, 1, 99);
    $('timer-input').value = v;
    if (!GS.timerOn) {
      GS.timerDur  = v * 60;
      GS.timerLeft = GS.timerDur;
      $('timer-face').textContent = fmt(GS.timerLeft);
      $('timer-prog').style.width = '100%';
    }
  };
}

function startTimer() {
  if (GS.timerOn) return;
  GS.timerOn = true;
  GS.acc     = { iron:0, wood:0, berries:0, meat:0, exp:0 };
  GS.gain    = { iron:0, wood:0, berries:0, meat:0, exp:0 };
  updateHarvest();

  $('btn-start').disabled   = true;
  $('btn-pause').disabled   = false;
  $('btn-end').disabled     = false;
  $('timer-input').disabled = true;
  $('timer-face').classList.add('running');
  $('scene-hero').classList.add('collecting');
  $('scene-caption').textContent = '正在採集資源...';

  GS.timerIv = setInterval(timerTick, 1000);
}

function togglePause() {
  if (GS.timerOn) {
    GS.timerOn = false;
    clearInterval(GS.timerIv);
    $('btn-pause').textContent = '▶ 繼續';
    $('timer-face').classList.remove('running');
    $('scene-hero').classList.remove('collecting');
    $('scene-caption').textContent = '已暫停';
  } else {
    GS.timerOn = true;
    GS.timerIv = setInterval(timerTick, 1000);
    $('btn-pause').textContent = '⏸ 暫停';
    $('timer-face').classList.add('running');
    $('scene-hero').classList.add('collecting');
    $('scene-caption').textContent = '正在採集資源...';
  }
}

function timerTick() {
  GS.timerLeft = Math.max(0, GS.timerLeft - 1);
  $('timer-face').textContent     = fmt(GS.timerLeft);
  $('timer-prog').style.width     = (GS.timerLeft / GS.timerDur * 100) + '%';

  // Accumulate fractional resources
  for (const k in RATES) {
    GS.acc[k] += RATES[k];
    const floored = Math.floor(GS.acc[k]);
    if (floored > GS.gain[k]) {
      GS.gain[k] = floored;
      if (k !== 'exp' && rand(0, 25) === 0) spawnSparkle();
    }
  }
  updateHarvest();

  if (GS.timerLeft <= 0) endSession(true);
}

function endSession(auto) {
  clearInterval(GS.timerIv);
  GS.timerOn = false;

  // Commit gains to resources
  const g = GS.gain;
  GS.res.iron    += g.iron;
  GS.res.wood    += g.wood;
  GS.res.berries += g.berries;
  GS.res.meat    += g.meat;
  addExp(g.exp);
  GS.pl.hp = Math.min(GS.pl.maxHp, GS.pl.hp + 20);  // rest recovery

  // Reset UI
  $('btn-start').disabled   = false;
  $('btn-pause').disabled   = true;
  $('btn-end').disabled     = true;
  $('btn-pause').textContent = '⏸ 暫停';
  $('timer-input').disabled  = false;
  $('timer-face').classList.remove('running');
  $('scene-hero').classList.remove('collecting');
  $('scene-caption').textContent = '採集完成！前往村莊吧。';
  GS.timerLeft = GS.timerDur;
  $('timer-face').textContent = fmt(GS.timerLeft);
  $('timer-prog').style.width = '100%';

  const saved = { ...g };
  GS.gain = { iron:0, wood:0, berries:0, meat:0, exp:0 };
  updateHarvest();

  modal(
    `<h2>🎉 採集結算</h2>
     <p style="color:var(--c-text-dim);font-size:.82rem;margin-bottom:12px;">資源已入庫，恢復 20 HP</p>
     <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:.88rem;">
       <div>⛏️ 鐵礦石 <b style="color:var(--c-gold)">+${saved.iron}</b></div>
       <div>🪵 木材 <b style="color:var(--c-gold)">+${saved.wood}</b></div>
       <div>🫐 漿果 <b style="color:var(--c-gold)">+${saved.berries}</b></div>
       <div>🥩 肉類 <b style="color:var(--c-gold)">+${saved.meat}</b></div>
       <div style="grid-column:span 2">✨ 經驗值 <b style="color:var(--c-blue-lt)">+${saved.exp}</b></div>
     </div>`,
    () => setPhase('village')
  );
}

function updateHarvest() {
  $('s-iron').textContent    = '+' + GS.gain.iron;
  $('s-wood').textContent    = '+' + GS.gain.wood;
  $('s-berries').textContent = '+' + GS.gain.berries;
  $('s-meat').textContent    = '+' + GS.gain.meat;
  $('s-exp').textContent     = '+' + GS.gain.exp;
}

function spawnSparkle() {
  const c = $('sparkles');
  const el = document.createElement('div');
  el.className = 'sparkle';
  el.textContent = ['✨','⭐','💫','🌟'][rand(0,3)];
  el.style.left = rand(20, 80) + '%';
  el.style.top  = rand(20, 75) + '%';
  c.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ═══════════════════════════════════════════════════════════
//  LEVELING
// ═══════════════════════════════════════════════════════════

function addExp(amount) {
  GS.pl.exp += amount;
  while (GS.pl.exp >= GS.pl.expNxt) {
    GS.pl.exp -= GS.pl.expNxt;
    levelUp();
  }
  updateHeader();
}

function levelUp() {
  GS.pl.lv++;
  GS.pl.expNxt = Math.floor(GS.pl.expNxt * 1.6);
  GS.pl.maxHp += 20;
  GS.pl.hp     = GS.pl.maxHp;
  GS.pl.baseAtk += 2;
  GS.pl.baseDef += 1;
  toast('🎉 升級！現在是 Lv.' + GS.pl.lv + '！', 'ok');
  updateHeader();
}

// ═══════════════════════════════════════════════════════════
//  PLAYER STATS
// ═══════════════════════════════════════════════════════════

function getAtk() {
  let v = GS.pl.baseAtk + (GS.pl.weapon ? GS.pl.weapon.atk : 0);
  GS.buffs.forEach(b => { if (b.stat === 'atk') v += b.val; });
  return v;
}

function getDef() {
  let v = GS.pl.baseDef + (GS.pl.armor ? GS.pl.armor.def : 0);
  GS.buffs.forEach(b => { if (b.stat === 'def') v += b.val; });
  return v;
}

// ═══════════════════════════════════════════════════════════
//  VILLAGE
// ═══════════════════════════════════════════════════════════

function renderVillage() {
  renderForge();
  renderKitchen();
  renderInventory();
  updateHeader();
}

/* ── FORGE ── */
function renderForge() {
  const grid = $('forge-grid');
  grid.innerHTML = '';
  FORGE_RECIPES.forEach(r => {
    const ok      = GS.res.iron >= (r.cost.iron||0) && GS.res.wood >= (r.cost.wood||0);
    const costsHtml = makeCostTags({ iron: r.cost.iron||0, wood: r.cost.wood||0 });
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML =
      `<div class="recipe-hdr">
         <span class="recipe-emoji">${r.emoji}</span>
         <div>
           <div class="recipe-name">${r.name}</div>
           <div class="recipe-stat">${r.desc}</div>
         </div>
       </div>
       <div class="recipe-costs">${costsHtml}</div>
       <button class="btn ${ok ? 'btn-gold' : 'btn-red'}" ${ok ? '' : 'disabled'}>
         ${ok ? '🔨 鍛造' : '材料不足'}
       </button>`;
    card.querySelector('button').onclick = () => doCraft(r.id);
    grid.appendChild(card);
  });
}

function makeCostTags(costs) {
  const icons = { iron:'⛏️', wood:'🪵', berries:'🫐', meat:'🥩' };
  return Object.entries(costs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const have = GS.res[k] >= v;
      return `<span class="cost-tag ${have ? 'ok' : 'no'}">${icons[k]} ${v}</span>`;
    }).join('');
}

function doCraft(id) {
  const r = FORGE_RECIPES.find(x => x.id === id);
  if (!r) return;
  if (GS.res.iron < (r.cost.iron||0) || GS.res.wood < (r.cost.wood||0)) return;

  GS.res.iron -= r.cost.iron || 0;
  GS.res.wood -= r.cost.wood || 0;

  const item = {
    id: Date.now() + rand(0,999),
    name: r.name, emoji: r.emoji,
    atk: r.stats.atk, def: r.stats.def,
    rarity: '普通', cls: 'r-common', type: r.type,
  };

  if (r.type === 'weapon') {
    GS.wpInv.push(item);
    toast('⚔️ 鍛造完成：' + r.name + '，存入背包', 'ok');
  } else {
    if (!GS.pl.armor || item.def > GS.pl.armor.def) {
      GS.pl.armor = item;
      toast('🛡️ 鍛造並裝備：' + r.name + '（DEF+' + item.def + '）', 'ok');
    } else {
      toast('🛡️ 鍛造完成：' + r.name + '（已有更好防具，未替換）', '');
    }
  }
  renderVillage();
}

/* ── KITCHEN ── */
function renderKitchen() {
  const grid = $('kitchen-grid');
  grid.innerHTML = '';
  KITCHEN_RECIPES.forEach(r => {
    const berryOk = GS.res.berries >= (r.cost.berries||0);
    const meatOk  = GS.res.meat    >= (r.cost.meat||0);
    const ok      = berryOk && meatOk;
    const costsHtml = makeCostTags({ berries: r.cost.berries||0, meat: r.cost.meat||0 });

    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML =
      `<div class="recipe-hdr">
         <span class="recipe-emoji">${r.emoji}</span>
         <div>
           <div class="recipe-name">${r.name}</div>
           <div class="recipe-stat">${r.desc} ×${r.qty}</div>
         </div>
       </div>
       <div class="recipe-costs">${costsHtml}</div>
       <button class="btn ${ok ? 'btn-green' : 'btn-red'}" ${ok ? '' : 'disabled'}>
         ${ok ? '🍳 烹飪' : '食材不足'}
       </button>`;
    card.querySelector('button').onclick = () => doCook(r.id);
    grid.appendChild(card);
  });
  renderPantry();
}

function doCook(id) {
  const r = KITCHEN_RECIPES.find(x => x.id === id);
  if (!r) return;
  if (GS.res.berries < (r.cost.berries||0) || GS.res.meat < (r.cost.meat||0)) return;

  GS.res.berries -= r.cost.berries || 0;
  GS.res.meat    -= r.cost.meat    || 0;
  GS.bag[r.key]  += r.qty;
  toast(r.emoji + ' 烹飪完成：' + r.name + ' ×' + r.qty, 'ok');
  renderKitchen();
  updateHeader();
}

function renderPantry() {
  const row = $('pantry-row');
  row.innerHTML = '';
  if (Object.values(GS.bag).every(v => v === 0)) {
    row.innerHTML = '<span style="color:var(--c-text-mut);font-size:.8rem">食物庫存為空</span>';
    return;
  }
  Object.entries(GS.bag).forEach(([k, qty]) => {
    const info = CONSUMABLES[k];
    const el = document.createElement('div');
    el.className = 'pantry-item';
    el.innerHTML = info.emoji + ' ' + info.name + ' <span class="pantry-qty">×' + qty + '</span>';
    row.appendChild(el);
  });
}

/* ── INVENTORY ── */
function renderInventory() {
  const p = GS.pl;

  $('eslot-weapon').innerHTML = p.weapon
    ? `<span class="${p.weapon.cls}">${p.weapon.emoji} ${p.weapon.name} <small>ATK+${p.weapon.atk}</small></span>`
    : '（空）';
  $('eslot-armor').innerHTML = p.armor
    ? `<span class="${p.armor.cls}">${p.armor.emoji} ${p.armor.name} <small>DEF+${p.armor.def}</small></span>`
    : '（空）';

  $('cstat-atk').textContent   = getAtk();
  $('cstat-def').textContent   = getDef();
  $('cstat-maxhp').textContent = p.maxHp;
  $('cstat-level').textContent = 'Lv.' + p.lv;

  const grid = $('bag-grid');
  $('bag-count').textContent = '(' + GS.wpInv.length + ')';
  grid.innerHTML = '';

  if (!GS.wpInv.length) {
    grid.innerHTML = '<div style="color:var(--c-text-mut);font-size:.8rem;grid-column:span 3">背包空空如也。去鍛造台製作或挑戰地下城取得武器！</div>';
    return;
  }

  // Sort by ATK descending
  const sorted = [...GS.wpInv].sort((a, b) => b.atk - a.atk);
  sorted.forEach(w => {
    const isEq = p.weapon && p.weapon.id === w.id;
    const div  = document.createElement('div');
    div.className = 'bag-item ' + w.cls + (isEq ? ' equipped-mark' : '');
    div.innerHTML =
      `<div class="bag-item-name ${w.cls}">${w.emoji} ${w.name}</div>
       <div class="bag-item-stat">ATK +${w.atk}</div>
       <div class="bag-item-stat">${w.rarity}</div>
       <button class="btn btn-gold bag-item-equip-btn" ${isEq ? 'disabled' : ''}>
         ${isEq ? '✓ 已裝備' : '裝備'}
       </button>`;
    div.querySelector('button').onclick = () => equipWeapon(w.id);
    grid.appendChild(div);
  });
}

function equipWeapon(id) {
  const w = GS.wpInv.find(x => x.id === id);
  if (!w) return;
  GS.pl.weapon = w;
  toast('⚔️ 已裝備：' + w.name + '（ATK+' + w.atk + '）', 'ok');
  renderInventory();
}

/* ── VILLAGE TABS ── */
function initVillageTabs() {
  document.querySelectorAll('.vnav[data-panel]').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.vnav[data-panel]').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.vpanel').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      $('panel-' + tab.dataset.panel).classList.add('active');
      renderVillage();
    };
  });
  $('btn-go-dungeon').onclick = enterDungeon;
  $('btn-go-focus').onclick   = () => setPhase('focus');
}

// ═══════════════════════════════════════════════════════════
//  DUNGEON
// ═══════════════════════════════════════════════════════════

function enterDungeon() {
  GS.dg.on    = true;
  GS.dg.floor = 0;
  GS.buffs    = [];
  setPhase('dungeon');
  loadFloor(0);
}

function loadFloor(i) {
  GS.dg.floor = i;
  const t = FLOORS[i];
  GS.dg.mob   = { ...t, maxHp: t.hp, hp: t.hp };

  $('floor-badge').textContent    = 'Floor ' + (i+1) + ' / ' + FLOORS.length;
  $('monster-sprite').textContent = t.emoji;
  $('monster-name').textContent   = t.name;
  $('monster-type').textContent   = t.boss ? '👑 BOSS 怪物' : '普通怪物';

  updateDungeonHP();
  updateHotbar();
  updateBuffsUI();
  $('combat-log').innerHTML = '';

  addLog('⚔️ ' + (i+1) + '樓出現了：' + t.name + '！', 'log-system');
  if (t.boss) addLog('👑 BOSS 戰！小心！', 'log-system');

  startCombat();
}

function startCombat() {
  stopCombat();
  GS.dg.plTick  = 0;
  GS.dg.mobTick = 0;

  // Both player and monster use 100ms tick with progress bars
  const TICK = 100;

  GS.dg.plIv = setInterval(() => {
    if (!GS.dg.on) return;
    GS.dg.plTick += TICK;
    $('speed-player').style.width = clamp(GS.dg.plTick / GS.dg.plSpd * 100, 0, 100) + '%';
    if (GS.dg.plTick >= GS.dg.plSpd) {
      GS.dg.plTick = 0;
      playerAttack();
    }
  }, TICK);

  GS.dg.mobIv = setInterval(() => {
    if (!GS.dg.on) return;
    GS.dg.mobTick += TICK;
    $('speed-monster').style.width = clamp(GS.dg.mobTick / GS.dg.mobSpd * 100, 0, 100) + '%';
    if (GS.dg.mobTick >= GS.dg.mobSpd) {
      GS.dg.mobTick = 0;
      monsterAttack();
    }
  }, TICK);

  GS.buffIv = setInterval(tickBuffs, 1000);
}

function stopCombat() {
  clearInterval(GS.dg.plIv);
  clearInterval(GS.dg.mobIv);
  clearInterval(GS.buffIv);
  GS.dg.plIv = GS.dg.mobIv = GS.buffIv = null;
  // Reset speed bars
  const sp = $('speed-player'), sm = $('speed-monster');
  if (sp) sp.style.width = '0%';
  if (sm) sm.style.width = '0%';
}

/* ── COMBAT ── */
function playerAttack() {
  const mob = GS.dg.mob;
  if (!mob || mob.hp <= 0) return;

  const dmg = Math.max(1, getAtk() - mob.def);
  mob.hp = Math.max(0, mob.hp - dmg);

  addLog('⚔️ 你攻擊了 ' + mob.name + '，造成 ' + dmg + ' 點傷害', 'log-player');

  // Shake monster sprite
  const s = $('monster-sprite');
  s.classList.remove('monster-hit');
  void s.offsetWidth;  // force reflow
  s.classList.add('monster-hit');
  setTimeout(() => s.classList.remove('monster-hit'), 360);

  // Floating damage number
  const r = s.getBoundingClientRect();
  dmgFloat('-' + dmg, r.left + rand(-15,15), r.top + rand(-25,0), '#5dade2');

  updateDungeonHP();
  if (mob.hp <= 0) onMobDeath();
}

function monsterAttack() {
  const mob = GS.dg.mob;
  if (!mob || mob.hp <= 0) return;

  const dmg = Math.max(1, mob.atk - getDef());
  GS.pl.hp = Math.max(0, GS.pl.hp - dmg);

  addLog('💀 ' + mob.name + ' 攻擊你，造成 ' + dmg + ' 點傷害', 'log-monster');

  const r = $('player-hp-fill').getBoundingClientRect();
  dmgFloat('-' + dmg, r.left + rand(0,40), r.top - 18, '#e74c3c');

  updateDungeonHP();
  updateHeader();
  if (GS.pl.hp <= 0) onPlayerDeath();
}

/* ── EVENTS ── */
function onMobDeath() {
  stopCombat();
  const mob = GS.dg.mob;
  addLog('✨ 擊敗 ' + mob.name + '！獲得 ' + mob.exp + ' EXP', 'log-system');
  addExp(mob.exp);

  // Loot drop
  if (Math.random() < mob.drop) {
    const drop = genDrop();
    GS.wpInv.push(drop);
    addLog('🎁 掉落：[' + drop.rarity + '] ' + drop.emoji + ' ' + drop.name + '（ATK+' + drop.atk + '）', 'log-loot');
    toast('🎁 [' + drop.rarity + '] ' + drop.name + ' ATK+' + drop.atk + '！', 'ok');
  }

  const next = GS.dg.floor + 1;
  if (next >= FLOORS.length) {
    setTimeout(onDungeonClear, 900);
  } else {
    addLog('📍 前往 ' + (next+1) + ' 樓...', 'log-system');
    setTimeout(() => loadFloor(next), 1600);
  }
}

function onPlayerDeath() {
  stopCombat();
  GS.dg.on = false;
  GS.buffs = [];
  GS.pl.hp = Math.max(1, Math.floor(GS.pl.maxHp * 0.3));

  modal(
    '<h2>💔 戰敗</h2>' +
    '<p>你在 <b>' + (GS.dg.floor+1) + '</b> 樓倒下了...</p>' +
    '<p style="color:var(--c-text-dim);font-size:.8rem;margin-top:8px">以 30% HP 返回村莊。補充裝備後再試試吧！</p>',
    () => { setPhase('village'); updateHeader(); }
  );
}

function onDungeonClear() {
  stopCombat();
  GS.dg.on = false;
  const bonusIron = rand(35, 65);
  const bonusWood = rand(25, 45);
  GS.res.iron += bonusIron;
  GS.res.wood += bonusWood;

  modal(
    '<h2>🏆 地下城制霸！</h2>' +
    '<p>你征服了全部 ' + FLOORS.length + ' 個樓層！</p>' +
    '<p style="color:var(--c-gold);margin-top:10px">🎊 通關獎勵：</p>' +
    '<p>⛏️ 鐵礦石 +' + bonusIron + '</p>' +
    '<p>🪵 木材 +' + bonusWood + '</p>' +
    '<p style="color:var(--c-text-dim);font-size:.78rem;margin-top:10px">繼續採集，打造更強武器，挑戰更高難度！</p>',
    () => { setPhase('village'); updateHeader(); }
  );
}

/* ── DUNGEON UI ── */
function updateDungeonHP() {
  const mob = GS.dg.mob;
  const p   = GS.pl;

  if (mob) {
    $('monster-hp-fill').style.width = clamp(mob.hp / mob.maxHp * 100, 0, 100) + '%';
    $('monster-hp-num').textContent  = mob.hp + '/' + mob.maxHp;
  }
  $('player-hp-fill').style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
  $('player-hp-num').textContent  = p.hp + '/' + p.maxHp;
}

function updateHotbar() {
  const bar = $('hotbar');
  bar.innerHTML = '';
  Object.entries(GS.bag).forEach(([k, qty]) => {
    const info = CONSUMABLES[k];
    const btn  = document.createElement('button');
    btn.className = 'hotbar-btn';
    btn.disabled  = qty <= 0;
    btn.innerHTML =
      '<span class="hb-emoji">' + info.emoji + '</span>' +
      '<span class="hb-name">'  + info.name  + '</span>' +
      '<span class="hb-qty">×'  + qty        + '</span>';
    btn.onclick = () => useItem(k);
    bar.appendChild(btn);
  });
}

function updateBuffsUI() {
  const row = $('buffs-row');
  row.innerHTML = '';
  GS.buffs.forEach(b => {
    const chip = document.createElement('div');
    chip.className = 'buff-chip';
    chip.textContent = b.name.slice(0,2) + ' ATK+' + b.val + '（' + b.left + 's）';
    row.appendChild(chip);
  });
}

/* ── ITEMS ── */
function useItem(k) {
  if (GS.bag[k] <= 0) return;
  const info = CONSUMABLES[k];
  GS.bag[k]--;

  if (info.eff.type === 'heal') {
    const actual = Math.min(info.eff.val, GS.pl.maxHp - GS.pl.hp);
    GS.pl.hp = Math.min(GS.pl.maxHp, GS.pl.hp + info.eff.val);
    addLog(info.emoji + ' 使用 ' + info.name + '，回復 ' + actual + ' HP', 'log-loot');
    toast(info.emoji + ' 回復 ' + actual + ' HP', 'ok');

  } else if (info.eff.type === 'healBuff') {
    const actual = Math.min(info.eff.heal, GS.pl.maxHp - GS.pl.hp);
    GS.pl.hp = Math.min(GS.pl.maxHp, GS.pl.hp + info.eff.heal);

    const existing = GS.buffs.find(b => b.stat === info.eff.buff.stat && b.name === info.name);
    if (existing) {
      existing.left = info.eff.buff.dur;
    } else {
      GS.buffs.push({ name: info.name, stat: info.eff.buff.stat, val: info.eff.buff.val, left: info.eff.buff.dur });
    }
    addLog(info.emoji + ' 使用 ' + info.name + '，回復 ' + actual + ' HP ＋ ATK 提升！', 'log-loot');
    toast(info.emoji + ' +' + actual + 'HP & ATK+' + info.eff.buff.val + '！', 'ok');
  }

  updateDungeonHP();
  updateHeader();
  updateHotbar();
  updateBuffsUI();
}

function tickBuffs() {
  GS.buffs = GS.buffs.filter(b => { b.left--; return b.left > 0; });
  updateBuffsUI();
}

/* ── LOOT ── */
function genDrop() {
  // Weighted random rarity
  const total = RARITIES.reduce((s, r) => s + r.w, 0);
  let roll = rand(1, total);
  let picked = RARITIES[0];
  for (const r of RARITIES) {
    if (roll <= r.w) { picked = r; break; }
    roll -= r.w;
  }
  return {
    id:     Date.now() + rand(0, 9999),
    name:   WP_NAMES[rand(0, WP_NAMES.length - 1)],
    emoji:  WP_EMOJI[rand(0, WP_EMOJI.length - 1)],
    atk:    rand(picked.atkL, picked.atkH),
    def: 0, type: 'weapon',
    rarity: picked.name,
    cls:    picked.cls,
  };
}

/* ── COMBAT LOG ── */
function addLog(msg, cls) {
  const log = $('combat-log');
  const el  = document.createElement('div');
  el.className   = 'log-line ' + (cls || '');
  el.textContent = msg;
  log.appendChild(el);
  while (log.children.length > 60) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

/* ── FLEE ── */
function initFlee() {
  $('btn-flee').onclick = () => {
    stopCombat();
    GS.dg.on = false;
    GS.buffs = [];
    addLog('🏃 你撤退了...', 'log-system');
    modal(
      '<h2>🏃 撤退成功</h2>' +
      '<p>你從地下城平安撤退。</p>' +
      '<p style="color:var(--c-text-dim);font-size:.8rem;margin-top:8px">補充裝備後可以再次挑戰！</p>',
      () => setPhase('village')
    );
  };
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════

function init() {
  initParticles();
  initFocus();
  initVillageTabs();
  initFlee();

  // Render village content so it's ready when user switches
  renderVillage();

  setPhase('focus');
  updateHeader();

  setTimeout(() => toast('🎮 歡迎！開始計時採集資源，或直接前往村莊鍛造！', ''), 900);
}

document.addEventListener('DOMContentLoaded', init);
