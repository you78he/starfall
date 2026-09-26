/* ============================================================================
 * 星陨幸存者 · STARFALL SURVIVORS
 * content.js — 内容层（全部数值配置）
 *   角色 / 难度 / 武器 / 被动 / 敌人 / Boss / 波次曲线 / 星港商店
 * ==========================================================================*/
'use strict';

/* ============================================================== 角色 */
var CHARACTERS = [
  {
    id: 'vanguard', name: '游侠', en: 'VANGUARD', glyph: '◈', color: '#4ff0ff',
    tag: '均衡 · 火力',
    desc: '星港最后的正规军。稳健的生命与伤害，任何局面都能应付。',
    stats: { hpMax: 115, speed: 206, dmgMul: 1.06, critChance: 0.08, areaMul: 1.0, pickup: 78 },
    start: 'bolt',
    perk: '初始武器：星尘箭 · 暴击率 +3%'
  },
  {
    id: 'pyro', name: '焚天', en: 'PYRO', glyph: '❂', color: '#ff8a3d',
    tag: '重装 · 范围',
    desc: '把自己点燃的疯子。血量厚、光环大，靠近他就是靠近火。',
    stats: { hpMax: 158, speed: 189, dmgMul: 0.94, areaMul: 1.22, armor: 2, pickup: 70 },
    start: 'aura',
    perk: '初始武器：灼热光环 · 护甲 +2'
  },
  {
    id: 'wraith', name: '幻影', en: 'WRAITH', glyph: '⌖', color: '#b07dff',
    tag: '敏捷 · 暴击',
    desc: '半实体化的刺客。跑得最快，冲刺最勤，但被打到会很痛。',
    stats: { hpMax: 92, speed: 232, dmgMul: 1.0, critChance: 0.2, critMul: 1.9, pickup: 112, dashCd: 0.72 },
    start: 'orbit',
    perk: '初始武器：环刃 · 冲刺冷却 -40%'
  }
];

function getChar(id) {
  for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].id === id) return CHARACTERS[i];
  return CHARACTERS[0];
}

/* ============================================================== 难度
 * 不只是数值放大：高难度会额外强化精英、给精英加词缀、强化 Boss，
 * 让三个难度在"玩法压力"上也有区别。
 * ======================================================================== */
var DIFFICULTIES = [
  {
    id: 'normal', name: '标准', desc: '正常节奏',
    hpMul: 1.00, spawnMul: 1.00, dmgMul: 1.00, goldMul: 1.00, xpMul: 1.00,
    eliteMul: 1.0, affixBonus: 0, bossHpMul: 1.00
  },
  {
    id: 'abyss', name: '深渊', desc: '精英成群',
    hpMul: 1.55, spawnMul: 1.35, dmgMul: 1.30, goldMul: 1.50, xpMul: 1.15,
    eliteMul: 1.7, affixBonus: 0, bossHpMul: 1.15
  },
  {
    id: 'annihil', name: '湮灭', desc: '精英双词缀',
    hpMul: 2.30, spawnMul: 1.75, dmgMul: 1.70, goldMul: 2.20, xpMul: 1.35,
    eliteMul: 2.6, affixBonus: 1, bossHpMul: 1.30
  }
];

/* ============================================================== 武器
 * kind: projectile | aura | orbit | chain | homing | nova | mine | beam
 * 每个武器 = base + growth[]（每级覆盖若干字段）+ labels（用于自动生成升级说明）
 * ======================================================================== */
var WEAPONS = {

  /* ---------------- 星尘箭 ---------------- */
  bolt: {
    id: 'bolt', name: '星尘箭', glyph: '➤', color: '#7df9ff', kind: 'projectile',
    desc: '向最近的敌人发射穿透星光箭。',
    labels: { count: '弹幕', dmg: '伤害', cd: '冷却', pierce: '穿透', speed: '弹速', slowOnHit: '★ 命中减速 15%（1.5 秒）' },
    flags: ['slowOnHit'],
    base: { count: 1, dmg: 12, cd: 0.70, pierce: 1, speed: 580, spread: 0.18, life: 1.1, slowMul: 0.85, slowDur: 1.5 },
    growth: [
      {},
      { count: 1 },
      { count: 2 },
      { dmg: 4, pierce: 1 },
      { count: 3 },
      { dmg: 5 },
      { count: 4, pierce: 1, slowOnHit: 1 },
      { count: 5, dmg: 6, cd: -0.10 }
    ],
    evo: {
      name: '星陨风暴', glyph: '✷', color: '#9beeff', requires: 'pierce', needName: '相位弹头',
      desc: '八道追猎星陨齐射，命中后炸开星尘，并附带减速。',
      stats: { count: 8, dmg: 34, cd: 0.40, pierce: 4, speed: 640, spread: 0.30, life: 1.4, aoe: 66, turn: 2.4, slowOnHit: 1 }
    }
  },

  /* ---------------- 灼热光环 ---------------- */
  aura: {
    id: 'aura', name: '灼热光环', glyph: '◎', color: '#ff9a3d', kind: 'aura',
    desc: '身周持续燃烧，周期性灼烧范围内的一切。',
    labels: { radius: '范围', dmg: '每跳伤害', tick: '跳动间隔', slowOnHit: '★ 灼烧使敌人减速 12%', percentHp: '★ 追加最大生命 1.2%/秒 的伤害' },
    flags: ['slowOnHit', 'percentHp'],
    base: { radius: 92, dmg: 9, tick: 0.5, slowMul: 0.88, slowDur: 0.4 },
    growth: [
      {},
      { radius: 12 },
      { dmg: 3 },
      { radius: 16, dmg: 2, slowOnHit: 1 },
      { dmg: 4 },
      { radius: 22 },
      { dmg: 6 },
      { radius: 26, dmg: 8, percentHp: 0.012 }
    ],
    evo: {
      name: '超新星核心', glyph: '❂', color: '#ffb066', requires: 'area', needName: '扩幅透镜',
      desc: '核心坍缩：光环范围暴涨、结算快 2 倍，并持续蒸发敌人。',
      stats: { radius: 190, dmg: 26, tick: 0.22, slowOnHit: 1, percentHp: 0.022 }
    }
  },

  /* ---------------- 环刃 ---------------- */
  orbit: {
    id: 'orbit', name: '环刃', glyph: '✳', color: '#b07dff', kind: 'orbit',
    desc: '在身周召唤旋转的能量刃，接触即造成伤害。',
    labels: { count: '刃数', radius: '轨道半径', dmg: '伤害', rot: '转速', bigBlade: '★ 刃体变大 20%', lifesteal: '★ 命中回复 1 点生命（每 0.6 秒）' },
    flags: ['bigBlade', 'lifesteal'],
    base: { count: 2, radius: 88, dmg: 15, rot: 2.3, hitCd: 0.42, size: 11 },
    growth: [
      {},
      { count: 1 },
      { dmg: 4 },
      { count: 1, radius: 12, bigBlade: 1 },
      { dmg: 6, rot: 0.3 },
      { count: 1, dmg: 5 },
      { count: 1, radius: 14, dmg: 6 },
      { count: 2, dmg: 10, rot: 0.5, lifesteal: 1 }
    ],
    evo: {
      name: '死亡轮盘', glyph: '✺', color: '#d5a0ff', requires: 'haste', needName: '超频芯片',
      desc: '十二把巨刃双层反向旋转，所过之处尽皆绞碎，并持续吸取生命。',
      stats: { count: 12, radius: 118, dmg: 52, rot: 3.3, hitCd: 0.28, size: 16, bigBlade: 1, lifesteal: 1, doubleRing: 1 }
    }
  },

  /* ---------------- 雷链 ---------------- */
  chain: {
    id: 'chain', name: '雷链', glyph: '⚡', color: '#ffe066', kind: 'chain',
    desc: '释放闪电，在敌人之间跳跃传导。',
    labels: { count: '跳跃次数', dmg: '伤害', cd: '冷却', range: '跳跃距离', search: '索敌范围', falloff: '传导衰减', stun: '★ 命中麻痹 0.25 秒', forceCrit: '★ 雷链必定暴击' },
    flags: ['stun', 'forceCrit'],
    base: { count: 2, dmg: 17, cd: 1.6, range: 250, falloff: 0.88, search: 560 },
    growth: [
      {},
      { count: 1 },
      { dmg: 6 },
      { count: 1, falloff: 0.05 },
      { dmg: 8, cd: -0.15, stun: 1 },
      { count: 1 },
      { dmg: 12, range: 45, search: 80 },
      { count: 2, dmg: 14, falloff: 0.08, forceCrit: 1 }
    ],
    evo: {
      name: '天雷审判', glyph: '⚡', color: '#fff2a8', requires: 'critdmg', needName: '破坏增幅',
      desc: '天罚降临：闪电跳跃 12 次且不衰减，必定暴击并长时间麻痹。',
      stats: { count: 12, dmg: 74, cd: 0.85, range: 340, falloff: 0.97, search: 820, stun: 1, forceCrit: 1 }
    }
  },

  /* ---------------- 追猎飞弹 ---------------- */
  homing: {
    id: 'homing', name: '追猎飞弹', glyph: '✦', color: '#ff4fa3', kind: 'homing',
    desc: '发射自动追踪的飞弹，命中后范围爆炸。',
    labels: { count: '弹数', dmg: '伤害', cd: '冷却', aoe: '爆炸范围', turn: '转向', burnZone: '★ 爆炸留下 3 秒燃烧区', knockHard: '★ 爆炸击退翻倍' },
    flags: ['burnZone', 'knockHard'],
    base: { count: 2, dmg: 26, cd: 1.5, aoe: 52, speed: 330, turn: 3.4, life: 3.2 },
    growth: [
      {},
      { count: 1 },
      { dmg: 8 },
      { aoe: 10, turn: 0.6, burnZone: 1 },
      { count: 1, dmg: 10 },
      { cd: -0.25, aoe: 12 },
      { count: 1, dmg: 12 },
      { count: 2, dmg: 16, aoe: 16, turn: 0.8, knockHard: 1 }
    ],
    evo: {
      name: '猎杀蜂群', glyph: '✧', color: '#ff9ecb', requires: 'greed', needName: '贪婪回路',
      desc: '蜂群倾巢而出：八发重型飞弹，命中后炸开并分裂出子母弹。',
      stats: { count: 8, dmg: 46, cd: 0.85, aoe: 96, speed: 420, turn: 5.4, life: 4, burnZone: 1, knockHard: 1, split: 3 }
    }
  },

  /* ---------------- 脉冲新星 ---------------- */
  nova: {
    id: 'nova', name: '脉冲新星', glyph: '◉', color: '#4ff0ff', kind: 'nova',
    desc: '周期性释放扩散冲击波，击退并撕裂周围敌人。',
    labels: { dmg: '伤害', cd: '冷却', radius: '半径', knock: '击退', slowOnHit: '★ 冲击波减速 35%（1.5 秒）', doubleNova: '★ 连续爆发 2 次' },
    flags: ['slowOnHit', 'doubleNova'],
    base: { dmg: 34, cd: 4.2, radius: 210, knock: 190, width: 26, slowMul: 0.65, slowDur: 1.5 },
    growth: [
      {},
      { radius: 26 },
      { dmg: 12 },
      { cd: -0.5 },
      { radius: 34, dmg: 14 },
      { knock: 70, slowOnHit: 1 },
      { dmg: 22, radius: 30 },
      { dmg: 30, cd: -0.7, width: 14, doubleNova: 1 }
    ],
    evo: {
      name: '奇点爆发', glyph: '◍', color: '#8ef7ff', requires: 'power', needName: '力量核心',
      desc: '制造坍缩奇点：先把敌人拽向中心，再以毁灭性冲击波炸开并点燃。',
      stats: { dmg: 130, cd: 2.3, radius: 430, knock: 360, width: 34, slowOnHit: 1, doubleNova: 1, pull: 300, burnZone: 1 }
    }
  },

  /* ---------------- 虚空地雷 ---------------- */
  mine: {
    id: 'mine', name: '虚空地雷', glyph: '⬢', color: '#8bff9f', kind: 'mine',
    desc: '沿途布置地雷，敌人靠近即引爆。',
    labels: { dmg: '伤害', cd: '布设间隔', aoe: '爆炸范围', count: '同时存在', arm: '布设时间', burnZone: '★ 爆炸点燃地面 3 秒', chainBoom: '★ 连锁引爆附近地雷' },
    flags: ['burnZone', 'chainBoom'],
    base: { dmg: 48, cd: 2.0, aoe: 78, count: 4, arm: 0.6, life: 14, drop: 30 },
    growth: [
      {},
      { count: 1 },
      { dmg: 14 },
      { aoe: 12, burnZone: 1 },
      { count: 1, dmg: 16, cd: -0.3 },
      { aoe: 14, arm: -0.2 },
      { count: 2, dmg: 22, chainBoom: 1 },
      { count: 2, dmg: 30, aoe: 18 }
    ],
    evo: {
      name: '湮灭雷区', glyph: '⬣', color: '#c9ffd6', requires: 'magnet', needName: '引力拾取',
      desc: '布雷场自行追猎敌人，连锁引爆并把整片战场变成火海。',
      stats: { dmg: 160, cd: 0.95, aoe: 150, count: 10, arm: 0.25, life: 20, drop: 60, burnZone: 1, chainBoom: 1, seek: 260 }
    }
  },

  /* ---------------- 湮灭射线 ---------------- */
  beam: {
    id: 'beam', name: '湮灭射线', glyph: '═', color: '#ff3d7a', kind: 'beam',
    desc: '持续锁定最近敌人的高能射线。',
    labels: { dps: '每秒伤害', length: '长度', width: '宽度', targets: '同时目标', pierceAll: '★ 穿透一切（不再被首个敌人阻挡）', vuln: '★ 命中使目标易伤 +15%' },
    flags: ['pierceAll', 'vuln'],
    base: { dps: 44, length: 460, width: 9, tick: 0.16, targets: 1 },
    growth: [
      {},
      { length: 60 },
      { dps: 14 },
      { targets: 1, pierceAll: 1 },
      { dps: 20, width: 3 },
      { length: 80, dps: 18 },
      { targets: 1, dps: 24, vuln: 1 },
      { dps: 40, width: 5, length: 100 }
    ],
    evo: {
      name: '末日光束', glyph: '≡', color: '#ff8fb0', requires: 'wisdom', needName: '星图解析',
      desc: '四道末日光束同时扫射并缓慢旋转，被照到的一切都在融化。',
      stats: { dps: 195, length: 720, width: 14, tick: 0.11, targets: 4, pierceAll: 1, vuln: 1, sweep: 1.1 }
    }
  }
};

var WEAPON_IDS = ['bolt', 'aura', 'orbit', 'chain', 'homing', 'nova', 'mine', 'beam'];
var WEAPON_MAX_LV = 8;

/** 计算某武器在某等级下的实际参数 */
function weaponStats(id, lv) {
  var def = WEAPONS[id];
  if (!def) return null;
  var s = {};
  for (var k in def.base) s[k] = def.base[k];
  for (var i = 0; i < lv && i < def.growth.length; i++) {
    var g = def.growth[i];
    for (var k2 in g) {
      // 数值字段叠加（派生自 1 的布尔标记按"置位"处理）
      if (typeof g[k2] === 'number' && typeof s[k2] === 'number') s[k2] += g[k2];
      else s[k2] = g[k2];
    }
  }
  return s;
}

/** 进化形态参数：满级参数 + 进化覆盖值（绝对覆盖，不含任何等级判断） */
function evolvedStats(id) {
  var def = WEAPONS[id];
  if (!def || !def.evo) return null;
  var s = weaponStats(id, WEAPON_MAX_LV);
  for (var k in def.evo.stats) s[k] = def.evo.stats[k];
  return s;
}

/** 某武器当前是否满足进化条件 */
function canEvolve(id, lv, passives) {
  var def = WEAPONS[id];
  if (!def || !def.evo) return false;
  if (lv < WEAPON_MAX_LV) return false;
  return !!(passives && passives[def.evo.requires] > 0);
}

/** 显示用：武器（或进化形态）的名称 / 图标 / 颜色 */
function weaponDisplay(id, evo) {
  var def = WEAPONS[id];
  if (evo && def.evo) return { name: def.evo.name, glyph: def.evo.glyph, color: def.evo.color };
  return { name: def.name, glyph: def.glyph, color: def.color };
}

/** 自动生成“升级到 lv 级”的差异说明 */
var LOWER_IS_BETTER = { cd: 1, tick: 1, arm: 1, interval: 1 };
function weaponDeltaText(id, lv) {
  if (lv > WEAPON_MAX_LV) return '';
  var def = WEAPONS[id];
  var a = weaponStats(id, lv - 1), b = weaponStats(id, lv);
  var flags = def.flags || [];
  var parts = [];
  for (var k in b) {
    if (typeof b[k] !== 'number' || typeof a[k] !== 'number') continue;
    if (b[k] === a[k]) continue;
    // 特殊标记：只显示说明文字，不显示数字（数字对玩家没有意义）
    if (flags.indexOf(k) >= 0) { if (b[k]) parts.push(def.labels[k] || k); continue; }
    var d = b[k] - a[k];
    var label = def.labels[k] || k;
    var sign = d > 0 ? '+' : '';
    var val;
    if (k === 'falloff') val = (d > 0 ? '+' : '') + Math.round(d * 100) + '%';
    else if (Math.abs(d) < 1) val = sign + d.toFixed(2);
    else val = sign + Math.round(d);
    if (LOWER_IS_BETTER[k]) val = (d < 0 ? '' : '+') + (Math.abs(d) < 1 ? d.toFixed(2) : Math.round(d));
    parts.push('<b>' + label + '</b> ' + val);
  }
  return parts.join(' · ');
}

/* ============================================================== 被动 */
var PASSIVES = {
  power:   { id: 'power',   name: '力量核心', glyph: '⚔', color: '#ff6b8a', stat: 'dmgMul',    add: 0.12,  maxLv: 8,  desc: '全部伤害 +12%' },
  haste:   { id: 'haste',   name: '超频芯片', glyph: '⏱', color: '#7df9ff', stat: 'hasteMul',  add: 0.11,  maxLv: 8,  desc: '攻击速度 +11%' },
  area:    { id: 'area',    name: '扩幅透镜', glyph: '◯', color: '#a06bff', stat: 'areaMul',   add: 0.10,  maxLv: 8,  desc: '技能范围 +10%' },
  boots:   { id: 'boots',   name: '离子推进', glyph: '⏩', color: '#4ff0ff', stat: 'speedMul',  add: 0.08,  maxLv: 6,  desc: '移动速度 +8%' },
  vigor:   { id: 'vigor',   name: '生命基质', glyph: '❤', color: '#ff5570', stat: 'hpMax',     add: 24,    maxLv: 8,  desc: '最大生命 +24（立即回复同样数值）' },
  regen:   { id: 'regen',   name: '纳米修复', glyph: '✚', color: '#8bff9f', stat: 'regen',     add: 0.55,  maxLv: 6,  desc: '每秒回复 +0.55 生命' },
  armor:   { id: 'armor',   name: '复合装甲', glyph: '⛨', color: '#9aa8c8', stat: 'armor',     add: 1.6,   maxLv: 7,  desc: '护甲 +1.6（每次受击减免固定伤害）' },
  crit:    { id: 'crit',    name: '瞄准模块', glyph: '✛', color: '#ffd166', stat: 'critChance', add: 0.055, maxLv: 7,  desc: '暴击率 +5.5%' },
  critdmg: { id: 'critdmg', name: '破坏增幅', glyph: '✹', color: '#ff8a3d', stat: 'critMul',   add: 0.30,  maxLv: 6,  desc: '暴击伤害 +30%' },
  magnet:  { id: 'magnet',  name: '引力拾取', glyph: '⊙', color: '#4ff0ff', stat: 'pickupMul', add: 0.30,  maxLv: 5,  desc: '拾取范围 +30%' },
  wisdom:  { id: 'wisdom',  name: '星图解析', glyph: '✧', color: '#b07dff', stat: 'xpMul',     add: 0.17,  maxLv: 6,  desc: '获得经验 +17%' },
  luck:    { id: 'luck',    name: '命运骰子', glyph: '⚄', color: '#7dff9b', stat: 'luck',      add: 0.14,  maxLv: 5,  desc: '幸运 +14%（更好的选项、更多金币）' },
  pierce:  { id: 'pierce',  name: '相位弹头', glyph: '⇉', color: '#ff4fa3', stat: 'pierceBonus', add: 1,   maxLv: 4,  desc: '所有弹幕穿透 +1' },
  greed:   { id: 'greed',   name: '贪婪回路', glyph: '◈', color: '#ffd166', stat: 'goldMul',   add: 0.16,  maxLv: 6,  desc: '击杀掉落金币 +16%' }
};
var PASSIVE_IDS = Object.keys(PASSIVES);

/* ============================================================== 敌人 */
var ENEMIES = {
  grunt: {
    id: 'grunt', name: '蚀骨兵', color: '#ff6b8a', shape: 3,
    hp: 15, speed: 64, dmg: 9, radius: 12, xp: 1, armor: 0, minWave: 1, weight: 10, behavior: 'chase'
  },
  swarm: {
    id: 'swarm', name: '蜂刺', color: '#ffd166', shape: 3,
    hp: 7, speed: 116, dmg: 6, radius: 8.5, xp: 1, armor: 0, minWave: 2, weight: 9, behavior: 'chase', wobble: 3.2
  },
  shooter: {
    id: 'shooter', name: '孢子射手', color: '#8bff9f', shape: 4,
    hp: 24, speed: 54, dmg: 8, radius: 13, xp: 3, armor: 0, minWave: 3, weight: 5.5, behavior: 'shooter',
    ranged: { range: 330, keep: 240, cd: 2.3, speed: 215, dmg: 9, radius: 6, color: '#b6ffc4' }
  },
  tank: {
    id: 'tank', name: '铁骸', color: '#9aa8c8', shape: 5,
    hp: 82, speed: 45, dmg: 20, radius: 21, xp: 5, armor: 3, minWave: 4, weight: 3.6, behavior: 'chase'
  },
  charger: {
    id: 'charger', name: '冲锋兽', color: '#ff8a3d', shape: 3,
    hp: 34, speed: 68, dmg: 16, radius: 15, xp: 3, armor: 1, minWave: 5, weight: 4, behavior: 'charger',
    charge: { cd: 3.2, wind: 0.5, dur: 0.75, mul: 3.4 }
  },
  splitter: {
    id: 'splitter', name: '裂殖体', color: '#c77dff', shape: 6,
    hp: 44, speed: 60, dmg: 12, radius: 17, xp: 4, armor: 1, minWave: 6, weight: 3.2, behavior: 'chase',
    split: { type: 'swarm', n: 3, hpMul: 1.1 }
  },
  weaver: {
    id: 'weaver', name: '织网者', color: '#4ff0ff', shape: 3,
    hp: 32, speed: 96, dmg: 10, radius: 12, xp: 3, armor: 0, minWave: 7, weight: 3.4, behavior: 'orbiter',
    orbit: { keep: 190, band: 70, strafe: 1.5 }
  },
  bomber: {
    id: 'bomber', name: '自爆囊', color: '#ff4d4d', shape: 4,
    hp: 28, speed: 124, dmg: 12, radius: 13.5, xp: 3, armor: 0, minWave: 8, weight: 3.2, behavior: 'chase',
    explode: { radius: 96, dmg: 34, fuse: 0.55 }
  },
  healer: {
    id: 'healer', name: '谐振体', color: '#7dff9b', shape: 5,
    hp: 50, speed: 52, dmg: 8, radius: 15, xp: 5, armor: 2, minWave: 9, weight: 2.2, behavior: 'chase',
    heal: { radius: 210, hps: 11 }
  },
  juggernaut: {
    id: 'juggernaut', name: '破城者', color: '#ff2d6b', shape: 6,
    hp: 240, speed: 40, dmg: 26, radius: 27, xp: 12, armor: 6, minWave: 11, weight: 1.6, behavior: 'chase'
  }
};
var ENEMY_IDS = Object.keys(ENEMIES);
var ELITE = { hpMul: 3.1, speedMul: 1.14, radiusMul: 1.45, dmgMul: 1.25, xpMul: 6, armorAdd: 3, gold: 1, color: '#ffd166' };

/* ============================================================== BOSS
 * 每招都有 wind（预警时间，秒）：出手前会显示明确的落点/方向提示，
 * 且预警期间 Boss 会减速——玩家有反应窗口，而不是被"瞬间发生"的东西打。
 * charge 有 dist 上限，避免冲出场外。
 * ======================================================================== */
var BOSSES = [
  {
    id: 'colossus', name: '熔核巨像', en: 'MOLTEN COLOSSUS', color: '#ff7a3d',
    hp: 1900, radius: 46, dmg: 42, xp: 190, gold: 75, speed: 58, shape: 6,
    attacks: [
      { type: 'radial', cd: 4.4, wind: 0.5, count: 16, speed: 200, dmg: 21, radius: 8, color: '#ffb066' },
      { type: 'aimed',  cd: 4.0, wind: 0.42, count: 6, spread: 0.5, speed: 265, dmg: 23, radius: 9, color: '#ffd166' },
      { type: 'charge', cd: 7.6, wind: 0.95, dur: 1.0, mul: 5.0, dist: 640, dmg: 48 },
      { type: 'summon', cd: 10.5, wind: 0.6, type2: 'swarm', n: 7 }
    ]
  },
  {
    id: 'weaver', name: '虚空织者', en: 'VOID WEAVER', color: '#b07dff',
    hp: 3900, radius: 50, dmg: 48, xp: 330, gold: 125, speed: 64, shape: 4,
    attacks: [
      { type: 'spiral', cd: 6.2, wind: 0.6, count: 30, speed: 175, dmg: 24, radius: 8, color: '#d5b0ff', steps: 7, stepDelay: 0.09 },
      { type: 'blink', cd: 7.5, wind: 0.25 },
      { type: 'summon', cd: 11.5, wind: 0.6, type2: 'shooter', n: 5 },
      { type: 'radial', cd: 5.2, wind: 0.5, count: 22, speed: 210, dmg: 23, radius: 8, color: '#d5b0ff' }
    ]
  },
  {
    id: 'annihilator', name: '湮灭之眼', en: 'ANNIHILATOR', color: '#ff3d7a',
    hp: 7200, radius: 56, dmg: 58, xp: 540, gold: 210, speed: 56, shape: 8,
    attacks: [
      { type: 'sweep', cd: 6.6, wind: 0.7, count: 34, speed: 230, dmg: 28, radius: 8, color: '#ff8fb0', arc: 2.3 },
      { type: 'radial', cd: 4.8, wind: 0.5, count: 28, speed: 230, dmg: 25, radius: 8, color: '#ff8fb0' },
      { type: 'homing', cd: 8.5, wind: 0.55, count: 6, speed: 185, dmg: 31, radius: 10, color: '#ffd166', turn: 1.7 },
      { type: 'summon', cd: 12.5, wind: 0.6, type2: 'charger', n: 5 }
    ]
  },
  {
    id: 'sovereign', name: '星陨之主', en: 'STARFALL SOVEREIGN', color: '#7df9ff',
    hp: 12000, radius: 62, dmg: 66, xp: 900, gold: 340, speed: 60, shape: 6,
    attacks: [
      { type: 'sweep',  cd: 6.2, wind: 0.7, count: 36, speed: 240, dmg: 30, radius: 9, color: '#9beaff', arc: 2.5 },
      { type: 'radial', cd: 4.6, wind: 0.5, count: 32, speed: 240, dmg: 27, radius: 9, color: '#9beaff' },
      { type: 'charge', cd: 7.0, wind: 0.9, dur: 1.1, mul: 5.2, dist: 680, dmg: 60 },
      { type: 'homing', cd: 8.0, wind: 0.55, count: 7, speed: 190, dmg: 34, radius: 10, color: '#ffd166', turn: 1.8 },
      { type: 'summon', cd: 12.0, wind: 0.6, type2: 'juggernaut', n: 3 }
    ]
  }
];
var BOSS_TYPES = ['radial', 'aimed', 'spiral', 'sweep', 'homing', 'summon', 'blink', 'charge'];

function bossForWave(wave) {
  var idx = Math.max(0, Math.round(wave / 5) - 1) % BOSSES.length;
  return BOSSES[idx];
}

/** 通关波次：击破这一波的 Boss 即通关 */
var FINAL_WAVE = 20;
/** 单局遗物上限（刻意做得稀有） */
var RELIC_MAX_PER_RUN = 6;

/* ============================================================== 波次曲线 */
function waveConfig(wave) {
  var isBoss = wave % 5 === 0;
  var hpMul = (1 + wave * 0.30 + Math.pow(wave, 1.55) * 0.055);
  var dmgMul = 1 + wave * 0.085;
  var pool = [];
  for (var i = 0; i < ENEMY_IDS.length; i++) {
    var e = ENEMIES[ENEMY_IDS[i]];
    if (e.minWave > wave) continue;
    // 新敌人权重随波次上升
    var freshness = clamp(1 - (wave - e.minWave) * 0.02, 0.55, 1.25);
    pool.push({ id: e.id, weight: e.weight * freshness });
  }
  if (!pool.length) pool.push({ id: 'grunt', weight: 1 });
  // 后期弱化最基础的杂兵
  if (wave > 6) for (var j = 0; j < pool.length; j++) if (pool[j].id === 'grunt') pool[j].weight *= clamp(1 - (wave - 6) * 0.05, 0.25, 1);
  return {
    wave: wave,
    isBoss: isBoss,
    dur: isBoss ? 42 : 30,
    budget: Math.round((16 + wave * 7.4 + Math.pow(wave, 1.35)) * 1.0),
    interval: Math.max(0.16, 0.82 - wave * 0.035),
    burst: 1 + Math.floor(wave / 3),
    hpMul: hpMul,
    dmgMul: dmgMul,
    speedMul: 1 + Math.min(0.45, wave * 0.022),
    eliteChance: clamp(0.008 + wave * 0.016, 0, 0.3),
    xpMul: 1 + wave * 0.05,
    pool: pool
  };
}

function pickWeighted(pool) {
  var total = 0, i;
  for (i = 0; i < pool.length; i++) total += pool[i].weight;
  var r = Math.random() * total;
  for (i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) return pool[i].id; }
  return pool[pool.length - 1].id;
}

/* ============================================================== 经验曲线 */
function xpNeeded(level) {
  return Math.floor(6 + level * 5.2 + Math.pow(level, 1.85) * 2.1);
}

/* ============================================================== 商店 */
var SHOP = [
  { id: 'ammo',    name: '强化火药', glyph: '⚔', stat: 'dmgMul',    add: 0.05, maxLv: 10, base: 55,  step: 1.55, desc: '全部伤害 +5%' },
  { id: 'hull',    name: '生命舱段', glyph: '❤', stat: 'hpMax',     add: 10,   maxLv: 10, base: 50,  step: 1.5,  desc: '最大生命 +10' },
  { id: 'servo',   name: '伺服腿',   glyph: '⏩', stat: 'speedMul',  add: 0.025, maxLv: 8, base: 70,  step: 1.6,  desc: '移动速度 +2.5%' },
  { id: 'plating', name: '外挂装甲', glyph: '⛨', stat: 'armor',     add: 1,    maxLv: 6,  base: 90,  step: 1.65, desc: '护甲 +1' },
  { id: 'lens',    name: '解析棱镜', glyph: '✧', stat: 'xpMul',     add: 0.05, maxLv: 8,  base: 65,  step: 1.5,  desc: '获得经验 +5%' },
  { id: 'magnet2', name: '引力井',   glyph: '⊙', stat: 'pickupMul', add: 0.10, maxLv: 6,  base: 55,  step: 1.5,  desc: '拾取范围 +10%' },
  { id: 'fortune', name: '幸运星',   glyph: '◈', stat: 'goldMul',   add: 0.07, maxLv: 8,  base: 80,  step: 1.6,  desc: '金币收益 +7%' },
  { id: 'chip',    name: '起始芯片', glyph: '⚡', stat: 'startLevel', add: 1,   maxLv: 3,  base: 220, step: 2.4,  desc: '开局等级 +1' },
  { id: 'reroll',  name: '重掷器',   glyph: '↻', stat: 'rerolls',   add: 1,    maxLv: 3,  base: 120, step: 2.0,  desc: '每局额外重掷 +1' },
  { id: 'core',    name: '复活核心', glyph: '✚', stat: 'revives',   add: 1,    maxLv: 2,  base: 500, step: 3.0,  desc: '每局复活 +1' }
];

function shopCost(item, lv) { return Math.round(item.base * Math.pow(item.step, lv)); }

/* ============================================================== 局内补给商店
 * 用「本局金币」购买，只在本局生效——金币因此有了消耗渠道，
 * 无尽模式也可以放心掉金币（不会一把就把永久商店刷满）。
 * stats 型效果会计入 recomputeStats；type 型是即时效果。
 * ======================================================================== */
var RUN_SHOP = [
  { id: 'heal',   name: '应急修复', glyph: '✚', color: '#8bff9f', type: 'heal',
    desc: '立刻回复 35% 最大生命', base: 55, step: 1.22, max: 99 },
  { id: 'dmg',    name: '弹道强化', glyph: '⚔', color: '#ff6b8a', stats: { dmgMul: 1.08 },
    desc: '本局伤害 +8%', base: 95, step: 1.30, max: 12 },
  { id: 'haste',  name: '超频模块', glyph: '⏱', color: '#7df9ff', stats: { hasteMul: 1.08 },
    desc: '本局攻击速度 +8%', base: 95, step: 1.30, max: 12 },
  { id: 'hp',     name: '生命扩容', glyph: '❤', color: '#ff5570', stats: { hpMax: 18 },
    desc: '本局最大生命 +18（并立刻回复同量）', base: 70, step: 1.26, max: 12 },
  { id: 'armor',  name: '附加装甲', glyph: '⛨', color: '#9aa8c8', stats: { armor: 2 },
    desc: '本局护甲 +2', base: 85, step: 1.30, max: 10 },
  { id: 'crit',   name: '瞄准校准', glyph: '✛', color: '#ffd166', stats: { critChance: 0.05 },
    desc: '本局暴击率 +5%', base: 90, step: 1.32, max: 8 },
  { id: 'move',   name: '推进器',   glyph: '⏩', color: '#4ff0ff', stats: { speedMul: 1.06 },
    desc: '本局移动速度 +6%', base: 80, step: 1.30, max: 8 },
  { id: 'area',   name: '扩幅场',   glyph: '◯', color: '#a06bff', stats: { areaMul: 1.07 },
    desc: '本局技能范围 +7%', base: 90, step: 1.32, max: 8 },
  { id: 'revive', name: '复活模块', glyph: '✧', color: '#ffb066', type: 'revive',
    desc: '获得 1 次复活机会', base: 420, step: 1.7, max: 2 },
  { id: 'reroll', name: '重掷机会', glyph: '↻', color: '#b07dff', type: 'reroll',
    desc: '获得 1 次重掷', base: 130, step: 1.45, max: 5 },
  { id: 'nova',   name: '净化脉冲', glyph: '◉', color: '#4ff0ff', type: 'nova',
    desc: '装填 1 发脉冲 · 下一波开始时自动湮灭全场敌人并转化为经验（可叠加）', base: 260, step: 1.55, max: 99 },
  { id: 'level',  name: '命运指引', glyph: '★', color: '#ffd166', type: 'level',
    desc: '立刻获得一次升级选择', base: 200, step: 1.6, max: 99 }
];

function runShopItem(id) {
  for (var i = 0; i < RUN_SHOP.length; i++) if (RUN_SHOP[i].id === id) return RUN_SHOP[i];
  return null;
}

/** 局内商品价格：每买一次涨价 */
function runShopCost(item, bought) { return Math.round(item.base * Math.pow(item.step, bought || 0)); }

/** 本局金币存入永久金币的比例（其余留在局内消费） */
var GOLD_BANK_RATIO = 0.25;

/** 汇总永久强化 -> 每局初始加成 */
function metaBonuses(meta) {
  meta = meta || {};
  var b = {
    dmgMul: 1, hpMax: 0, speedMul: 1, armor: 0, xpMul: 1, pickupMul: 1,
    goldMul: 1, startLevel: 0, rerolls: 0, revives: 0
  };
  for (var i = 0; i < SHOP.length; i++) {
    var it = SHOP[i], lv = meta[it.id] || 0;
    if (!lv) continue;
    if (it.stat === 'dmgMul' || it.stat === 'speedMul' || it.stat === 'xpMul' || it.stat === 'pickupMul' || it.stat === 'goldMul')
      b[it.stat] += it.add * lv;
    else b[it.stat] += it.add * lv;
  }
  return b;
}

/** 默认玩家属性 */
function baseStats() {
  return {
    hpMax: 100, hp: 100, hpMul: 1,
    speed: 205, speedMul: 1,
    dmgMul: 1, dmgTakenMul: 1, hasteMul: 1, areaMul: 1,
    armor: 0, regen: 0, noRegen: 0,
    critChance: 0.05, critMul: 1.6,
    pickup: 80, pickupMul: 1, xpMul: 1, luck: 0, goldMul: 1,
    pierceBonus: 0, dashCd: 1.2, revives: 0,
    enemySpeedMul: 1, enemyHpMul: 1, enemySpawnMul: 1, bossHpMul: 1,
    waveGoldMul: 1, rangedMul: 1, rangedHaste: 1
  };
}

/* ============================================================== 遗物
 * 掉落有节制：精英小概率、Boss 只有第一个必掉，之后是概率掉，
 * 且"已持有越多、掉率越低"（`relicDropChance`），避免一局满地遗物。
 * stats: 数值型加成（Mul 结尾相乘，其余相加）；flag: 需要游戏逻辑特殊处理的标记
 * ======================================================================== */
var RELICS = {
  bloodpact: {
    id: 'bloodpact', name: '血祭之匣', glyph: '✚', color: '#ff5570',
    desc: '伤害 +28%，但最大生命 −15%',
    stats: { dmgMul: 1.28, hpMul: 0.85 }
  },
  hourglass: {
    id: 'hourglass', name: '时之沙漏', glyph: '⧗', color: '#4ff0ff',
    desc: '所有敌人移动速度 −12%',
    stats: { enemySpeedMul: 0.88 }
  },
  magnetcore: {
    id: 'magnetcore', name: '磁暴核心', glyph: '⊙', color: '#6fe9ff',
    desc: '拾取范围 +130%，获得经验 +12%',
    stats: { pickupMul: 2.3, xpMul: 1.12 }
  },
  thorns: {
    id: 'thorns', name: '荆棘外壳', glyph: '✳', color: '#ff8a3d',
    desc: '受到伤害时，对周围敌人反弹 250% 伤害', flag: 'thorns'
  },
  hunter: {
    id: 'hunter', name: '猎手印记', glyph: '✛', color: '#ffd166',
    desc: '暴击率 +14%，暴击伤害 +20%',
    stats: { critChance: 0.14, critMul: 1.2 }
  },
  phoenix: {
    id: 'phoenix', name: '不死鸟之羽', glyph: '✧', color: '#ffb066',
    desc: '立刻获得 1 次复活机会', flag: 'phoenix'
  },
  overdrive: {
    id: 'overdrive', name: '暴走引擎', glyph: '⏱', color: '#ff4fa3',
    desc: '攻击速度 +30%，但受到的伤害 +12%',
    stats: { hasteMul: 1.30, dmgTakenMul: 1.12 }
  },
  frostheart: {
    id: 'frostheart', name: '冰霜之心', glyph: '❄', color: '#7df9ff',
    desc: '所有伤害附带 18% 减速（0.8 秒）', flag: 'frost'
  },
  grail: {
    id: 'grail', name: '黄金圣杯', glyph: '◈', color: '#ffd166',
    desc: '金币收益 +70%，敌人掉金币概率翻倍',
    stats: { goldMul: 1.70 }, flag: 'greed'
  },
  devourer: {
    id: 'devourer', name: '吞噬者之胃', glyph: '❤', color: '#7dff9b',
    desc: '每次击杀回复 0.5 点生命', flag: 'lifesteal'
  },
  prism: {
    id: 'prism', name: '虚空棱镜', glyph: '◉', color: '#b07dff',
    desc: '每 6 秒自动向四周发射一圈星弹', flag: 'prism'
  },
  berserker: {
    id: 'berserker', name: '狂战之怒', glyph: '⚔', color: '#ff2d6b',
    desc: '生命越低伤害越高，最高 +70%', flag: 'berserk'
  }
};
var RELIC_IDS = Object.keys(RELICS);

/** 遗物掉落概率：来源基础概率 × (1 − 已持有比例)，越拿越难拿 */
function relicDropChance(source, owned, luck) {
  var base = source === 'bossFirst' ? 0.7 : (source === 'boss' ? 0.35 : 0.03);
  var have = clamp((owned || 0) / RELIC_MAX_PER_RUN, 0, 1);
  var p = base * (1 - have * 0.9) + (luck || 0) * 0.03;
  return clamp(p, 0, 1);
}

/* ============================================================== 精英词缀
 * 精英怪随机带 1 条（12 波后 2 条），每条都有独立外观与行为
 * ======================================================================== */
var AFFIXES = [
  { id: 'shield',   name: '护盾',   glyph: '⛨', color: '#4ff0ff', hpMul: 1.6, shield: 1 },
  { id: 'berserk',  name: '狂暴',   glyph: '⚔', color: '#ff2d6b', rage: { maxMul: 1.9, dmgMul: 1.6 } },
  { id: 'toxic',    name: '剧毒',   glyph: '☣', color: '#7dff9b', toxic: { radius: 130, dps: 30, dur: 5 } },
  { id: 'vampiric', name: '吸血',   glyph: '✚', color: '#ff5570', vamp: { radius: 240, hps: 30, cd: 1.4 } },
  { id: 'summoner', name: '召唤',   glyph: '❂', color: '#c77dff', summon: { type: 'swarm', n: 2, cd: 5.5 } },
  { id: 'splitter', name: '裂变',   glyph: '✺', color: '#ff8a3d', affixSplit: { n: 3, type: 'swarm' } }
];

/* ============================================================== 终极技能
 * 充能靠击杀，但「释放期间不再累积充能」——大招是节奏点，不是循环技。
 * ======================================================================== */
var ULTIMATES = {
  vanguard: {
    id: 'orbital', name: '轨道炮击', glyph: '☄', color: '#4ff0ff', type: 'orbital',
    need: 60, count: 5, dmg: 190, radius: 120, delay: 0.24,
    desc: '呼叫 5 道轨道激光逐道落下，每道留下 2.5 秒灼烧区域'
  },
  pyro: {
    id: 'overload', name: '超载熔毁', glyph: '❂', color: '#ff8a3d', type: 'overload',
    need: 55, dur: 4.5, auraMul: 1.35, dmgMul: 1.7, jetCd: 0.45,
    desc: '4.5 秒内全部伤害 +70%、范围 +35%，并持续向四周喷发火焰'
  },
  wraith: {
    id: 'phase', name: '相位突袭', glyph: '⌖', color: '#b07dff', type: 'phase',
    need: 50, dmg: 180, dist: 430, invuln: 1.4,
    desc: '瞬移穿过战场，路径上造成 3 次 180 伤害并短暂无敌'
  }
};

/* ============================================================== 突变因子（挑战模式）
 * 每条都是"有得必有失"，用于每日挑战与随机挑战
 * ======================================================================== */
var MUTATORS = [
  { id: 'frail',   name: '脆皮',     glyph: '✚', color: '#ff5570', desc: '最大生命 −45%，伤害 +45%', stats: { hpMul: 0.55, dmgMul: 1.45 } },
  { id: 'horde',   name: '狂潮',     glyph: '❂', color: '#ff8a3d', desc: '敌人数量 +55%，但生命 −25%', stats: { enemySpawnMul: 1.55, enemyHpMul: 0.75 } },
  { id: 'glass',   name: '玻璃大炮', glyph: '⚔', color: '#ff2d6b', desc: '伤害 +85%，但无法回血且护甲归零', stats: { dmgMul: 1.85, noRegen: 1, armorZero: 1 } },
  { id: 'snipers', name: '狙击手',   glyph: '➤', color: '#8bff9f', desc: '远程敌人数量翻倍且射速 +35%', stats: { rangedMul: 2, rangedHaste: 1.35 } },
  { id: 'barren',  name: '贫瘠',     glyph: '✧', color: '#b07dff', desc: '经验 −35%，但每波奖励金币翻倍', stats: { xpMul: 0.65, waveGoldMul: 2 } },
  { id: 'swift',   name: '迅捷',     glyph: '⏩', color: '#4ff0ff', desc: '敌人移动速度 +38%', stats: { enemySpeedMul: 1.38 } },
  { id: 'overlord',name: '霸主',     glyph: '☠', color: '#ffd166', desc: 'Boss 生命 +90%，但金币收益 +80%', stats: { bossHpMul: 1.9, goldMul: 1.8 } },
  { id: 'precise', name: '精准',     glyph: '✛', color: '#ffe066', desc: '暴击率 +28%，但暴击伤害 −35%', stats: { critChance: 0.28, critMul: 0.65 } }
];
var MUTATOR_IDS = MUTATORS.map(function (m) { return m.id; });

function getMutator(id) {
  for (var i = 0; i < MUTATORS.length; i++) if (MUTATORS[i].id === id) return MUTATORS[i];
  return null;
}

/** 由日期字符串（YYYY-MM-DD）确定性地生成当日挑战配置 */
function dailyChallenge(dateStr) {
  var seed = 2166136261;
  for (var i = 0; i < dateStr.length; i++) {
    seed ^= dateStr.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  var rng = mulberry32(seed >>> 0);
  var chars = CHARACTERS.map(function (c) { return c.id; });
  var diffs = ['normal', 'abyss', 'annihil'];
  var picks = MUTATOR_IDS.slice();
  // Fisher–Yates（确定性）
  for (var j = picks.length - 1; j > 0; j--) {
    var k = Math.floor(rng() * (j + 1));
    var t = picks[j]; picks[j] = picks[k]; picks[k] = t;
  }
  return {
    date: dateStr,
    charId: chars[Math.floor(rng() * chars.length)],
    difficulty: diffs[Math.floor(rng() * diffs.length)],
    mutators: picks.slice(0, 2)
  };
}

function todayString(d) {
  d = d || new Date();
  var m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

/** 随机挑战：随机角色 + 随机 2~3 条突变 */
function randomChallenge() {
  var picks = MUTATOR_IDS.slice();
  for (var j = picks.length - 1; j > 0; j--) {
    var k = Math.floor(Math.random() * (j + 1));
    var t = picks[j]; picks[j] = picks[k]; picks[k] = t;
  }
  return {
    date: null,
    charId: pick(CHARACTERS).id,
    difficulty: pick(DIFFICULTIES).id,
    mutators: picks.slice(0, Math.random() < 0.5 ? 2 : 3)
  };
}

/** 把修正应用到属性对象：`Mul` 结尾的相乘，其余相加；两个特殊标记直接置位 */
function applyStatMods(s, mods) {
  if (!mods) return s;
  for (var k in mods) {
    var v = mods[k];
    if (v === undefined || v === null) continue;
    if (k === 'armorZero' || k === 'noRegen') { s[k] = 1; continue; }
    if (/_?Mul$/.test(k)) s[k] = (typeof s[k] === 'number' ? s[k] : 1) * v;
    else s[k] = (typeof s[k] === 'number' ? s[k] : 0) + v;
  }
  return s;
}

/** 把一组突变因子汇总成属性修正 */
function mutatorBonuses(ids) {
  var b = {};
  for (var i = 0; i < (ids || []).length; i++) {
    var m = getMutator(ids[i]);
    if (!m || !m.stats) continue;
    for (var k in m.stats) {
      var v = m.stats[k];
      if (/_?Mul$/.test(k)) b[k] = (b[k] === undefined ? 1 : b[k]) * v;
      else b[k] = (b[k] || 0) + v;
    }
  }
  return b;
}

/* ============================================================== 成就
 * check(g, st) 返回是否达成；prog(g, st) 可选，返回 [当前, 目标] 用于显示进度。
 * g = 当前 Game 实例（可能为 null），st = 存档数据。
 * 累计类数据用 helper 把"本局进行中"的数值也算上，达成后立刻结算。
 * ======================================================================== */
function achAllKills(g, st) { return (st.kills || 0) + (g && g.kills ? g.kills : 0); }
function achAllGold(g, st) { return (st.totalGold || 0) + (g && g.runGold ? Math.round(g.runGold) : 0); }
function achRun(g) { return (g && g.state !== 'menu' && g.player) ? g : null; }

var ACHIEVEMENTS = [
  { id: 'kill1',    name: '第一滴血',   glyph: '✦', color: '#7df9ff', reward: 30,
    desc: '累计击杀 1 个敌人', check: function (g, st) { return achAllKills(g, st) >= 1; },
    prog: function (g, st) { return [achAllKills(g, st), 1]; } },
  { id: 'kill100',  name: '百人斩',     glyph: '⚔', color: '#ff6b8a', reward: 60,
    desc: '累计击杀 100 个敌人', check: function (g, st) { return achAllKills(g, st) >= 100; },
    prog: function (g, st) { return [achAllKills(g, st), 100]; } },
  { id: 'kill1k',   name: '千人斩',     glyph: '⚔', color: '#ff8a3d', reward: 150,
    desc: '累计击杀 1,000 个敌人', check: function (g, st) { return achAllKills(g, st) >= 1000; },
    prog: function (g, st) { return [achAllKills(g, st), 1000]; } },
  { id: 'kill10k',  name: '万人斩',     glyph: '☠', color: '#ff2d6b', reward: 400,
    desc: '累计击杀 10,000 个敌人', check: function (g, st) { return achAllKills(g, st) >= 10000; },
    prog: function (g, st) { return [achAllKills(g, st), 10000]; } },
  { id: 'run5m',    name: '坚持五分钟', glyph: '⏱', color: '#4ff0ff', reward: 80,
    desc: '单局存活 5 分钟', check: function (g) { var r = achRun(g); return !!r && r.time >= 300; },
    prog: function (g) { var r = achRun(g); return [r ? Math.floor(r.time) : 0, 300]; } },
  { id: 'run10m',   name: '老练幸存者', glyph: '⏱', color: '#4ff0ff', reward: 200,
    desc: '单局存活 10 分钟', check: function (g) { var r = achRun(g); return !!r && r.time >= 600; },
    prog: function (g) { var r = achRun(g); return [r ? Math.floor(r.time) : 0, 600]; } },
  { id: 'wave10',   name: '深入星陨带', glyph: '❂', color: '#b07dff', reward: 100,
    desc: '抵达第 10 波', check: function (g) { var r = achRun(g); return !!r && r.wave >= 10; },
    prog: function (g) { var r = achRun(g); return [r ? r.wave : 0, 10]; } },
  { id: 'wave20',   name: '深渊行者',   glyph: '✧', color: '#b07dff', reward: 250,
    desc: '抵达第 20 波', check: function (g) { var r = achRun(g); return !!r && r.wave >= 20; },
    prog: function (g) { var r = achRun(g); return [r ? r.wave : 0, 20]; } },
  { id: 'clear',    name: '首通',       glyph: '🏆', color: '#ffd166', reward: 400,
    desc: '击破第 20 波的星陨之主并全身而退', check: function (g, st) { return (st.wins || 0) > 0; } },
  { id: 'clearAbyss',  name: '深渊通关', glyph: '🏆', color: '#ff9a3d', reward: 700,
    desc: '在「深渊」难度通关', check: function (g, st) { return (st.winsBy && st.winsBy.abyss > 0) || false; } },
  { id: 'clearAnnihil', name: '湮灭通关', glyph: '🏆', color: '#ff2d6b', reward: 1200,
    desc: '在「湮灭」难度通关', check: function (g, st) { return (st.winsBy && st.winsBy.annihil > 0) || false; } },
  { id: 'wave30',   name: '无尽回响',   glyph: '∞', color: '#b07dff', reward: 600,
    desc: '在无尽阶段抵达第 30 波',
    check: function (g) { var r = achRun(g); return !!r && r.endless && r.wave >= 30; },
    prog: function (g) { var r = achRun(g); return [r && r.endless ? r.wave : 0, 30]; } },
  { id: 'evo1',     name: '觉醒',       glyph: '★', color: '#ffd166', reward: 120,
    desc: '完成第一次武器进化',
    // 进化的瞬间就该弹成就，而不是等到结算
    check: function (g, st) { return (st.evolutions || 0) > 0 || evoCount(achRun(g)) > 0; } },
  { id: 'evo4',     name: '进化论',     glyph: '★', color: '#ffd166', reward: 300,
    desc: '单局进化 4 把武器',
    check: function (g) { var r = achRun(g); return !!r && evoCount(r) >= 4; },
    prog: function (g) { var r = achRun(g); return [r ? evoCount(r) : 0, 4]; } },
  { id: 'evo6',     name: '完全体',     glyph: '★', color: '#ffe066', reward: 800,
    desc: '单局进化满 6 把武器（武器栏上限）',
    check: function (g) { var r = achRun(g); return !!r && evoCount(r) >= 6; },
    prog: function (g) { var r = achRun(g); return [r ? evoCount(r) : 0, 6]; } },
  { id: 'max1',     name: '满级',       glyph: '▲', color: '#7dff9b', reward: 80,
    desc: '把任意武器升到 8 级',
    check: function (g) { var r = achRun(g); return !!r && r.player.weapons.some(function (w) { return w.lv >= WEAPON_MAX_LV; }); } },
  { id: 'max6',     name: '军火库',     glyph: '▲', color: '#7dff9b', reward: 350,
    desc: '单局 6 把武器全部满级',
    check: function (g) {
      var r = achRun(g);
      return !!r && r.player.weapons.length >= 6 && r.player.weapons.every(function (w) { return w.lv >= WEAPON_MAX_LV; });
    } },
  { id: 'pass8',    name: '全面发展',   glyph: '❖', color: '#a06bff', reward: 150,
    desc: '单局拥有 8 种不同的被动',
    check: function (g) { var r = achRun(g); return !!r && Object.keys(r.player.passives).length >= 8; },
    prog: function (g) { var r = achRun(g); return [r ? Object.keys(r.player.passives).length : 0, 8]; } },
  { id: 'relic6',   name: '遗物猎人',   glyph: '◈', color: '#ffd166', reward: 250,
    desc: '单局拿满 6 件遗物（单局上限）',
    check: function (g) { var r = achRun(g); return !!r && Object.keys(r.player.relics).length >= RELIC_MAX_PER_RUN; },
    prog: function (g) { var r = achRun(g); return [r ? Object.keys(r.player.relics).length : 0, RELIC_MAX_PER_RUN]; } },
  { id: 'relic20',  name: '收藏家',     glyph: '◈', color: '#ffe066', reward: 500,
    desc: '累计拾取 20 件遗物',
    check: function (g, st) { return (st.relicsTotal || 0) >= 20; },
    prog: function (g, st) { return [st.relicsTotal || 0, 20]; } },
  { id: 'ult5',     name: '大招连发',   glyph: '☄', color: '#4ff0ff', reward: 120,
    desc: '单局释放 5 次终极技能',
    check: function (g) { var r = achRun(g); return !!r && r.player.ultCasts >= 5; },
    prog: function (g) { var r = achRun(g); return [r ? r.player.ultCasts : 0, 5]; } },
  { id: 'crit1k',   name: '暴击狂人',   glyph: '✛', color: '#ffe066', reward: 180,
    desc: '单局打出 1,000 次暴击',
    check: function (g) { var r = achRun(g); return !!r && r.player.critCount >= 1000; },
    prog: function (g) { var r = achRun(g); return [r ? r.player.critCount : 0, 1000]; } },
  { id: 'nohit5m',  name: '完美走位',   glyph: '⛨', color: '#7df9ff', reward: 600,
    desc: '单局 5 分钟内一次都没有被击中',
    check: function (g) { var r = achRun(g); return !!r && r.time >= 300 && r.player.dmgTaken <= 0; } },
  { id: 'rich',     name: '富甲一方',   glyph: '◈', color: '#ffd166', reward: 300,
    desc: '累计赚取 10,000 金币', check: function (g, st) { return achAllGold(g, st) >= 10000; },
    prog: function (g, st) { return [achAllGold(g, st), 10000]; } },
  { id: 'shopmax',  name: '店长',       glyph: '⛭', color: '#8bff9f', reward: 250,
    desc: '把任意一项星港商店的强化买满',
    check: function (g, st) {
      for (var i = 0; i < SHOP.length; i++) if ((st.meta[SHOP[i].id] || 0) >= SHOP[i].maxLv) return true;
      return false;
    } },
  { id: 'challenge', name: '挑战者',    glyph: '⚑', color: '#ff4fa3', reward: 350,
    desc: '在带突变因子的挑战局里抵达第 12 波',
    check: function (g) { var r = achRun(g); return !!r && r.mutatorIds.length > 0 && r.wave >= 12; },
    prog: function (g) {
      var r = achRun(g);
      return [r && r.mutatorIds.length ? r.wave : 0, 12];
    } },
  { id: 'allmut',   name: '玻璃大炮',   glyph: '☠', color: '#ff2d6b', reward: 500,
    desc: '带着「玻璃大炮」突变因子通关',
    check: function (g, st) { return (st.glassWin || 0) > 0; } }
];

function evoCount(g) {
  if (!g || !g.player) return 0;
  var n = 0;
  for (var i = 0; i < g.player.weapons.length; i++) if (g.player.weapons[i].evo) n++;
  return n;
}
function achById(id) {
  for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === id) return ACHIEVEMENTS[i];
  return null;
}
