/* ============================================================================
 * 星陨幸存者 · STARFALL SURVIVORS
 * game.js — 游戏层
 *   实体 / 战斗 / 八种武器行为 / 敌人 AI / Boss 战 / 波次 / 升级三选一
 *   经济与永久强化存档 / 菜单 · HUD · 暂停 · 结算 UI
 * ==========================================================================*/
'use strict';

/* ============================================================== 常量 */
var TEAM = { PLAYER: 0, ENEMY: 1 };
var MAX_ENEMIES = 460;
var MAX_BULLETS = 700;
var SPAWN_PAD = 90;
var MAX_WEAPON_SLOTS = 6;

/* ============================================================== 小工具 */
function angleDiff(a, b) { return ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; }
function enemyAt(g, x, y, radius) {
  var best = null, bd = radius * radius;
  for (var i = 0; i < g.enemies.length; i++) {
    var e = g.enemies[i];
    if (e.dead) continue;
    var d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function nearestEnemy(g, x, y, maxR) {
  var best = null, bd = maxR == null ? Infinity : maxR * maxR;
  for (var i = 0; i < g.enemies.length; i++) {
    var e = g.enemies[i];
    if (e.dead) continue;
    var d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function farthestEnemy(g, x, y) {
  var best = null, bd = -1;
  for (var i = 0; i < g.enemies.length; i++) {
    var e = g.enemies[i];
    if (e.dead) continue;
    var d = dist2(x, y, e.x, e.y);
    if (d > bd) { bd = d; best = e; }
  }
  return best;
}

/* ============================================================== UI 层 */
var UI = {
  el: {},
  ready: false,

  init: function () {
    if (this.ready || typeof document === 'undefined') return;
    var ids = ['app', 'game', 'hud', 'hpFill', 'hpText', 'hpGhost', 'xpFill', 'xpText',
      'statTime', 'statWave', 'statKills', 'statGold', 'loadout', 'bossBar', 'bossName', 'bossFill',
      'dashRing', 'ultRing', 'ultGlyph', 'ultPct', 'relicBar', 'combo', 'banner', 'toasts',
      'statNext', 'statNextK', 'statNextWrap', 'btnToggleFx',
      'runshop', 'runShopList', 'runGold', 'btnRunShopClose', 'shopBtn', 'shopGoldHud',
      'restTimer2', 'restWave2',
      'settings', 'settingsList', 'btnSettings', 'btnSettings2', 'btnSettingsClose', 'btnSettingsReset',
      'fpsBox', 'fpsVal', 'msVal',
      'menu', 'charList', 'difficultyList', 'btnStart', 'btnShop',
      'records', 'chDate', 'chBody', 'btnDaily', 'btnRandom',
      'levelup', 'luLevel', 'luSub', 'cardList', 'btnReroll', 'rerollCount', 'btnSkip',
      'pause', 'pauseStats', 'pauseBuild', 'pauseAttr', 'btnResume', 'btnToggleSound', 'btnQuit',
      'gameover', 'goTitle', 'goStats', 'goDamage', 'goGold', 'btnRetry', 'btnShop2', 'btnMenu',
      'shop', 'shopGold', 'shopList', 'btnShopClose', 'btnShopReset', 'splash',
      'archive', 'archiveBody', 'tabCodex', 'tabAch', 'tabHist', 'achCount', 'achGold',
      'btnArchive', 'btnArchive2', 'btnArchiveClose',
      'touch', 'stickZone', 'stickKnob', 'touchUlt', 'touchDash'];
    for (var i = 0; i < ids.length; i++) this.el[ids[i]] = document.getElementById(ids[i]);
    this.ready = true;
  },

  show: function (name) { var e = this.el[name]; if (e) e.classList.remove('hidden'); },
  hide: function (name) { var e = this.el[name]; if (e) e.classList.add('hidden'); },
  text: function (name, v) { var e = this.el[name]; if (e && e.textContent !== v) e.textContent = v; },
  width: function (name, pct) { var e = this.el[name]; if (e) e.style.width = (clamp(pct, 0, 1) * 100) + '%'; },

  banner: function (text, ms) {
    var b = this.el.banner;
    if (!b) return;
    b.textContent = text;
    b.classList.remove('hidden');
    clearTimeout(this._bt);
    this._bt = setTimeout(function () { b.classList.add('hidden'); }, ms || 1500);
  },

  toast: function (text) {
    var box = this.el.toasts;
    if (!box) return;
    var d = document.createElement('div');
    d.className = 'toast';
    d.textContent = text;
    box.appendChild(d);
    setTimeout(function () { d.classList.add('out'); }, 1400);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 1800);
    while (box.children.length > 4) box.removeChild(box.firstChild);
  },

  splash: function (text) {
    var s = this.el.splash;
    if (!s) return;
    s.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = text;
    s.appendChild(span);
    s.classList.remove('hidden');
    clearTimeout(this._st);
    this._st = setTimeout(function () { s.classList.add('hidden'); }, 1300);
  },

  combo: function (n) {
    var c = this.el.combo;
    if (!c) return;
    if (n < 3) { c.classList.add('hidden'); return; }
    c.textContent = '×' + n + ' 连击';
    c.classList.remove('hidden');
    c.style.animation = 'none';
    void c.offsetWidth;
    c.style.animation = '';
  },

  stats: function (rows) {
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="ms"><span class="ms-k">' + rows[i][0] + '</span><span class="ms-v">' + rows[i][1] + '</span></div>';
    }
    return html;
  }
};

/* ============================================================== 游戏主体 */
function Game(canvas) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.cam = new Camera();
  this.state = 'menu';
  this.difficulty = 'normal';
  this.charId = 'vanguard';
  this.time = 0;
  this.enemies = [];
  this.bullets = [];
  this.ebullets = [];
  this.gems = [];
  this.mines = [];
  this.zones = [];
  this.shocks = [];
  this.bolts = [];
  this.coins = [];
  this.orbs = [];
  this.relicDrops = [];
  this.afterimages = [];
  this.pendingLevels = 0;
  this.runGold = 0;
  this.accum = 0;
  this.lastFrame = 0;
  this.fpsSmooth = 60;
  this.challenge = null;      // 当前挑战配置（每日 / 随机），普通模式为 null
  this.mutatorIds = [];
  this.mutBonus = null;
  this.restT = 0;
  this.drawStats = { drawn: 0, culled: 0 };   // 渲染剔除统计（也用于测试）
  Starfield.init();
  this.player = null;
}

Game.prototype = {

  /* ------------------------------------------------ 开局 */
  startRun: function (challenge) {
    this.challenge = challenge || null;
    this.mutatorIds = (challenge && challenge.mutators) ? challenge.mutators.slice() : [];
    this.mutBonus = mutatorBonuses(this.mutatorIds);
    // 只在第一次游玩时给操作引导
    this.intro = Store.get('introDone', false) ? null : {};
    // 挑战模式会锁定角色与难度
    if (challenge && challenge.charId) this.charId = challenge.charId;
    if (challenge && challenge.difficulty) this.difficulty = challenge.difficulty;

    var c = getChar(this.charId);
    var diff = null;
    for (var i = 0; i < DIFFICULTIES.length; i++) if (DIFFICULTIES[i].id === this.difficulty) diff = DIFFICULTIES[i];
    this.diff = diff || DIFFICULTIES[0];

    var meta = metaBonuses(Store.get('meta', {}));
    var p = {
      x: 0, y: 0, vx: 0, vy: 0, r: 13, facing: -Math.PI / 2,
      level: 1, xp: 0, xpNext: xpNeeded(1),
      stats: baseStats(),
      weapons: [], passives: {}, relics: {}, runBonus: {},
      invuln: 0, dashT: 0, dashCd: 0, hurtFlash: 0,
      kills: 0, dmgDealt: 0, dmgTaken: 0, gold: 0,
      rerolls: meta.rerolls, revives: meta.revives, reviveUsed: 0,
      critCount: 0, ultCasts: 0, pendingPulse: 0,
      // 终极技能
      ult: ULTIMATES[c.id],
      ultCharge: 0, ultActive: null, ultDealt: 0,
      // 遗物计时器
      prismT: 0, thornsT: 0,
      relicFlags: {}
    };
    this.player = p;
    // 角色 + 永久强化 + 被动 + 遗物 + 突变因子 全部由 recomputeStats 统一计算（单一数据源）
    this.recomputeStats(true);
    p.hp = p.stats.hpMax;
    this.giveWeapon(c.start, 1);
    for (var lv = 0; lv < meta.startLevel; lv++) this.grantLevelUp();

    this.time = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboT = 0;
    this.maxCombo = 0;
    this.runGold = 0;
    this.revivesUsed = 0;
    this.enemies.length = 0;
    Grid.clear();
    this.bullets.length = 0;
    this.ebullets.length = 0;
    this.gems.length = 0;
    this.mines.length = 0;
    this.zones.length = 0;
    this.shocks.length = 0;
    this.bolts.length = 0;
    this.coins.length = 0;
    this.orbs.length = 0;
    this.relicDrops.length = 0;
    this.afterimages.length = 0;
    Particles.clear();
    this.cam.reset();

    this.wave = 0;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.budgetLeft = 0;
    this.waveCfg = null;
    this.boss = null;
    this.bossDef = null;
    this.calm = 2.2;
    this.victory = false;
    this.endless = false;
    this.restT = 0;                  // 上一局的休息计时不能残留到新一局
    this.pulseArmT = 0;
    this._dmgText = 0;               // 每帧伤害数字配额
    this._dmgCrit = 0;
    this.relicsFromBoss = false;
    this.spawnSector = null;

    this.state = 'playing';
    UI.hide('menu'); UI.hide('gameover'); UI.hide('pause'); UI.hide('levelup'); UI.hide('shop');
    UI.hide('runshop');
    UI.show('hud');
    if (Touch.enabled) UI.show('touch');
    Input.clearBuffer();          // 不要把上一局/菜单里的按键带进新一局
    UI.splash('准备迎击');
    this.rebuildLoadout();
    this.rebuildRelicBar();
    this.refreshHud(true);
    if (this.mutatorIds.length) {
      var names = [];
      for (var mi = 0; mi < this.mutatorIds.length; mi++) {
        var mu = getMutator(this.mutatorIds[mi]);
        if (mu) names.push(mu.name);
      }
      UI.banner('突变：' + names.join(' + '), 2600);
      for (var t = 0; t < names.length; t++) UI.toast('突变因子 · ' + names[t]);
    }
    if (Sfx.enabled) { Sfx.unlock(); Sfx.startMusic(); }
  },

  grantLevelUp: function () {
    var p = this.player;
    p.level++;
    p.xpNext = xpNeeded(p.level);
    this.pendingLevels++;
  },

  /* ------------------------------------------------ 属性重算 */
  recomputeStats: function (silent) {
    var p = this.player, c = getChar(this.charId);
    var meta = metaBonuses(Store.get('meta', {}));
    var s = baseStats();
    var cs = c.stats;
    s.hpMax = cs.hpMax; s.speed = cs.speed;
    if (cs.dmgMul) s.dmgMul *= cs.dmgMul;
    if (cs.areaMul) s.areaMul *= cs.areaMul;
    if (cs.armor) s.armor += cs.armor;
    if (cs.critChance) s.critChance += cs.critChance;
    if (cs.critMul) s.critMul = cs.critMul;
    if (cs.pickup) s.pickup = cs.pickup;
    if (cs.dashCd) s.dashCd = cs.dashCd;
    s.hpMax += meta.hpMax;
    s.dmgMul *= meta.dmgMul;
    s.speedMul *= meta.speedMul;
    s.armor += meta.armor;
    s.xpMul *= meta.xpMul;
    s.pickupMul *= meta.pickupMul;
    s.goldMul *= meta.goldMul;
    s.revives = meta.revives;
    // 遗物（本局永久）
    p.relicFlags = {};
    for (var rid in p.relics) {
      var rel = RELICS[rid];
      if (!rel) continue;
      applyStatMods(s, rel.stats);
      if (rel.flag) p.relicFlags[rel.flag] = 1;
    }
    // 突变因子（挑战模式）
    applyStatMods(s, this.mutBonus);
    // 局内补给商店买到的本局强化
    for (var bid in p.runBonus) {
      var bit = runShopItem(bid);
      if (!bit || !bit.stats) continue;
      for (var n = 0; n < p.runBonus[bid]; n++) applyStatMods(s, bit.stats);
    }
    if (s.armorZero) s.armor = 0;
    s.hpMax = Math.max(10, Math.round(s.hpMax * s.hpMul));

    for (var id in p.passives) {
      var lv = p.passives[id];
      if (!lv) continue;
      var def = PASSIVES[id];
      if (!def) continue;
      if (def.add >= 1 || def.stat === 'armor' || def.stat === 'regen' || def.stat === 'pierceBonus') s[def.stat] += def.add * lv;
      else s[def.stat] += def.add * lv;
    }
    p.stats = s;
    if (p.hp > s.hpMax) p.hp = s.hpMax;
    if (!silent) this.rebuildLoadout();
  },

  giveWeapon: function (id, lv) {
    var p = this.player;
    for (var i = 0; i < p.weapons.length; i++) {
      if (p.weapons[i].id === id) {
        p.weapons[i].lv = Math.min(WEAPON_MAX_LV, p.weapons[i].lv + lv);
        return;
      }
    }
    p.weapons.push({ id: id, lv: lv, timer: rand(0, 0.3), sub: {}, angle: rand(0, TAU) });
  },

  /* ------------------------------------------------ 主循环 */
  frame: function (ts) {
    var self = this;
    this._raf = requestAnimationFrame(function (t) { self.frame(t); });
    if (!this.lastFrame) this.lastFrame = ts;
    var raw = (ts - this.lastFrame) / 1000;
    this.lastFrame = ts;
    if (raw > 0.25) raw = 0.25;      // 切标签页回来时防止瞬移
    this.fpsSmooth = lerp(this.fpsSmooth, 1 / Math.max(raw, 0.0001), 0.06);

    var step = 1 / 60;
    this.accum += raw;
    var guard = 0;
    while (this.accum >= step && guard++ < 6) {
      this.update(step);
      this.accum -= step;
    }
    this.render();
    Input.endFrame();

    // 自动降质：连续低帧率就把渲染倍率降一档（画面略软，但先保证不卡）
    if (this.state === 'playing' || this.state === 'menu') {
      if (this.fpsSmooth < 45) this.slowTime = (this.slowTime || 0) + raw;
      else this.slowTime = Math.max(0, (this.slowTime || 0) - raw * 2);
      if (this.slowTime > 2 && View.quality > 0.72) {
        this.slowTime = 0;
        View.quality = Math.max(0.7, View.quality - 0.15);
        if (this._applyView) this._applyView();
        UI.toast('已自动降低渲染精度以保持流畅');
        this.autoDegraded = (this.autoDegraded || 0) + 1;
      } else if (this.slowTime > 3 && !this.perfHinted) {
        // 画质已经降到底还是很慢：给一次"去设置里关点东西"的提示（只提示一次，不弹面板）
        this.perfHinted = true;
        this.slowTime = 0;
        UI.toast('还卡的话：ESC → 设置 → 精简特效 / 关闭伤害数字');
        Sfx.ui();
      }
    }
  },

  update: function (dt) {
    // 全局输入
    if (Input.hit('m')) { this.toggleSound(); }

    // B 键统一入口：带 250ms 缓冲，顿帧/升级弹窗里按下也不会丢。
    // 先用 buffered 探一下，能处理才消费，否则留在缓冲里等回到战斗。
    if (Input.buffered('b', 250)) {
      if (this.state === 'runshop') {
        Input.consume('b', 250); this.closeRunShop(); return;
      } else if (this.state === 'playing' && this.restT > 0) {
        Input.consume('b', 250); this.openRunShop(); return;
      } else if (this.state === 'playing') {
        Input.consume('b', 250);
        UI.toast('补给站只在每波结束后的休息时间开放');
        Sfx.ui();
      }
    }

    if (this.state === 'playing') {
      if (Input.hit('escape', 'p')) { this.pause(); return; }
    } else if (this.state === 'paused') {
      if (Input.hit('escape', 'p')) { this.resume(); return; }
    } else if (this.state === 'settings') {
      if (Input.hit('escape', 'p')) { this.closeSettings(); return; }
    } else if (this.state === 'levelup') {
      if (Input.hit('1')) this.chooseOption(0);
      else if (Input.hit('2')) this.chooseOption(1);
      else if (Input.hit('3')) this.chooseOption(2);
      else if (Input.hit('r')) this.reroll();
    } else if (this.state === 'menu') {
      // 菜单直接回车/空格开始
      if (Input.hit('enter', 'space')) this.startNormal();
    } else if (this.state === 'dead') {
      // 结算界面直接回车/空格再来一局（通关时则是继续无尽）
      if (Input.hit('enter', 'space')) this.retry();
    }

    if (Sfx.ready) Sfx.tickMusic();

    if (this.state !== 'playing') {
      Particles.update(dt * 0.25);
      this.cam.update(dt, this.cam.x, this.cam.y);
      return;
    }

    // 命中停顿
    if (this.cam.hitstop > 0) {
      this.cam.hitstop -= dt;
      this.cam.update(dt * 0.25, this.player.x, this.player.y);
      Particles.update(dt * 0.15);
      return;
    }

    this.time += dt;
    this.updatePlayer(dt);
    this.updateUlt(dt);
    this.updateRelicEffects(dt);
    this.updateWaves(dt);
    if (this.state !== 'playing') return;   // 波次里可能触发胜利/失败结算
    this.updateWeapons(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEnemyBullets(dt);
    this.updateShocks(dt);
    this.updateMines(dt);
    this.updateZones(dt);
    this.updateGems(dt);
    this.updateCoins(dt);
    this.updateOrbs(dt);
    this.updateRelicDrops(dt);
    this.updateBolts(dt);

    this.cam.update(dt, this.player.x, this.player.y);
    Particles.update(dt);

    // 连击衰减
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) { this.combo = 0; UI.combo(0); }
    }

    // 音乐强度随强度变化
    if (Sfx.ready && (this.frameCount = (this.frameCount || 0) + 1) % 30 === 0) {
      var danger = clamp(this.enemies.length / 90 + (this.boss ? 0.35 : 0) + this.wave * 0.02, 0, 1);
      Sfx.setIntensity(danger);
    }

    // 首次游玩的引导提示（只出现一次，靠存档标记）
    if (this.state === 'playing' && this.intro) {
      if (!this.intro.move && this.time > 1.5) {
        this.intro.move = 1;
        UI.toast('用 WASD / 方向键 移动 · 武器会自动攻击最近的敌人');
      }
      if (!this.intro.dash && this.time > 9) {
        this.intro.dash = 1;
        UI.toast('空格 冲刺穿过敌群（有无敌帧，冷却 1.2 秒）');
      }
      if (!this.intro.build && this.time > 20) {
        this.intro.build = 1;
        Store.set('introDone', true);
        UI.toast('ESC 暂停可查看构筑与属性明细 · 击杀为 Q 终极技能充能');
      }
    }

    // 成就：每 0.5 秒检查一次（26 个纯函数判定，开销可忽略）
    this.achTimer = (this.achTimer || 0) + dt;
    if (this.achTimer >= 0.5) { this.achTimer = 0; Achievements.check(this); }

    // 升级弹窗
    if (this.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();

    this.refreshHud(false);
  },

  /* ------------------------------------------------ 玩家 */
  updatePlayer: function (dt) {
    var p = this.player, st = p.stats;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt * 3.4;
    if (p.dashCd > 0) p.dashCd -= dt;

    var mv = Input.moveVec();
    var speed = st.speed * st.speedMul;
    var ax = 0, ay = 0;

    if (p.dashT > 0) {
      p.dashT -= dt;
      var ds = 900 * Math.max(0.85, st.speedMul);
      p.vx = p.dashDirX * ds;
      p.vy = p.dashDirY * ds;
      p.invuln = Math.max(p.invuln, 0.06);
      if (Math.random() < 0.7) {
        Particles.add({
          x: p.x + rand(-6, 6), y: p.y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-30, 30),
          life: 0, max: 0.34, size: 4.2, color: getChar(this.charId).color, drag: 3, grav: 0, glow: true, shape: 'dot', spin: 0, rot: 0, fade: 0.8
        });
      }
    } else {
      ax = mv.x * speed; ay = mv.y * speed;
      p.vx = damp(p.vx, ax, 16, dt);
      p.vy = damp(p.vy, ay, 16, dt);
      // 冲刺：缓冲按键（顿帧/升级弹窗里按下的也算数）+ 按住不放会在冷却好时立刻再冲
      if (p.dashCd <= 0 && (Input.consume('space', 250) || Input.keys['space'])) {
        var dxx = mv.x, dyy = mv.y;
        if (!dxx && !dyy) { dxx = Math.cos(p.facing); dyy = Math.sin(p.facing); }
        var len = Math.hypot(dxx, dyy) || 1;
        p.dashDirX = dxx / len; p.dashDirY = dyy / len;
        p.dashT = 0.16;
        p.dashCd = st.dashCd;
        p.invuln = Math.max(p.invuln, 0.34);
        Sfx.dash();
        this.cam.addShake(3);
        Particles.ring(p.x, p.y, 12, 8, { color: '#7df9ff', speed: 210, life: 0.32, size: 2.6 });
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (Math.abs(p.vx) > 4 || Math.abs(p.vy) > 4) p.facing = Math.atan2(p.vy, p.vx);

    // 引擎尾迹
    var sp = Math.hypot(p.vx, p.vy);
    if (sp > 40 && Math.random() < 0.5) {
      Particles.add({
        x: p.x - Math.cos(p.facing) * 10, y: p.y - Math.sin(p.facing) * 10,
        vx: -p.vx * 0.12 + rand(-24, 24), vy: -p.vy * 0.12 + rand(-24, 24),
        life: 0, max: 0.3, size: 2.8, color: '#4ff0ff', drag: 3.4, grav: 0, glow: true, shape: 'dot', spin: 0, rot: 0, fade: 0.7
      });
    }

    // 回复
    if (st.regen > 0 && p.hp < st.hpMax && !st.noRegen) {
      p.hp = Math.min(st.hpMax, p.hp + st.regen * dt);
    }
    // 被动词条之外的“持续治疗”来源（遗物/被动）都受 noRegen 限制
  },

  hurtPlayer: function (amount, srcName, color) {
    var p = this.player, st = p.stats;
    if (p.invuln > 0 || this.state !== 'playing') return false;
    var dmg = Math.max(1, amount * (this.diff ? this.diff.dmgMul : 1) * (st.dmgTakenMul || 1) - st.armor);
    p.hp -= dmg;
    p.invuln = 0.6;
    p.hurtFlash = 1;
    p.dmgTaken += dmg;
    this.combo = 0; UI.combo(0);
    this.cam.addShake(12);
    this.cam.addFlash(0.42, color || '#ff2b55');
    this.cam.addHitstop(0.06);
    Sfx.hurt();
    var col = color || '#ff5570';
    Particles.burst(p.x, p.y, 14, { color: [col, '#ff9a3d'], speed: 240, life: 0.5, size: 3.4, jitter: 6 });
    Particles.text(p.x, p.y - 26, '-' + Math.round(dmg), { color: col, size: 16, life: 0.9 });
    // 遗物「荆棘外壳」：反弹伤害
    if (p.relicFlags.thorns && p.thornsT <= 0) {
      p.thornsT = 0.25;
      var rad = 150, r2 = rad * rad, reflect = dmg * 2.5;
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        if (e.dead) continue;
        if (dist2(p.x, p.y, e.x, e.y) > r2) continue;
        var a = Math.atan2(e.y - p.y, e.x - p.x);
        this.damageEnemy(e, reflect, { color: '#ff8a3d', knock: 220, kx: Math.cos(a), ky: Math.sin(a) });
      }
      Particles.shock(p.x, p.y, 8, rad, { color: '#ff8a3d', life: 0.4, width: 5 });
    }
    if (p.hp <= 0) this.killPlayer();
    this.refreshHud(true);
    return true;
  },

  killPlayer: function () {
    var p = this.player;
    if (p.reviveUsed < p.revives) {
      p.reviveUsed++;
      p.hp = p.stats.hpMax * 0.6;
      p.invuln = 2.4;
      this.cam.addFlash(0.8, '#7dff9b');
      this.cam.addShake(26);
      Sfx.bossDie();
      Particles.shock(p.x, p.y, 10, 420, { color: '#7dff9b', life: 0.7, width: 8 });
      Particles.burst(p.x, p.y, 60, { color: ['#7dff9b', '#4ff0ff'], speed: 380, life: 0.9, size: 4 });
      UI.banner('复活核心启动', 1600);
      UI.toast('复活核心消耗 1 次 · 剩余 ' + (p.revives - p.reviveUsed));
      return;
    }
    p.hp = 0;
    this.gameOver(false);
  },

  /* ------------------------------------------------ 波次 */
  updateWaves: function (dt) {
    // 休息时段：不刷怪，HUD 倒计时走完再开下一波
    if (this.restT > 0) {
      this.restT -= dt;
      if (this.restT <= 0) this.endRest();
      return;
    }
    if (this.calm > 0) {
      this.calm -= dt;
      if (this.calm <= 0) this.beginWave();
      return;
    }

    // 装填好的净化脉冲：2.5 秒后或场上敌人够多时引爆
    if (this.pulseArmT > 0) {
      this.pulseArmT -= dt;
      if (this.pulseArmT <= 0 || this.enemies.length >= 8) {
        this.pulseArmT = 0;
        if (this.player.pendingPulse > 0) {
          this.player.pendingPulse--;
          this.firePurge();
        }
      }
    }
    this.waveTimer += dt;

    var cfg = this.waveCfg;
    if (!cfg) return;

    if (this.budgetLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = cfg.interval;
        var burst = Math.min(this.budgetLeft, cfg.burst + randInt(0, 1));
        this.budgetLeft -= burst;
        // 前期怪少：让它们从同一侧成股涌入，而不是四面零星飘来（否则玩家一直在等怪）
        if (this.spawnSector == null || chance(this.wave <= 4 ? 0.25 : 0.5)) this.spawnSector = rand(0, TAU);
        var spread = this.wave <= 4 ? 0.34 : (this.wave <= 8 ? 0.65 : 1.3);
        var pad = this.wave <= 4 ? 40 : SPAWN_PAD;   // 前期贴边出现，更快接战
        for (var i = 0; i < burst; i++) {
          this.spawnEnemy(pickWeighted(cfg.pool), true,
            this.spawnSector + rand(-spread / 2, spread / 2), pad);
        }
      }
    }

    if (cfg.isBoss && this.boss && this.boss.dead) this.boss = null;

    // 下一波是 Boss 时，提前 5 秒预警
    if (!cfg.isBoss && !this.bossWarned && (this.wave + 1) % 5 === 0) {
      var untilEnd = cfg.dur - this.waveTimer;
      if (untilEnd <= 5) {
        this.bossWarned = true;
        UI.banner('⚠ BOSS 即将降临 ⚠', 2000);
        Sfx.bossWarn();
      }
    }

    var timeUp = this.waveTimer >= cfg.dur;
    var clear = this.budgetLeft <= 0 && this.enemies.length === 0 && !this.boss;
    // 小怪全清后最多再等 6 秒
    if (this.budgetLeft <= 0 && !this.boss && this.enemies.length === 0) {
      this.clearTimer = (this.clearTimer || 0) + dt;
    } else this.clearTimer = 0;

    if (timeUp || clear || this.clearTimer > 5) this.endWave();
  },

  beginWave: function () {
    this.wave++;
    var cfg = waveConfig(this.wave);
    this.waveCfg = cfg;
    this.waveTimer = 0;
    this.clearTimer = 0;
    this.spawnTimer = 0;
    this.bossWarned = false;
    this.budgetLeft = Math.round(cfg.budget * this.diff.spawnMul * (cfg.isBoss ? 0.45 : 1));
    this.calm = 0;

    if (cfg.isBoss) {
      this.spawnBoss();
      UI.banner('⚠ BOSS 来袭 ⚠', 2200);
      Sfx.bossWarn();
      this.cam.addFlash(0.35, '#ff2d6b');
    } else {
      UI.banner('第 ' + this.wave + ' 波', 1400);
      Sfx.waveStart();
    }
    // 波次开始小回复
    if (this.wave > 1) {
      var heal = this.player.stats.hpMax * 0.06;
      this.player.hp = Math.min(this.player.stats.hpMax, this.player.hp + heal);
      Sfx.heal();
    }
    // 已装填的净化脉冲：等这一波刷出一些敌人再引爆
    if (this.player.pendingPulse > 0) {
      this.pulseArmT = 2.5;
      UI.toast('净化脉冲待引爆 · ' + this.player.pendingPulse + ' 发');
    }
  },

  endWave: function () {
    var bonus = this.goldActive() ? Math.round((4 + this.wave * 2) * this.player.stats.waveGoldMul * this.player.stats.goldMul) : 0;
    if (bonus > 0) {
      this.runGold += bonus;
      UI.toast('第 ' + this.wave + ' 波清除 · 金币 +' + bonus);
      Sfx.coin();
    } else {
      UI.toast('第 ' + this.wave + ' 波清除（无尽阶段不再产出金币）');
    }
    // 清场残留（把还在场的敌人转为经验，避免卡关）
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.isBoss) {
        // 超时未击杀的 Boss：必须一并移除，否则会留下“幽灵 Boss”卡死后续波次
        e.dead = true;
        e.silentDeath = true;
        this.spawnGem(e.x, e.y, e.xpValue || 60, true);
        continue;
      }
      this.spawnGem(e.x, e.y, e.xpValue || 1, true);
      e.dead = true;
    }
    this.enemies.length = 0;
    this.ebullets.length = 0;
    this.boss = null;
    this.bossDef = null;
    Grid.clear();
    UI.hide('bossBar');
    this.calm = 3.0;
    if (this.wave >= FINAL_WAVE && !this.victory && this.wave % 5 === 0) {
      this.victory = true;
      this.endless = true;          // 之后进入无尽阶段
      this.gameOver(true);
      return;
    }
    UI.banner('波次清除', 1200);
    // 波次之间的休息时段：自动打开局内补给商店并倒计时
    this.beginRest(REST_SECONDS);
  },

  /* ------------------------------------------------ 波次间休息（局内商店时段） */
  /** 不弹任何面板：只是"这一段时间不刷怪"，HUD 显示倒计时，想买补给按 B。
   *  场上残留的经验/金币**不再自动收走**——休息时间就是让你跑图去捡的。 */
  beginRest: function (seconds) {
    this.restT = seconds;
    UI.toast('补给站开放 ' + Math.round(seconds) + 's · 按 B 购买');
    if (UI.el.shopBtn) UI.el.shopBtn.classList.add('ready');
  },

  endRest: function () {
    this.restT = 0;
    if (UI.el.shopBtn) UI.el.shopBtn.classList.remove('ready');
    if (this.state === 'runshop') { this.state = 'playing'; UI.hide('runshop'); }
    this.calm = 1.0;                 // 短暂缓冲后开始下一波
    Input.clearBuffer();
    if (this.pendingLevels > 0) this.openLevelUp();
  },

  refreshRestHud: function () {
    // 休息时间直接体现在 HUD 的"下一波"倒计时上，不额外弹面板
    if (!UI.ready) return;
    var secs = Math.max(0, this.restT).toFixed(1) + 's';
    UI.text('restTimer2', secs);
    UI.text('restWave2', '第 ' + this.wave + ' 波已清除');
  },

  spawnEnemy: function (typeId, useSpawnEdge, angle, pad) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    var cfg = this.waveCfg, def = ENEMIES[typeId];
    if (!def) return null;
    var elite = !cfg.isBoss && chance(cfg.eliteChance * (this.diff.eliteMul || 1) * (1 + (this.player.stats.luck || 0)));
    var hpMul = cfg.hpMul * (1 + Math.max(0, this.wave - def.minWave) * 0.04) * this.player.stats.enemyHpMul;

    var pos = this.edgePosition(angle, pad);
    var maxHp = def.hp * hpMul * (elite ? ELITE.hpMul : 1);
    var e = {
      type: typeId, def: def, x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp: maxHp, maxHp: maxHp,
      r: def.radius * (elite ? ELITE.radiusMul : 1),
      speed: def.speed * cfg.speedMul * (elite ? ELITE.speedMul : 1),
      dmg: def.dmg * cfg.dmgMul * (elite ? ELITE.dmgMul : 1),
      armor: def.armor + (elite ? ELITE.armorAdd : 0),
      xpValue: def.xp * (elite ? ELITE.xpMul : 1) * cfg.xpMul,
      elite: elite, isBoss: false, dead: false,
      cd: {}, hitFlash: 0, rot: rand(0, TAU), wobbleT: rand(0, 10),
      slowT: 0, slowMul: 1, stunT: 0, burnT: 0, burnDps: 0, spawnT: 0.35,
      shield: 0, affixes: [], rage: 0, vampT: rand(0.5, 1.5), summonT: rand(2, 5),
      timer: rand(0, 1)
    };
    // 精英词缀：1 条，12 波后 2 条；高难度额外 +1 条
    if (elite) {
      var count = (this.wave >= 12 ? 2 : 1) + (this.diff.affixBonus || 0);
      var used = [];
      for (var a = 0; a < count; a++) {
        var pick2 = null, guard = 0;
        do { pick2 = AFFIXES[randInt(0, AFFIXES.length - 1)]; guard++; } while (used.indexOf(pick2.id) >= 0 && guard < 12);
        used.push(pick2.id);
        this.applyAffix(e, pick2);
      }
    }
    this.enemies.push(e);
    Grid.insert(e);
    // 突变因子「狙击手」：远程敌人数量翻倍
    if (def.behavior === 'shooter' && this.player.stats.rangedMul > 1 && chance(this.player.stats.rangedMul - 1)) {
      var pos2 = this.edgePosition();
      var e2 = this.spawnEnemyAt(typeId, pos2.x, pos2.y);
      if (e2) e2.spawnT = 0.35;
    }
    return e;
  },

  spawnBoss: function () {
    var def = bossForWave(this.wave);
    // 注意：wave < 1 时 (wave-1)/15 会取到 -1，必须夹到 0，否则 Boss 血量会被缩小到 15%
    var loop = Math.max(0, Math.floor((this.wave - 1) / (BOSSES.length * 5)));
    var hpScale = (1 + loop * 1.05) * this.diff.hpMul * (1 + this.wave * 0.055) *
      (this.diff.bossHpMul || 1) * (this.player ? (this.player.stats.bossHpMul || 1) : 1);
    var pos = this.edgePosition();
    var b = {
      type: def.id, def: def, x: pos.x, y: pos.y, vx: 0, vy: 0,
      hp: def.hp * hpScale, maxHp: def.hp * hpScale,      r: def.radius, speed: def.speed, dmg: def.dmg * this.diff.dmgMul,
      armor: 6 + loop * 2 + this.wave * 0.25, xpValue: def.xp, gold: def.gold + this.wave * 4,
      elite: true, isBoss: true, dead: false,
      cd: {}, hitFlash: 0, rot: 0, wobbleT: 0,
      slowT: 0, slowMul: 1, stunT: 0, burnT: 0, burnDps: 0, spawnT: 1.0,
      attackCd: {}, state: 'idle', stateT: 0, timer: 0
    };
    for (var i = 0; i < def.attacks.length; i++) b.attackCd[def.attacks[i].type + i] = rand(1.2, 3.2);
    this.boss = b;
    this.bossDef = def;
    this.enemies.push(b);
    Grid.insert(b);
    UI.el.bossName.textContent = def.name + '  ·  ' + def.en + (loop > 0 ? '  +' + loop : '');
    UI.show('bossBar');
    UI.width('bossFill', 1);
    this.cam.addShake(20);
    Particles.shock(b.x, b.y, 20, 520, { color: def.color, life: 0.8, width: 9 });
    return b;
  },

  /** 给敌人施加一条精英词缀（同时处理血量/护盾等即时效用） */
  applyAffix: function (e, af) {
    if (!e || !af) return;
    if (!e.affixes) e.affixes = [];
    if (e.affixes.indexOf(af) >= 0) return;
    e.affixes.push(af);
    if (af.hpMul) { e.maxHp = Math.round(e.maxHp * af.hpMul); e.hp = e.maxHp; }
    if (af.shield) e.shield = e.maxHp * 0.55;
  },

  /** 刷怪点。给了 angle 就沿该方向生成（±0.18 抖动），便于"成股涌入"。
   *  半径以「视口对角线的一半」为基准——这是唯一能保证任何方向都在屏幕外的基准。 */
  edgePosition: function (angle, pad) {
    var p = this.player;
    var R = Math.hypot(View.w, View.h) / 2 / this.cam.zoom + (pad == null ? SPAWN_PAD : pad);
    var a = (angle == null) ? rand(0, TAU) : angle + rand(-0.18, 0.18);
    return { x: p.x + Math.cos(a) * R, y: p.y + Math.sin(a) * R };
  },

  /* ------------------------------------------------ 武器 */
  /** 武器当前实际参数（进化后走进化形态的数值） */
  wStats: function (w) {
    var def = WEAPONS[w.id];
    return (w.evo && def.evo) ? evolvedStats(w.id) : weaponStats(w.id, w.lv);
  },
  /** 武器当前显示信息（进化后改名换色） */
  wDisp: function (w) {
    var def = WEAPONS[w.id];
    if (w.evo && def.evo) return { name: def.evo.name, glyph: def.evo.glyph, color: def.evo.color };
    return { name: def.name, glyph: def.glyph, color: def.color };
  },

  updateWeapons: function (dt) {
    var p = this.player, st = p.stats;
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      var def = WEAPONS[w.id];
      var stats = this.wStats(w);
      var haste = st.hasteMul;
      w.timer -= dt * haste;
      switch (def.kind) {
        case 'projectile': this.wBolt(w, stats, def); break;
        case 'aura': this.wAura(w, stats, def, dt); break;
        case 'orbit': this.wOrbit(w, stats, def, dt); break;
        case 'chain': this.wChain(w, stats, def); break;
        case 'homing': this.wHoming(w, stats, def); break;
        case 'nova': this.wNova(w, stats, def); break;
        case 'mine': this.wMine(w, stats, def); break;
        case 'beam': this.wBeam(w, stats, def, dt); break;
      }
    }
  },

  /** 通用：取武器实际伤害（乘上玩家加成；大招「超载熔毁」期间再翻倍） */
  wDmg: function (base) {
    var p = this.player;
    var mult = p.stats.dmgMul;
    if (p.ultActive && p.ultActive.t > 0 && p.ultActive.dmgMul) mult *= p.ultActive.dmgMul;
    return base * mult;
  },
  /** 通用：取技能实际范围（同上） */
  wArea: function (v) {
    var p = this.player;
    var mult = p.stats.areaMul;
    if (p.ultActive && p.ultActive.t > 0 && p.ultActive.areaMul) mult *= p.ultActive.areaMul;
    return v * mult;
  },
  /** 包一层，让内部造成的伤害都归到这把武器账上（结算面板会用到） */
  withWeapon: function (w, fn) {
    var prev = this._w;
    this._w = w;
    try { fn(); } finally { this._w = prev; }
  },

  /* -------- 弹幕类武器 -------- */
  wBolt: function (w, s, def) {
    if (w.timer > 0) return;
    var p = this.player;
    var col = this.wDisp(w).color;
    var target = nearestEnemy(this, p.x, p.y, 660 * p.stats.areaMul);
    if (!target) { w.timer = 0.05; return; }
    w.timer = Math.max(0.06, s.cd);
    var base = Math.atan2(target.y - p.y, target.x - p.x);
    for (var i = 0; i < s.count; i++) {
      var off = s.count === 1 ? 0 : (i - (s.count - 1) / 2) * s.spread;
      var a = base + off + rand(-0.02, 0.02);
      this.spawnBullet({
        x: p.x + Math.cos(a) * 14, y: p.y + Math.sin(a) * 14,
        a: a, speed: s.speed, dmg: this.wDmg(s.dmg),
        pierce: s.pierce + p.stats.pierceBonus,
        life: s.life, r: w.evo ? 7 : 5.5, color: col, kind: 'bolt',
        aoe: s.aoe ? this.wArea(s.aoe) : 0,
        turn: s.turn || 0,
        burn: !!s.burnZone,
        slowMul: s.slowOnHit ? s.slowMul : 0,
        slowDur: s.slowOnHit ? s.slowDur : 0,
        w: w
      });
    }
    Sfx.shoot(w.lv);
    Particles.burst(p.x + Math.cos(base) * 16, p.y + Math.sin(base) * 16, w.evo ? 6 : 3, {
      dir: base, spread: 0.7, speed: 150, life: 0.2, size: 2.4, color: col
    });
  },

  spawnBullet: function (o) {
    if (this.bullets.length >= MAX_BULLETS) this.bullets.shift();
    var a = o.a;
    this.bullets.push({
      x: o.x, y: o.y,
      vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed,
      a: a, dmg: o.dmg, pierce: o.pierce == null ? 1 : o.pierce,
      life: o.life, maxLife: o.life, r: o.r, color: o.color,
      hit: [], kind: o.kind || 'bolt', rot: a, trail: [],
      turn: o.turn || 0, speed: o.speed, aoe: o.aoe || 0,
      burn: !!o.burn, split: o.split || 0, knock: o.knock || 0,
      slowMul: o.slowMul || 0, slowDur: o.slowDur || 0,
      w: o.w || null
    });
  },

  /* -------- 光环 -------- */
  wAura: function (w, s, def, dt) {
    var p = this.player;
    var col = this.wDisp(w).color;
    var radius = this.wArea(s.radius);
    if (w.timer <= 0) {
      w.timer = Math.max(0.08, s.tick);
      var dmg = this.wDmg(s.dmg);
      var r2 = radius * radius;
      var self = this;
      var cand = this._candC || (this._candC = []);
      Grid.query(p.x, p.y, radius + MAX_ENEMY_R, cand);
      this.withWeapon(w, function () {
        for (var i = 0; i < cand.length; i++) {
          var e = cand[i];
          if (e.dead) continue;
          if (dist2(p.x, p.y, e.x, e.y) > r2) continue;
          self.damageEnemy(e, dmg, { color: col, silent: true, w: w });
          if (s.slowOnHit) self.applySlow(e, s.slowMul, s.slowDur);
          if (s.percentHp) self.damageEnemy(e, e.maxHp * s.percentHp * s.tick, { color: '#ffb066', silent: true, noCrit: true, w: w, dot: true });
        }
      });
      if (Math.random() < 0.5) {
        Particles.ring(p.x, p.y, 4, radius * 0.92, { color: col, speed: 40, life: 0.5, size: 2.2 });
      }
    }
    w.visualR = radius;
  },

  /* -------- 环刃 -------- */
  wOrbit: function (w, s, def, dt) {
    var p = this.player;
    var col = this.wDisp(w).color;
    var radius = this.wArea(s.radius);
    w.angle += s.rot * dt;
    w.visualR = radius;
    w.visualCount = s.count;
    w.visualSize = s.size * (s.bigBlade ? 1.2 : 1);
    var hitCd = s.hitCd / this.player.stats.hasteMul;
    var self = this;
    var reach = w.visualSize + 6;
    // 先用网格筛出轨道附近的敌人：12 把刃 × 300 敌人 = 3600 次检测 → 十几个
    var cand = this._candC || (this._candC = []);
    Grid.query(p.x, p.y, radius + reach + MAX_ENEMY_R + 20, cand);
    this.withWeapon(w, function () {
      for (var i = 0; i < s.count; i++) {
        // 双层轮盘：奇数刃半径缩到 68% 并反向旋转
        var inner = s.doubleRing && (i % 2 === 1);
        var rr = inner ? radius * 0.68 : radius;
        var a = (inner ? -w.angle : w.angle) + (i / s.count) * TAU;
        var bx = p.x + Math.cos(a) * rr, by = p.y + Math.sin(a) * rr;
        for (var j = 0; j < cand.length; j++) {
          var e = cand[j];
          if (e.dead) continue;
          if (dist2(bx, by, e.x, e.y) > (reach + e.r) * (reach + e.r)) continue;
          if (self.time - (e.cd.orbit || -99) < hitCd) continue;
          e.cd.orbit = self.time;
          self.damageEnemy(e, self.wDmg(s.dmg), {
            color: col, knock: 130, kx: Math.cos(a), ky: Math.sin(a), w: w
          });
          if (s.lifesteal && self.time - (e.cd.orbitHeal || -99) > 0.6) {
            e.cd.orbitHeal = self.time;
            p.hp = Math.min(p.stats.hpMax, p.hp + 1);
          }
        }
      }
    });
  },

  /* -------- 雷链 -------- */
  wChain: function (w, s, def) {
    if (w.timer > 0) return;
    var p = this.player;
    var col = this.wDisp(w).color;
    var start = nearestEnemy(this, p.x, p.y, s.search * this.player.stats.areaMul);
    if (!start) { w.timer = 0.15; return; }
    w.timer = Math.max(0.2, s.cd);
    var hit = [start];
    var pts = [{ x: p.x, y: p.y }];
    var cur = start;
    var dmg = this.wDmg(s.dmg);
    var falloff = 1;
    var forceCrit = !!s.forceCrit;
    var self = this;
    this.withWeapon(w, function () {
      for (var i = 0; i <= s.count; i++) {
        if (!cur) break;
        pts.push({ x: cur.x, y: cur.y });
        self.damageEnemy(cur, dmg * falloff, { color: col, crit: forceCrit ? true : undefined, silent: i > 0, w: w });
        if (s.stun) self.applyStun(cur, 0.25);
        falloff *= s.falloff;
        // 找下一个最近的未命中目标
        var next = null, bd = (s.range * p.stats.areaMul) * (s.range * p.stats.areaMul);
        for (var j = 0; j < self.enemies.length; j++) {
          var e = self.enemies[j];
          if (e.dead || hit.indexOf(e) >= 0) continue;
          var d = dist2(cur.x, cur.y, e.x, e.y);
          if (d < bd) { bd = d; next = e; }
        }
        cur = next;
        if (cur) hit.push(cur);
      }
    });
    this.bolts.push({ pts: pts, life: 0, max: 0.22, color: col });
    Sfx.laser();
    this.cam.addShake(w.evo ? 3 : 1.6);
  },

  /* -------- 追猎飞弹 -------- */
  wHoming: function (w, s, def) {
    if (w.timer > 0) return;
    var p = this.player;
    var col = this.wDisp(w).color;
    var target = nearestEnemy(this, p.x, p.y, 720 * this.player.stats.areaMul);
    if (!target) { w.timer = 0.2; return; }
    w.timer = Math.max(0.2, s.cd);
    for (var i = 0; i < s.count; i++) {
      var a = Math.atan2(target.y - p.y, target.x - p.x) + (i - (s.count - 1) / 2) * 0.5 + rand(-0.1, 0.1);
      this.spawnBullet({
        x: p.x, y: p.y, a: a, speed: s.speed, dmg: this.wDmg(s.dmg),
        pierce: 0, life: s.life, r: w.evo ? 7.5 : 6, color: col,
        kind: 'missile', turn: s.turn, aoe: this.wArea(s.aoe),
        burn: !!s.burnZone, split: s.split || 0,
        knock: s.knockHard ? 320 : 150, w: w
      });
    }
    Sfx.shoot(2);
  },

  /* -------- 脉冲新星 -------- */
  wNova: function (w, s, def) {
    if (w.timer > 0) return;
    var p = this.player;
    if (this.enemies.length === 0) { w.timer = 0.25; return; }
    var col = this.wDisp(w).color;
    w.timer = Math.max(0.5, s.cd);
    this.shocks.push({
      x: p.x, y: p.y, r: 12, max: this.wArea(s.radius), life: 0,
      dur: s.pull ? 0.5 : 0.34,
      dmg: this.wDmg(s.dmg), hit: [], color: col, knock: s.knock,
      slow: s.slowOnHit ? { mul: s.slowMul, dur: s.slowDur } : null,
      repeat: !!s.doubleNova, did: 0,
      pull: s.pull ? this.wArea(s.pull) : 0, w: w
    });
    if (s.burnZone) {
      this.addZone(p.x, p.y, this.wArea(s.radius) * 0.8, 3, this.wDmg(s.dmg) * 0.16, '#ff8a3d', w);
    }
    Sfx.explode(w.evo ? true : false);
    this.cam.addShake(w.evo ? 9 : 4);
  },

  /* -------- 地雷 -------- */
  wMine: function (w, s, def) {
    if (w.timer > 0) return;
    var p = this.player;
    if (this.mines.length >= s.count) this.mines.shift();
    w.timer = Math.max(0.25, s.cd);
    var a = rand(0, TAU), d = rand(6, s.drop);
    this.mines.push({
      x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d,
      r: 12, aoe: this.wArea(s.aoe), dmg: this.wDmg(s.dmg),
      arm: 0, armTime: s.arm, life: 0, maxLife: s.life, color: this.wDisp(w).color,
      chain: !!s.chainBoom, burn: !!s.burnZone, seek: s.seek || 0, w: w
    });
    Sfx.ui();
  },

  /* -------- 射线 -------- */
  wBeam: function (w, s, def, dt) {
    var p = this.player;
    var col = this.wDisp(w).color;
    var length = this.wArea(s.length);
    w.beams = [];

    if (s.sweep) {
      // 进化形态：四道光束锁定最近的目标，并围绕目标缓慢摆动（末日光束）
      // 没有目标时退化为一圈旋转的光扇，保证画面与手感
      w.sweepA = (w.sweepA || 0) + s.sweep * dt;
      var lockTargets = [];
      for (var li = 0; li < this.enemies.length && lockTargets.length < s.targets; li++) {
        var lb = null, lbd = Infinity;
        for (var lj = 0; lj < this.enemies.length; lj++) {
          var le = this.enemies[lj];
          if (le.dead || lockTargets.indexOf(le) >= 0) continue;
          var ld = dist2(p.x, p.y, le.x, le.y);
          if (ld < lbd) { lbd = ld; lb = le; }
        }
        if (!lb) break;
        lockTargets.push(lb);
      }
      if (lockTargets.length) {
        for (var lk = 0; lk < lockTargets.length; lk++) {
          var lt = lockTargets[lk];
          var la = Math.atan2(lt.y - p.y, lt.x - p.x) + Math.sin(w.sweepA * 2 + lk) * 0.08;
          w.beams.push({
            x1: p.x, y1: p.y,
            x2: p.x + Math.cos(la) * length, y2: p.y + Math.sin(la) * length,
            width: s.width
          });
        }
      } else {
        for (var q = 0; q < s.targets; q++) {
          var aq = w.sweepA + (q / s.targets) * TAU;
          w.beams.push({
            x1: p.x, y1: p.y,
            x2: p.x + Math.cos(aq) * length, y2: p.y + Math.sin(aq) * length,
            width: s.width
          });
        }
      }
    } else {
      // 单趟扫描选出最近的 N 个目标（避免每帧分配数组）
      var targets = [];
      for (var i = 0; i < this.enemies.length && targets.length < s.targets; i++) {
        var best = null, bd = Infinity;
        for (var j = 0; j < this.enemies.length; j++) {
          var e2 = this.enemies[j];
          if (e2.dead) continue;
          if (targets.indexOf(e2) >= 0) continue;
          var d2 = dist2(p.x, p.y, e2.x, e2.y);
          if (d2 < bd) { bd = d2; best = e2; }
        }
        if (!best) break;
        targets.push(best);
      }
      if (!targets.length) { w.timer = 0; return; }
      for (var k = 0; k < targets.length; k++) {
        var t = targets[k];
        var a = Math.atan2(t.y - p.y, t.x - p.x);
        w.beams.push({ x1: p.x, y1: p.y, x2: p.x + Math.cos(a) * length, y2: p.y + Math.sin(a) * length, width: s.width });
      }
    }

    // 每 tick 结算一次（对所有光束，且同一敌人不重复计伤）
    var tick = w.timer <= 0;
    if (tick) w.timer = Math.max(0.05, s.tick);
    if (!tick) return;

    var hitDmg = this.wDmg(s.dps * s.tick);
    var hitAny = false;
    var seen = [];
    var self = this;
    this.withWeapon(w, function () {
      for (var b = 0; b < w.beams.length; b++) {
        var bm = w.beams[b];
        for (var m = 0; m < self.enemies.length; m++) {
          var en = self.enemies[m];
          if (en.dead) continue;
          if (seen.indexOf(en) >= 0) continue;
          if (pointLineDist(en.x, en.y, bm.x1, bm.y1, bm.x2, bm.y2) > en.r + bm.width * 0.5) continue;
          self.damageEnemy(en, hitDmg, { color: col, silent: true, w: w });
          if (s.vuln) en.vulnT = Math.max(en.vulnT || 0, 0.4);
          seen.push(en);
          hitAny = true;
          // 未精通时射线被首个敌人阻挡
          if (!s.pierceAll) break;
        }
      }
    });
    if (hitAny && Math.random() < 0.5) {
      var b0 = w.beams[0];
      Particles.burst(b0.x2, b0.y2, 3, { color: col, speed: 130, life: 0.22, size: 2.6 });
    }
    if (Math.random() < 0.4) {
      var pa = Math.atan2(w.beams[0].y2 - p.y, w.beams[0].x2 - p.x);
      Sfx.laser();
      Particles.burst(p.x + Math.cos(pa) * 16, p.y + Math.sin(pa) * 16, 1, { color: col, speed: 80, life: 0.2, size: 2.2 });
    }
  },

  /* ------------------------------------------------ 伤害结算 */
  damageEnemy: function (e, amount, opts) {
    opts = opts || {};
    if (e.dead || this.state !== 'playing') return 0;
    var st = this.player.stats;
    var p = this.player;
    var crit = opts.crit;
    if (crit === undefined) crit = !opts.noCrit && Math.random() < st.critChance;
    var dmg = amount * (crit ? st.critMul : 1);
    // 遗物「狂战之怒」：生命越低伤害越高
    if (p.relicFlags.berserk) dmg *= 1 + 0.7 * clamp(1 - p.hp / st.hpMax, 0, 1);
    if (e.vulnT > 0) dmg *= 1.15;
    dmg = Math.max(1, dmg - e.armor * (opts.dot ? 0.25 : 1));
    // 精英词缀「护盾」：先扣护盾，护盾破前免疫击退
    if (e.shield > 0) {
      var absorbed = Math.min(e.shield, dmg);
      e.shield -= absorbed;
      dmg -= absorbed;
      if (e.shield <= 0) {
        Particles.shock(e.x, e.y, e.r + 4, e.r * 3, { color: '#4ff0ff', life: 0.35, width: 5 });
        Sfx.hit();
      }
      if (dmg <= 0) {
        Particles.burst(e.x, e.y, 4, { color: '#4ff0ff', speed: 170, life: 0.3, size: 2.6 });
        return absorbed;
      }
    }
    e.hp -= dmg;
    e.hitFlash = 1;
    this.player.dmgDealt += dmg;
    var src = opts.w || this._w;
    if (src) src.dealt = (src.dealt || 0) + dmg;
    // 遗物「冰霜之心」：所有伤害附带减速
    if (p.relicFlags.frost) this.applySlow(e, 0.82, 0.8);
    if (opts.slow) this.applySlow(e, opts.slow.mul, opts.slow.dur);
    if (opts.burn) this.applyBurn(e, opts.burn.dps, opts.burn.dur);

    if (!opts.silent || crit) {
      // 伤害数字：可关闭/只留暴击；另外每帧有总量上限——
      // 满屏几百个数字既看不清也吃性能，暴击优先保留
      var wantText = (!opts.silent || crit) && Fx.allowDamageText(crit);
      if (wantText) {
        if (crit) {
          if (this._dmgCrit < 8) { this._dmgCrit++; wantText = true; } else wantText = false;
        } else {
          if (this._dmgText < 14) { this._dmgText++; wantText = true; } else wantText = false;
        }
      }
      if (wantText) {
        Particles.text(e.x + rand(-6, 6), e.y - e.r - 4, fmtNum(dmg),
          { color: crit ? '#ffd166' : (opts.color || '#ffffff'), size: crit ? 15 : 12, crit: crit, life: crit ? 0.85 : 0.6 });
      }
    }
    if (crit) { Sfx.crit(); this.cam.addShake(0.5); this.player.critCount = (this.player.critCount || 0) + 1; }
    else if (Math.random() < 0.28) Sfx.hit();

    Particles.burst(e.x, e.y, crit ? 7 : 3, {
      color: [opts.color || '#ffffff', '#ffffff'], speed: 190, life: 0.32, size: 2.6,
      dir: opts.kx != null ? Math.atan2(opts.ky, opts.kx) : 0,
      spread: opts.kx != null ? 1.1 : TAU, jitter: e.r * 0.5
    });

    if (opts.knock && e.shield <= 0) {
      var mag = opts.knock / Math.max(1, e.r / 12);
      e.vx += (opts.kx || 0) * mag;
      e.vy += (opts.ky || 0) * mag;
      if (!e.isBoss && Math.random() < 0.5) {
        var ang = Math.atan2(e.y - this.player.y, e.x - this.player.x) + rand(-0.5, 0.5);
        e.vx += Math.cos(ang) * mag * 0.6; e.vy += Math.sin(ang) * mag * 0.6;
      }
    }

    if (e.hp <= 0) this.killEnemy(e);
    return dmg;
  },

  applySlow: function (e, mul, dur) {
    if (e.isBoss) { mul = lerp(1, mul, 0.45); dur *= 0.6; }
    e.slowMul = Math.min(e.slowMul, mul);
    e.slowT = Math.max(e.slowT, dur);
  },
  applyStun: function (e, dur) {
    if (e.isBoss) dur *= 0.25;
    e.stunT = Math.max(e.stunT, dur);
  },
  applyBurn: function (e, dps, dur) {
    e.burnDps = Math.max(e.burnDps, dps);
    e.burnT = Math.max(e.burnT, dur);
  },

  killEnemy: function (e) {
    if (e.dead) return;
    e.dead = true;
    var p = this.player;
    this.kills++;
    p.kills++;

    if (e.isBoss) {
      this.onBossKilled(e);
      return;
    }

    // 连击
    this.combo++;
    this.comboT = 2.4;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    if (this.combo >= 3) UI.combo(this.combo);

    // 死亡表现
    var col = e.elite ? [ELITE.color, e.def.color] : [e.def.color, '#ffffff'];
    Particles.burst(e.x, e.y, e.elite ? 26 : 12, { color: col, speed: e.elite ? 300 : 210, life: 0.55, size: e.elite ? 4 : 3, jitter: e.r * 0.6 });
    Particles.shock(e.x, e.y, 2, e.r * (e.elite ? 5 : 3), { color: e.def.color, life: 0.3, width: 3 });
    Sfx.kill();
    if (e.elite) { this.cam.addShake(4); this.cam.addHitstop(0.03); }

    // 经验
    this.spawnGem(e.x, e.y, e.xpValue);

    // 金币（遗物「黄金圣杯」让掉率翻倍）
    var greedMul = p.relicFlags.greed ? 2 : 1;
    if (this.goldActive() && (e.elite || chance((0.035 + p.stats.luck * 0.08) * greedMul))) {
      this.spawnCoin(e.x, e.y, e.elite ? randInt(2, 4) : 1);
    }

    // 回血颗粒：普通敌人不掉；精英是概率掉（额外有小概率掉第二颗）
    if (e.elite) {
      if (chance(0.5 + p.stats.luck * 0.15)) this.spawnOrb(e.x + rand(-16, 16), e.y + rand(-16, 16));
      if (chance(0.2)) this.spawnOrb(e.x + rand(-16, 16), e.y + rand(-16, 16));
    }

    // 终极技能充能
    this.addUltCharge(e.elite ? 3 : 1);

    // 遗物：吞噬者之胃
    if (p.relicFlags.lifesteal) p.hp = Math.min(p.stats.hpMax, p.hp + 0.5);

    // 精英词缀的死亡效果
    for (var ai = 0; ai < (e.affixes ? e.affixes.length : 0); ai++) {
      var af = e.affixes[ai];
      if (af.toxic && !e.silentDeath) {
        this.addZone(e.x, e.y, af.toxic.radius * (e.elite ? 1.3 : 1), af.toxic.dur,
          af.toxic.dps * (this.waveCfg ? this.waveCfg.dmgMul : 1), '#7dff9b', null, true);
        Particles.burst(e.x, e.y, 24, { color: ['#7dff9b', '#b6ffc4'], speed: 190, life: 0.7, size: 3.4 });
      }
      if (af.affixSplit) {
        for (var q = 0; q < af.affixSplit.n; q++) {
          var ch = this.spawnEnemyAt(af.affixSplit.type, e.x + rand(-20, 20), e.y + rand(-20, 20));
          if (ch) ch.spawnT = 0.15;
        }
      }
    }
    // 遗物掉落（精英小概率，且越拿越难拿）
    var p2 = this.player;
    if (e.elite && !this.relicDrops.length) {
      var ch = relicDropChance('elite', Object.keys(p2.relics).length, p2.stats.luck);
      if (chance(ch)) this.dropRelic(e.x, e.y);
    }

    // 分裂
    if (e.def.split && !e.spawnedChildren) {
      for (var i = 0; i < e.def.split.n; i++) {
        var child = this.spawnEnemyAt(e.def.split.type, e.x + rand(-16, 16), e.y + rand(-16, 16));
        if (child) { child.spawnT = 0.15; child.hp *= e.def.split.hpMul; }
      }
    }
    // 自爆
    if (e.def.explode && !e.silentDeath) {
      this.explodeAt(e.x, e.y, e.def.explode.radius, e.def.explode.dmg, '#ff4d4d', false);
    }
  },

  onBossKilled: function (b) {
    if (this.goldActive()) this.runGold += Math.round(b.gold * this.player.stats.goldMul);
    this.cam.addShake(30);
    this.cam.addFlash(0.75, '#ffffff');
    this.cam.addHitstop(0.18);
    Sfx.bossDie();
    Particles.burst(b.x, b.y, 90, { color: [b.def.color, '#ffffff', '#ffd166'], speed: 460, life: 1.1, size: 5, jitter: 24 });
    for (var i = 0; i < 5; i++) {
      Particles.shock(b.x, b.y, i * 8, 300 + i * 140, { color: b.def.color, life: 0.8 + i * 0.12, width: 7 - i });
    }
    Particles.text(b.x, b.y - 40, 'BOSS 击破!', { color: '#ffd166', size: 26, life: 1.8, vy: -40, crit: true, drag: 1.2 });
    for (var k = 0; k < 10; k++) this.spawnGem(b.x + rand(-40, 40), b.y + rand(-40, 40), 22, true);
    if (this.goldActive()) {
      for (var c = 0; c < 10; c++) this.spawnCoin(b.x + rand(-50, 50), b.y + rand(-50, 50), randInt(2, 5));
    }
    for (var ob = 0; ob < 6; ob++) this.spawnOrb(b.x + rand(-60, 60), b.y + rand(-60, 60));
    // Boss 死亡冲击：残余杂兵一并湮灭并化为经验（同时保证本波必然收束）
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e === b || e.dead) continue;
      e.dead = true;
      e.silentDeath = true;
      this.spawnGem(e.x, e.y, e.xpValue || 1, true);
      Particles.burst(e.x, e.y, 6, { color: [b.def.color, e.def.color], speed: 240, life: 0.5, size: 3 });
    }
    this.budgetLeft = 0;
    this.addUltCharge(12);
    // 遗物：第一个 Boss 必掉，之后是概率掉（且持有越多越难掉）
    var owned = Object.keys(this.player.relics).length;
    var src = this.relicsFromBoss ? 'boss' : 'bossFirst';
    this.relicsFromBoss = true;
    if (chance(relicDropChance(src, owned, this.player.stats.luck))) this.dropRelic(b.x, b.y, true);
    UI.hide('bossBar');
    this.boss = null;
    UI.banner('击破 ' + b.def.name, 2000);
    // 波次结束由 updateWaves 检测
  },

  spawnEnemyAt: function (type, x, y, affix) {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    var def = ENEMIES[type];
    if (!def) return null;
    var cfg = this.waveCfg || { hpMul: 1, dmgMul: 1, speedMul: 1, xpMul: 1 };
    var mhp = def.hp * cfg.hpMul * this.player.stats.enemyHpMul;
    var e = {
      type: type, def: def, x: x, y: y, vx: 0, vy: 0,
      hp: mhp, maxHp: mhp, r: def.radius, speed: def.speed * cfg.speedMul,
      dmg: def.dmg * cfg.dmgMul, armor: def.armor, xpValue: def.xp * cfg.xpMul,
      elite: false, isBoss: false, dead: false, cd: {}, hitFlash: 0, rot: rand(0, TAU),
      wobbleT: rand(0, 10), slowT: 0, slowMul: 1, stunT: 0, burnT: 0, burnDps: 0,
      shield: 0, affixes: [], rage: 0,
      vampT: rand(0.5, 1.5), summonT: rand(2, 5),
      spawnT: 0.2, timer: rand(0, 1), spawnedChildren: false
    };
    if (affix) this.applyAffix(e, affix);
    this.enemies.push(e);
    Grid.insert(e);
    return e;
  },

  explodeAt: function (x, y, radius, dmg, color, friendly, w, slow) {
    Particles.shock(x, y, 6, radius, { color: color, life: 0.35, width: 5 });
    Particles.burst(x, y, 16, { color: [color, '#ffffff'], speed: 300, life: 0.45, size: 3.4 });
    if (friendly) {
      var r2 = radius * radius;
      var cand = this._candB || (this._candB = []);
      Grid.query(x, y, radius + MAX_ENEMY_R, cand);
      for (var i = 0; i < cand.length; i++) {
        var e = cand[i];
        if (e.dead) continue;
        if (dist2(x, y, e.x, e.y) > r2) continue;
        var a = Math.atan2(e.y - y, e.x - x);
        this.damageEnemy(e, dmg, {
          color: color, knock: 170, kx: Math.cos(a), ky: Math.sin(a), w: w || null,
          slow: slow || null
        });
      }
    } else {
      if (dist2(x, y, this.player.x, this.player.y) < radius * radius) {
        this.hurtPlayer(dmg, 'explosion');
      }
    }
  },

  /** 金币产出：无尽阶段也掉（局内商店是消耗渠道，不会再一把刷满永久商店） */
  goldActive: function () { return true; },

  /* ------------------------------------------------ 终极技能 */
  /** 大招是否处于"不能充能"的状态（释放中不积累充能，避免无限连发） */
  ultLocked: function () {
    var p = this.player;
    return !!(p && p.ultActive && p.ultActive.t > 0);
  },

  addUltCharge: function (n) {
    var p = this.player;
    if (!p || !p.ult) return;
    if (this.ultLocked()) return;           // 释放期间不充能
    if (p.ultCharge >= p.ult.need) return;
    p.ultCharge = Math.min(p.ult.need, p.ultCharge + n);
    if (p.ultCharge >= p.ult.need) {
      UI.toast('★ ' + p.ult.name + ' 已就绪 · 按 Q 释放');
      Sfx.levelUp();
      Particles.shock(p.x, p.y, 12, 220, { color: p.ult.color, life: 0.6, width: 5 });
    }
  },

  castUlt: function () {
    var p = this.player;
    if (!p || !p.ult || this.state !== 'playing') return false;
    if (p.ultCharge < p.ult.need) { Sfx.ui(); UI.toast('终极技能充能中 ' + Math.floor(p.ultCharge) + '/' + p.ult.need); return false; }
    p.ultCharge = 0;
    p.ultCasts = (p.ultCasts || 0) + 1;
    var u = p.ult;
    p.ultActive = { type: u.type, t: u.dur || 0, dur: u.dur || 0, dmgMul: u.dmgMul || 0, areaMul: u.auraMul || 0, jetT: 0 };
    UI.banner(u.name, 1600);
    Sfx.bossWarn();
    this.cam.addShake(14);
    this.cam.addFlash(0.35, u.color);
    Particles.shock(p.x, p.y, 16, 420, { color: u.color, life: 0.7, width: 8 });
    Particles.burst(p.x, p.y, 40, { color: [u.color, '#ffffff'], speed: 380, life: 0.8, size: 4 });

    if (u.type === 'orbital') {
      // 轨道炮击：依次在随机的敌人（或玩家四周）头顶落下一道激光
      for (var i = 0; i < u.count; i++) {
        var target = null;
        if (this.enemies.length) target = this.enemies[(Math.random() * this.enemies.length) | 0];
        var tx = target ? target.x : p.x + rand(-260, 260);
        var ty = target ? target.y : p.y + rand(-260, 260);
        var self = this;
        (function (x, y, idx) {
          setTimeout(function () {
            if (self.state !== 'playing') return;
            self.orbitalStrike(x, y, u);
          }, idx * u.delay * 1000);
        })(tx, ty, i);
      }
    } else if (u.type === 'phase') {
      // 相位突袭：沿朝向瞬移，路径上造成伤害并留下爆炸
      var a = p.facing;
      var sx = p.x, sy = p.y;
      p.x += Math.cos(a) * u.dist;
      p.y += Math.sin(a) * u.dist;
      p.invuln = Math.max(p.invuln, u.invuln);
      p.dashT = 0;
      p.vx = 0; p.vy = 0;
      var steps = 3;
      for (var k = 0; k <= steps; k++) {
        var t2 = k / steps;
        this.explodeAt(sx + (p.x - sx) * t2, sy + (p.y - sy) * t2, 120, u.dmg, u.color, true, null, null);
      }
      Particles.shock(sx, sy, 10, 300, { color: u.color, life: 0.5, width: 6 });
      Particles.shock(p.x, p.y, 10, 300, { color: u.color, life: 0.5, width: 6 });
    }
    return true;
  },

  /** 轨道炮击的单发落点 */
  orbitalStrike: function (x, y, u) {
    var dmg = this.wDmg(u.dmg);
    this.cam.addShake(7);
    this.cam.addFlash(0.16, u.color);
    Sfx.explode(true);
    Particles.shock(x, y, 8, u.radius * 1.5, { color: u.color, life: 0.45, width: 7 });
    Particles.burst(x, y, 26, { color: [u.color, '#ffffff'], speed: 420, life: 0.6, size: 4 });
    this.addZone(x, y, u.radius * 0.9, 4, dmg * 0.12, u.color, null);
    var r2 = u.radius * u.radius;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      if (dist2(x, y, e.x, e.y) > r2) continue;
      var a = Math.atan2(e.y - y, e.x - x);
      this.damageEnemy(e, dmg, { color: u.color, knock: 300, kx: Math.cos(a), ky: Math.sin(a) });
    }
    this.player.ultDealt += dmg;
  },

  updateUlt: function (dt) {
    var p = this.player;
    if (!p || !p.ult) return;
    // 被动充能：约 100 秒充满；释放期间暂停
    if (p.ultCharge < p.ult.need && !this.ultLocked()) {
      p.ultCharge = Math.min(p.ult.need, p.ultCharge + (p.ult.need / 100) * dt);
    }
    if (Input.hit('q')) this.castUlt();

    if (p.ultActive) {
      p.ultActive.t -= dt;
      if (p.ultActive.type === 'overload') {
        p.ultActive.jetT -= dt;
        if (p.ultActive.jetT <= 0) {
          p.ultActive.jetT = 0.3;
          // 向四周喷发火焰弹
          var n = 10;
          for (var i = 0; i < n; i++) {
            var a = (i / n) * TAU + this.time * 0.6;
            this.spawnBullet({
              x: p.x, y: p.y, a: a, speed: 420, dmg: this.wDmg(38),
              pierce: 2, life: 0.75, r: 6, color: '#ff8a3d', kind: 'bolt',
              slowMul: 0.88, slowDur: 0.5, w: null
            });
          }
          Sfx.shoot(3);
          Particles.ring(p.x, p.y, 12, this.wArea(60), { color: '#ff8a3d', speed: 300, life: 0.35, size: 3 });
        }
      }
      if (p.ultActive.t <= 0) {
        p.ultActive = null;
        UI.toast('终极技能结束');
      }
    }
  },

  /** 遗物「虚空棱镜」：周期性向四周发射星弹 */
  updateRelicEffects: function (dt) {
    var p = this.player;
    if (p.relicFlags.prism) {
      p.prismT -= dt;
      if (p.prismT <= 0) {
        p.prismT = 6;
        var n = 12;
        for (var i = 0; i < n; i++) {
          this.spawnBullet({
            x: p.x, y: p.y, a: (i / n) * TAU + this.time, speed: 460,
            dmg: this.wDmg(30), pierce: 1, life: 1.0, r: 5.5, color: '#b07dff',
            kind: 'bolt', w: null
          });
        }
        Sfx.shoot(2);
        Particles.ring(p.x, p.y, 14, 40, { color: '#b07dff', speed: 320, life: 0.4, size: 3 });
      }
    }
    if (p.thornsT > 0) p.thornsT -= dt;
  },

  /* ------------------------------------------------ 遗物掉落 */
  dropRelic: function (x, y, guaranteed) {
    var p = this.player;
    // 单局上限：遗物是稀有惊喜，不是常规资源
    if (Object.keys(p.relics).length + this.relicDrops.length >= RELIC_MAX_PER_RUN) return null;
    var pool = RELIC_IDS.filter(function (id) { return !p.relics[id]; });
    if (!pool.length) {
      // 全收集了：折算成金币和补给
      this.runGold += 120;
      UI.toast('遗物已全收集 · 转化为 120 金币');
      return null;
    }
    var id = pick(pool);
    this.relicDrops.push({ x: x, y: y, id: id, life: 0, rot: rand(0, TAU), vx: rand(-40, 40), vy: rand(-40, 40) });
    Particles.shock(x, y, 8, 160, { color: RELICS[id].color, life: 0.6, width: 5 });
    return id;
  },

  updateRelicDrops: function (dt) {
    var p = this.player;
    var pr = p.stats.pickup * p.stats.pickupMul * 0.8;
    for (var i = this.relicDrops.length - 1; i >= 0; i--) {
      var r = this.relicDrops[i];
      r.life += dt;
      var d = dist(p.x, p.y, r.x, r.y);
      if (d < pr) {
        var a = Math.atan2(p.y - r.y, p.x - r.x);
        r.vx = damp(r.vx, Math.cos(a) * 420, 7, dt);
        r.vy = damp(r.vy, Math.sin(a) * 420, 7, dt);
      } else { r.vx = damp(r.vx, 0, 5, dt); r.vy = damp(r.vy, 0, 5, dt); }
      r.x += r.vx * dt; r.y += r.vy * dt;
      if (d < 26) {
        this.grantRelic(r.id);
        this.relicDrops.splice(i, 1);
      }
    }
  },

  grantRelic: function (id) {
    var p = this.player;
    var rel = RELICS[id];
    if (!rel || p.relics[id]) return;
    p.relics[id] = 1;
    var before = p.stats.hpMax;
    this.recomputeStats(true);
    if (p.stats.hpMax > before) p.hp = Math.min(p.stats.hpMax, p.hp + (p.stats.hpMax - before));
    if (p.hp > p.stats.hpMax) p.hp = p.stats.hpMax;
    if (rel.flag === 'phoenix') { p.revives++; }
    this.cam.addFlash(0.4, rel.color);
    this.cam.addShake(10);
    this.cam.addHitstop(0.08);
    Sfx.coin();
    Sfx.levelUp();
    Particles.burst(p.x, p.y, 50, { color: [rel.color, '#ffffff', '#ffd166'], speed: 380, life: 1.0, size: 4 });
    Particles.shock(p.x, p.y, 12, 320, { color: rel.color, life: 0.7, width: 7 });
    Particles.text(p.x, p.y - 46, rel.name, { color: rel.color, size: 22, life: 1.6, vy: -42, crit: true, drag: 1.2 });
    UI.banner('遗物 · ' + rel.name, 1800);
    UI.toast(rel.desc);
    this.rebuildRelicBar();
    this.rebuildLoadout();
  },

  rebuildRelicBar: function () {
    if (!UI.ready || !this.player) return;
    var box = UI.el.relicBar;
    if (!box) return;
    box.innerHTML = '';
    for (var id in this.player.relics) {
      var rel = RELICS[id];
      if (!rel) continue;
      var d = document.createElement('div');
      d.className = 'relic';
      d.title = rel.name + '：' + rel.desc;
      d.innerHTML = '<span class="relic-glyph" style="color:' + rel.color + '">' + rel.glyph + '</span>' +
        '<span class="relic-name">' + rel.name + '</span>';
      box.appendChild(d);
    }
    if (box.children.length === 0) box.innerHTML = '<div class="relic empty">暂无遗物 · 击败精英与 Boss 可获得</div>';
  },

  /* ------------------------------------------------ 敌人更新 */
  updateEnemies: function (dt) {
    var p = this.player;
    for (var i = this.enemies.length - 1; i >= 0; i--) {
      var e = this.enemies[i];
      if (e.dead) { this.enemies.splice(i, 1); continue; }
      if (e.hitFlash > 0) e.hitFlash -= dt * 4;
      if (e.spawnT > 0) { e.spawnT -= dt; }
      if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowMul = 1; }
      if (e.stunT > 0) e.stunT -= dt;
      if (e.vulnT > 0) e.vulnT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        this.damageEnemy(e, e.burnDps * dt, { color: '#ff8a3d', silent: true, noCrit: true, dot: true, w: this._w });
        if (Math.random() < 0.25) Particles.burst(e.x, e.y, 1, { color: '#ff8a3d', speed: 60, life: 0.4, size: 2.4 });
        if (e.dead) continue;
      }
      e.wobbleT += dt;
      e.rot += dt * 0.6;

      var dx = p.x - e.x, dy = p.y - e.y;
      var d = Math.hypot(dx, dy) || 1;
      var nx = dx / d, ny = dy / d;
      var speed = e.speed * e.slowMul * p.stats.enemySpeedMul * (e.stunT > 0 ? 0 : 1);
      var ax = 0, ay = 0;

      // ---- 精英词缀：随时间与伤势触发的行为 ----
      if (!e.isBoss && e.affixes.length) {
        for (var afi = 0; afi < e.affixes.length; afi++) {
          var afx = e.affixes[afi];
          // 狂暴：血量越低越快、伤害越高
          if (afx.rage) {
            var hurt = 1 - clamp(e.hp / e.maxHp, 0, 1);
            e.rage = hurt;
            speed *= 1 + (afx.rage.maxMul - 1) * hurt;
            e.dmg = e.def.dmg * (this.waveCfg ? this.waveCfg.dmgMul : 1) * (e.elite ? ELITE.dmgMul : 1) * (1 + (afx.rage.dmgMul - 1) * hurt);
          }
          // 吸血：周期性治疗周围同伴（含自身）
          if (afx.vamp) {
            e.vampT -= dt;
            if (e.vampT <= 0) {
              e.vampT = afx.vamp.cd;
              for (var vi = 0; vi < this.enemies.length; vi++) {
                var vo = this.enemies[vi];
                if (vo.dead || vo.isBoss) continue;
                if (dist2(e.x, e.y, vo.x, vo.y) > afx.vamp.radius * afx.vamp.radius) continue;
                vo.hp = Math.min(vo.maxHp, vo.hp + afx.vamp.hps);
              }
              Particles.ring(e.x, e.y, 12, afx.vamp.radius * 0.6, { color: afx.color, speed: 0, life: 0.5, size: 2.6 });
            }
          }
          // 召唤：周期性召唤小怪
          if (afx.summon) {
            e.summonT -= dt;
            if (e.summonT <= 0) {
              e.summonT = afx.summon.cd;
              for (var si = 0; si < afx.summon.n; si++) {
                var sc = this.spawnEnemyAt(afx.summon.type, e.x + rand(-30, 30), e.y + rand(-30, 30));
                if (sc) sc.spawnT = 0.2;
              }
              Particles.burst(e.x, e.y, 12, { color: afx.color, speed: 250, life: 0.4, size: 3 });
            }
          }
        }
      }

      if (e.isBoss) {
        this.updateBoss(e, dt, nx, ny, d);
        // 冲撞：持续时间与总距离双上限，冲完就停，不会一路冲出屏幕
        if (e.state === 'charge') {
          e.stateT -= dt;
          var travelled = dist(e.chargeFrom.x, e.chargeFrom.y, e.x, e.y);
          if (e.stateT <= 0 || travelled > (e.chargeLeft || 640) || travelled > d + 260) {
            e.state = 'idle';
            Particles.burst(e.x, e.y, 18, { color: e.def.color, speed: 260, life: 0.45, size: 3.5 });
            this.cam.addShake(5);
          }
        }
        // 离玩家太远就加速回场（牵引），保证 Boss 始终在画面里
        e.leash = d > 560 ? clamp(1 + (d - 560) / 160, 1, 4.5) : 1;
        speed = e.speed * e.slowMul * e.leash *
          (e.stunT > 0 ? 0 : (e.state === 'charge' ? 5.0 : (e.windup ? 0.3 : 1)));
        if (e.state === 'charge') { ax = e.chargeDx * speed; ay = e.chargeDy * speed; }
        else { ax = nx * speed * (d > 200 ? 1 : 0.2); ay = ny * speed * (d > 200 ? 1 : 0.2); }
      } else {
        var b = e.def.behavior;
        if (b === 'chase') {
          ax = nx * speed; ay = ny * speed;
          if (e.def.wobble) {
            var wob = Math.sin(e.wobbleT * e.def.wobble) * 0.6;
            ax += -ny * speed * wob; ay += nx * speed * wob;
          }
          if (e.def.explode && d < e.def.explode.radius * 0.55) {
            e.fuse = (e.fuse == null ? e.def.explode.fuse : e.fuse - dt);
            e.pulse = true;
            if (e.fuse <= 0 && !e.silentDeath) {
              e.silentDeath = true;
              this.explodeAt(e.x, e.y, e.def.explode.radius, e.def.explode.dmg * (this.waveCfg ? this.waveCfg.dmgMul : 1), '#ff4d4d', false);
              e.hp = 0;
              this.killEnemy(e);
              continue;
            }
          } else e.pulse = false;
        } else if (b === 'shooter') {
          var rg = e.def.ranged;
          var move = 0;
          if (d > rg.range) move = 1;
          else if (d < rg.keep) move = -1;
          ax = nx * speed * move; ay = ny * speed * move;
          ax += -ny * speed * 0.5; ay += nx * speed * 0.5;
          e.timer -= dt;
          if (d < rg.range * 1.15 && e.timer <= 0) {
            e.timer = rg.cd / (p.stats.rangedHaste || 1);
            var a0 = Math.atan2(dy, dx);
            this.spawnEnemyBullet(e.x, e.y, a0, rg.speed, rg.dmg * (this.waveCfg ? this.waveCfg.dmgMul : 1), rg.radius, rg.color);
            Sfx.shoot(0);
          }
        } else if (b === 'charger') {
          var ch = e.def.charge;
          e.timer -= dt;
          if (e.state === 'wind') {
            e.stateT -= dt;
            ax = -nx * speed * 0.3; ay = -ny * speed * 0.3;
            if (e.stateT <= 0) {
              e.state = 'charge'; e.stateT = ch.dur;
              e.chargeDx = nx; e.chargeDy = ny;
              Sfx.dash();
            }
          } else if (e.state === 'charge') {
            e.stateT -= dt;
            ax = e.chargeDx * speed * ch.mul; ay = e.chargeDy * speed * ch.mul;
            if (Math.random() < 0.6) Particles.burst(e.x, e.y, 1, { color: e.def.color, speed: 60, life: 0.3, size: 3 });
            if (e.stateT <= 0) { e.state = 'idle'; e.timer = ch.cd; }
          } else {
            ax = nx * speed; ay = ny * speed;
            if (e.timer <= 0 && d < 380) { e.state = 'wind'; e.stateT = ch.wind; Particles.burst(e.x, e.y, 8, { color: '#ff8a3d', speed: 120, life: 0.3, size: 3 }); }
          }
        } else if (b === 'orbiter') {
          var ob = e.def.orbit;
          var diff = d - ob.keep;
          var radial = clamp(diff / ob.band, -1, 1);
          ax = nx * speed * radial;
          ay = ny * speed * radial;
          var dirSign = (e.wobbleT % 6 < 3) ? 1 : -1;
          ax += -ny * speed * ob.strafe * dirSign;
          ay += nx * speed * ob.strafe * dirSign;
        }
        // 治疗者
        if (e.def.heal) {
          e.timer -= dt;
          if (e.timer <= 0) {
            e.timer = 1;
            var h = e.def.heal;
            for (var j = 0; j < this.enemies.length; j++) {
              var o = this.enemies[j];
              if (o === e || o.dead || o.isBoss) continue;
              if (dist2(e.x, e.y, o.x, o.y) > h.radius * h.radius) continue;
              o.hp = Math.min(o.hp + h.hps, o.hp + h.hps);
            }
            Particles.ring(e.x, e.y, 10, h.radius * 0.5, { color: e.def.color, speed: 0, life: 0.5, size: 2.4 });
          }
        }
      }

      // 速度积分（含击退）
      e.vx = damp(e.vx, ax, 7, dt);
      e.vy = damp(e.vy, ay, 7, dt);
      e.x += e.vx * dt;
      e.y += e.vy * dt;

      // 轻微分离，避免完全重叠（只抽样邻近几个，保持 O(n)）
      for (var s2 = 1; s2 <= 3; s2++) {
        var k = (i + s2) % this.enemies.length;
        var o2 = this.enemies[k];
        if (!o2 || o2 === e || o2.dead) continue;
        var ddx = o2.x - e.x, ddy = o2.y - e.y;
        var rr = e.r + o2.r;
        var dd2 = ddx * ddx + ddy * ddy;
        if (dd2 > 0.01 && dd2 < rr * rr) {
          var dd = Math.sqrt(dd2);
          var push = (rr - dd) * 0.5;
          var ux = ddx / dd, uy = ddy / dd;
          var w1 = e.isBoss ? 0 : 1, w2 = o2.isBoss ? 0 : 1;
          e.x -= ux * push * w1; e.y -= uy * push * w1;
          o2.x += ux * push * w2; o2.y += uy * push * w2;
        }
      }

      // 接触伤害
      if (!e.dead && e.spawnT <= 0) {
        var cr = e.r + p.r;
        if (dist2(e.x, e.y, p.x, p.y) < cr * cr) {
          if (this.hurtPlayer(e.dmg, e.def.name)) {
            var ang2 = Math.atan2(e.y - p.y, e.x - p.x);
            e.vx -= Math.cos(ang2) * 160; e.vy -= Math.sin(ang2) * 160;
          }
        }
      }
    }
    Grid.build(this.enemies);      // 供本帧的武器/子弹查询
  },

  updateBoss: function (b, dt, nx, ny, d) {
    var def = b.def;
    b.rot += dt * 0.35;

    // ---- 出手预警：先亮招再打，给玩家反应窗口 ----
    if (b.windup) {
      b.windup.t -= dt;
      if (b.windup.t <= 0) {
        var fire = b.windup;
        b.windup = null;
        this.bossAttack(b, fire.atk, nx, ny, d, fire.aim);
      }
      return;   // 预警期间不选新招
    }

    for (var i = 0; i < def.attacks.length; i++) {
      var atk = def.attacks[i];
      var key = atk.type + i;
      b.attackCd[key] -= dt;
      if (b.attackCd[key] > 0) continue;
      // 离玩家太远时不发招（否则玩家只看到屏幕外的弹幕）
      if (d > 620) continue;
      b.attackCd[key] = atk.cd * rand(0.85, 1.15);
      var wind = atk.wind == null ? 0.45 : atk.wind;
      b.windup = {
        atk: atk, t: wind, total: wind,
        aim: Math.atan2(this.player.y - b.y, this.player.x - b.x)
      };
      Sfx.telegraph();
      return;   // 一次只预告一招
    }
  },

  bossAttack: function (b, atk, nx, ny, d, aimAngle) {
    var base = aimAngle == null ? Math.atan2(this.player.y - b.y, this.player.x - b.x) : aimAngle;
    switch (atk.type) {
      case 'radial': {
        for (var i = 0; i < atk.count; i++) {
          var a = base + (i / atk.count) * TAU;
          this.spawnEnemyBullet(b.x, b.y, a, atk.speed, atk.dmg, atk.radius, atk.color);
        }
        Sfx.explode(false); this.cam.addShake(6);
        Particles.shock(b.x, b.y, 8, b.r * 2.2, { color: atk.color, life: 0.35, width: 5 });
        break;
      }
      case 'spiral': {
        var self = this;
        for (var s = 0; s < (atk.steps || 5); s++) {
          (function (step) {
            setTimeout(function () {
              if (self.state !== 'playing' || b.dead) return;
              var off = step * 0.5;
              for (var i = 0; i < atk.count; i++) {
                var a = base + off + (i / atk.count) * TAU;
                self.spawnEnemyBullet(b.x, b.y, a, atk.speed, atk.dmg, atk.radius, atk.color);
              }
              Sfx.shoot(0);
            }, step * (atk.stepDelay || 0.09) * 1000);
          })(s);
        }
        break;
      }
      case 'aimed': {
        // 朝玩家方向的扇形散射（有预警，可走位躲开）
        var half = (atk.count - 1) / 2;
        for (var ai = 0; ai < atk.count; ai++) {
          this.spawnEnemyBullet(b.x, b.y, base + (ai - half) * atk.spread, atk.speed, atk.dmg, atk.radius, atk.color);
        }
        Sfx.explode(false);
        Particles.burst(b.x, b.y, 10, { color: atk.color, speed: 260, life: 0.4, size: 3 });
        break;
      }
      case 'sweep': {
        for (var k = 0; k < atk.count; k++) {
          var a2 = base - atk.arc / 2 + (k / Math.max(1, atk.count - 1)) * atk.arc;
          this.spawnEnemyBullet(b.x, b.y, a2, atk.speed, atk.dmg, atk.radius, atk.color);
        }
        Sfx.explode(false);
        break;
      }
      case 'homing': {
        for (var h = 0; h < atk.count; h++) {
          var a3 = base + (h - (atk.count - 1) / 2) * 0.4;
          this.spawnEnemyBullet(b.x, b.y, a3, atk.speed, atk.dmg, atk.radius, atk.color, atk.turn);
        }
        Sfx.shoot(1);
        break;
      }
      case 'summon': {
        for (var n = 0; n < atk.n; n++) {
          var ang = rand(0, TAU);
          var child = this.spawnEnemyAt(atk.type2, b.x + Math.cos(ang) * (b.r + 30), b.y + Math.sin(ang) * (b.r + 30));
          if (child) { child.spawnT = 0.3; child.hp *= 1.4; }
          Particles.burst(b.x, b.y, 8, { color: b.def.color, speed: 220, life: 0.4, size: 3 });
        }
        Sfx.ui();
        break;
      }
      case 'blink': {
        Particles.burst(b.x, b.y, 30, { color: b.def.color, speed: 300, life: 0.5, size: 4 });
        var a4 = rand(0, TAU), dist4 = rand(280, 420);
        b.x = this.player.x + Math.cos(a4) * dist4;
        b.y = this.player.y + Math.sin(a4) * dist4;
        Particles.burst(b.x, b.y, 30, { color: b.def.color, speed: 300, life: 0.5, size: 4 });
        Particles.shock(b.x, b.y, 6, 160, { color: b.def.color, life: 0.35, width: 5 });
        Sfx.dash();
        break;
      }
      case 'charge': {
        b.state = 'charge';
        b.chargeDx = nx; b.chargeDy = ny;
        b.stateT = atk.dur;
        b.chargeLeft = atk.dist || 640;    // 冲撞总距离上限，避免冲出屏幕
        b.chargeFrom = { x: b.x, y: b.y };
        Sfx.dash();
        this.cam.addShake(4);
        break;
      }
    }
  },

  spawnEnemyBullet: function (x, y, a, speed, dmg, r, color, turn) {
    this.ebullets.push({
      x: x, y: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      dmg: dmg, r: r || 7, color: color || '#ff6b8a', life: 0, maxLife: 6,
      turn: turn || 0, speed: speed, rot: 0
    });
    if (this.ebullets.length > 400) this.ebullets.shift();
  },

  updateEnemyBullets: function (dt) {
    var p = this.player;
    for (var i = this.ebullets.length - 1; i >= 0; i--) {
      var b = this.ebullets[i];
      b.life += dt;
      if (b.turn) {
        var want = Math.atan2(p.y - b.y, p.x - b.x);
        var cur = Math.atan2(b.vy, b.vx);
        var na = cur + clamp(angleDiff(cur, want), -b.turn * dt, b.turn * dt) * 3;
        b.vx = Math.cos(na) * b.speed; b.vy = Math.sin(na) * b.speed;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += dt * 4;
      if (b.life > b.maxLife) { this.ebullets.splice(i, 1); continue; }
      if (Math.random() < 0.2) Particles.burst(b.x, b.y, 1, { color: b.color, speed: 20, life: 0.24, size: 2 });
      var rr = b.r + p.r;
      if (dist2(b.x, b.y, p.x, p.y) < rr * rr) {
        this.hurtPlayer(b.dmg);
        Particles.burst(b.x, b.y, 6, { color: b.color, speed: 160, life: 0.3, size: 2.6 });
        this.ebullets.splice(i, 1);
      }
    }
  },

  /* ------------------------------------------------ 玩家弹幕 */
  updateBullets: function (dt) {
    for (var i = this.bullets.length - 1; i >= 0; i--) {
      var b = this.bullets[i];
      b.life -= dt;
      if (b.life <= 0) { this.onBulletEnd(b); this.bullets.splice(i, 1); continue; }

      // 追踪（飞弹与进化星陨都会转向）
      if (b.turn > 0) {
        var t = nearestEnemy(this, b.x, b.y, 540);
        if (t) {
          var want = Math.atan2(t.y - b.y, t.x - b.x);
          var cur = Math.atan2(b.vy, b.vx);
          var na = cur + clamp(angleDiff(cur, want), -b.turn * dt, b.turn * dt) * 2.4;
          b.vx = Math.cos(na) * b.speed; b.vy = Math.sin(na) * b.speed;
          b.a = na;
        }
        if (b.kind === 'missile' && Math.random() < 0.8) {
          Particles.add({
            x: b.x, y: b.y, vx: rand(-24, 24), vy: rand(-24, 24), life: 0, max: 0.3,
            size: 3, color: b.color, drag: 4, grav: 0, glow: true, shape: 'dot', spin: 0, rot: 0, fade: 0.8
          });
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 碰撞
      var removed = false;
      var cand = this._candA || (this._candA = []);
      Grid.query(b.x, b.y, b.r + MAX_ENEMY_R + 20, cand);
      for (var j = 0; j < cand.length; j++) {
        var e = cand[j];
        if (e.dead || e.spawnT > 0.2) continue;
        if (b.hit.indexOf(e) >= 0) continue;
        var rr = b.r + e.r;
        if (dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
        var ang = Math.atan2(b.vy, b.vx);
        var slowOpt = b.slowMul ? { mul: b.slowMul, dur: b.slowDur } : null;
        this.damageEnemy(e, b.dmg, {
          color: b.color, knock: b.knock || (b.kind === 'missile' ? 150 : 60),
          kx: Math.cos(ang), ky: Math.sin(ang), w: b.w, slow: slowOpt
        });
        if (b.aoe) {
          this.explodeAt(b.x, b.y, b.aoe, b.dmg * 0.6, b.color, true, b.w, slowOpt);
          if (b.burn) this.addZone(b.x, b.y, b.aoe * 0.95, 3, b.dmg * 0.3, '#ff8a3d', b.w);
        }
        // 进化飞弹命中后分裂出子母弹
        if (b.split) {
          for (var sp = 0; sp < b.split; sp++) {
            var sa = ang + rand(-Math.PI, Math.PI);
            this.spawnBullet({
              x: b.x, y: b.y, a: sa, speed: b.speed * 0.75, dmg: b.dmg * 0.35,
              pierce: 1, life: 0.6, r: 4.5, color: b.color, kind: 'bolt',
              aoe: b.aoe * 0.5, w: b.w, slowMul: b.slowMul, slowDur: b.slowDur
            });
          }
        }
        b.hit.push(e);
        if (b.hit.length > b.pierce) { this.onBulletEnd(b); this.bullets.splice(i, 1); removed = true; break; }
      }
      if (removed) continue;
      if (b.x < this.player.x - 2400 || b.x > this.player.x + 2400 || b.y < this.player.y - 2400 || b.y > this.player.y + 2400) {
        this.bullets.splice(i, 1);
      }
    }
  },

  onBulletEnd: function (b) {
    Particles.burst(b.x, b.y, 4, { color: b.color, speed: 110, life: 0.25, size: 2.4 });
  },

  /* ------------------------------------------------ 其它实体 */
  updateShocks: function (dt) {
    for (var i = this.shocks.length - 1; i >= 0; i--) {
      var s = this.shocks[i];
      s.life += dt;
      var t = s.life / s.dur;
      if (t >= 1) {
        this.shocks.splice(i, 1);
        // 8 级 / 进化新星：再来一次 60% 伤害的冲击波
        if (s.repeat && s.did < 1) {
          this.shocks.push({
            x: s.x, y: s.y, r: 12, max: s.max * 1.15, life: 0, dur: s.dur,
            dmg: s.dmg * 0.6, hit: [], color: s.color, knock: s.knock * 1.3,
            slow: s.slow, repeat: false, did: 1, pull: 0, w: s.w
          });
        }
        continue;
      }
      s.r = lerp(12, s.max, 1 - Math.pow(1 - t, 2.4));
      var cand = this._candB || (this._candB = []);
      Grid.query(s.x, s.y, s.r + MAX_ENEMY_R + 40, cand);   // 冲击波命中判定含 e.r，Boss 更大，留足余量
      for (var j = 0; j < cand.length; j++) {
        var e = cand[j];
        if (e.dead) continue;
        // 进化新星「奇点爆发」：先把敌人拽向中心
        if (s.pull) {
          var pd = dist(s.x, s.y, e.x, e.y);
          if (pd < s.max) {
            var pa = Math.atan2(s.y - e.y, s.x - e.x);
            e.vx += Math.cos(pa) * s.pull * dt * 3;
            e.vy += Math.sin(pa) * s.pull * dt * 3;
          }
        }
        if (s.hit.indexOf(e) >= 0) continue;
        if (dist2(s.x, s.y, e.x, e.y) > (s.r + e.r) * (s.r + e.r)) continue;
        var ang = Math.atan2(e.y - s.y, e.x - s.x);
        this.damageEnemy(e, s.dmg, { color: s.color, knock: s.knock, kx: Math.cos(ang), ky: Math.sin(ang), w: s.w });
        if (s.slow) this.applySlow(e, s.slow.mul, s.slow.dur);
        s.hit.push(e);
      }
    }
  },

  updateMines: function (dt) {
    for (var i = this.mines.length - 1; i >= 0; i--) {
      var m = this.mines[i];
      m.life += dt;
      if (m.life > m.maxLife) { this.mines.splice(i, 1); continue; }
      if (m.arm < m.armTime) { m.arm += dt; continue; }
      // 进化雷区：地雷自行追猎最近的敌人
      if (m.seek) {
        var tgt = nearestEnemy(this, m.x, m.y, 320);
        if (tgt) {
          var a2 = Math.atan2(tgt.y - m.y, tgt.x - m.x);
          m.x += Math.cos(a2) * m.seek * dt;
          m.y += Math.sin(a2) * m.seek * dt;
          if (Math.random() < 0.3) Particles.burst(m.x, m.y, 1, { color: m.color, speed: 40, life: 0.3, size: 2.2 });
        }
      }
      var boom = false;
      for (var j = 0; j < this.enemies.length; j++) {
        var e = this.enemies[j];
        if (e.dead || e.spawnT > 0.2) continue;
        var rr = m.r + e.r + 6;
        if (dist2(m.x, m.y, e.x, e.y) < rr * rr) { boom = true; break; }
      }
      if (boom) this.detonateMine(i);
    }
  },

  detonateMine: function (i) {
    var m = this.mines[i];
    this.mines.splice(i, 1);
    this.explodeAt(m.x, m.y, m.aoe, m.dmg, m.color, true, m.w, null);
    if (m.burn) this.addZone(m.x, m.y, m.aoe * 0.85, 3, m.dmg * 0.22, '#ff8a3d', m.w);
    Sfx.explode(false);
    this.cam.addShake(3);
    if (m.chain) {
      for (var k = this.mines.length - 1; k >= 0; k--) {
        var o = this.mines[k];
        if (dist2(o.x, o.y, m.x, m.y) < 130 * 130) {
          var self = this;
          (function (idx) { setTimeout(function () { if (self.state === 'playing' && self.mines[idx]) self.detonateMine(idx); }, 70); })(k);
        }
      }
    }
  },

  /** 地面区域。hostile = true 表示这是"敌人留下的危险地带"，只伤害玩家 */
  addZone: function (x, y, r, dur, dps, color, w, hostile) {
    // 上限保护：进化地雷 + 连锁引爆会短时间内堆出很多火海
    if (this.zones.length >= 40) this.zones.shift();
    this.zones.push({
      x: x, y: y, r: r, life: 0, dur: dur, dps: dps,
      color: color || '#ff8a3d', tick: 0, w: w || null, hostile: !!hostile
    });
  },

  updateZones: function (dt) {
    var pl = this.player;
    for (var i = this.zones.length - 1; i >= 0; i--) {
      var z = this.zones[i];
      z.life += dt;
      if (z.life > z.dur) { this.zones.splice(i, 1); continue; }

      // 敌方毒雾：站在里面会持续掉血（受无敌帧限制，走得出去就没事）
      if (z.hostile) {
        if (dist2(z.x, z.y, pl.x, pl.y) < z.r * z.r) {
          this.hurtPlayer(z.dps * 0.25, '毒雾', z.color);
          if (Math.random() < 0.35) {
            Particles.burst(pl.x + rand(-10, 10), pl.y + rand(-10, 10), 1,
              { color: z.color, speed: 40, life: 0.5, size: 2.6, grav: -30 });
          }
        }
        continue;
      }

      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = 0.25;
        for (var j = 0; j < this.enemies.length; j++) {
          var e = this.enemies[j];
          if (e.dead) continue;
          if (dist2(z.x, z.y, e.x, e.y) > z.r * z.r) continue;
          this.damageEnemy(e, z.dps * 0.25, { color: z.color, silent: true, noCrit: true, dot: true, w: z.w });
          if (chance(0.2)) this.applyBurn(e, z.dps * 0.35, 1.2);
        }
      }
    }
  },

  updateGems: function (dt) {
    var p = this.player;
    var pr = p.stats.pickup * p.stats.pickupMul;
    for (var i = this.gems.length - 1; i >= 0; i--) {
      var g = this.gems[i];
      g.life += dt;
      var d = dist(p.x, p.y, g.x, g.y);
      if (d < pr || g.pulled) {
        g.pulled = true;
        var a = Math.atan2(p.y - g.y, p.x - g.x);
        var sp = Math.max(260, 620 - d * 0.4);
        g.vx = damp(g.vx, Math.cos(a) * sp, 8, dt);
        g.vy = damp(g.vy, Math.sin(a) * sp, 8, dt);
      } else {
        g.vx = damp(g.vx, 0, 5, dt);
        g.vy = damp(g.vy, 0, 5, dt);
      }
      g.x += g.vx * dt; g.y += g.vy * dt;
      if (d < 20) {
        var val = g.value * p.stats.xpMul;
        p.xp += val;
        this.gems.splice(i, 1);
        Sfx.pickup();
        Particles.burst(g.x, g.y, 3, { color: g.color, speed: 90, life: 0.24, size: 2 });
        while (p.xp >= p.xpNext) {
          p.xp -= p.xpNext;
          this.grantLevelUp();
          Particles.shock(p.x, p.y, 10, 260, { color: '#a06bff', life: 0.5, width: 4 });
          Sfx.levelUp();
        }
        this.refreshHud(true);
      }
    }
  },

  spawnGem: function (x, y, value, spread) {
    var color = value >= 20 ? '#ffd166' : (value >= 8 ? '#b07dff' : (value >= 3 ? '#4ff0ff' : '#7dff9b'));
    this.gems.push({
      x: x, y: y, vx: rand(-60, 60), vy: rand(-60, 60), value: value,
      life: 0, color: color, size: value >= 20 ? 8 : (value >= 8 ? 6.5 : 5), rot: rand(0, TAU),
      pulled: false
    });
    if (this.gems.length > 400) this.gems.shift();
  },

  spawnCoin: function (x, y, amount) {
    this.coins.push({ x: x, y: y, vx: rand(-70, 70), vy: rand(-70, 70), amt: amount, life: 0, rot: rand(0, TAU) });
    if (this.coins.length > 120) this.coins.shift();
  },

  /* -------- 回血颗粒 -------- */
  spawnOrb: function (x, y) {
    this.orbs.push({
      x: x, y: y, vx: rand(-50, 50), vy: rand(-50, 50),
      life: 0, rot: rand(0, TAU), pulled: false
    });
    if (this.orbs.length > 60) this.orbs.shift();
  },

  updateOrbs: function (dt) {
    var p = this.player;
    var st = p.stats;
    var pr = st.pickup * st.pickupMul * 0.9;
    var heal = Math.max(3, Math.round(st.hpMax * 0.035));
    for (var i = this.orbs.length - 1; i >= 0; i--) {
      var o = this.orbs[i];
      o.life += dt;
      var d = dist(p.x, p.y, o.x, o.y);
      if (d < pr || o.pulled) {
        o.pulled = true;
        var a = Math.atan2(p.y - o.y, p.x - o.x);
        o.vx = damp(o.vx, Math.cos(a) * 560, 8, dt);
        o.vy = damp(o.vy, Math.sin(a) * 560, 8, dt);
      } else { o.vx = damp(o.vx, 0, 5, dt); o.vy = damp(o.vy, 0, 5, dt); }
      o.x += o.vx * dt; o.y += o.vy * dt;
      if (d < 20) {
        var before = p.hp;
        p.hp = Math.min(st.hpMax, p.hp + heal);
        var got = Math.round(p.hp - before);
        this.orbs.splice(i, 1);
        if (got > 0) {
          Sfx.heal();
          Particles.text(p.x, p.y - 30, '+' + got, { color: '#8bff9f', size: 13, life: 0.8 });
          Particles.burst(p.x, p.y, 5, { color: ['#8bff9f', '#ffffff'], speed: 150, life: 0.4, size: 2.6 });
        }
      }
    }
  },

  updateCoins: function (dt) {
    var p = this.player;
    var pr = p.stats.pickup * p.stats.pickupMul * 0.85;
    for (var i = this.coins.length - 1; i >= 0; i--) {
      var c = this.coins[i];
      c.life += dt;
      var d = dist(p.x, p.y, c.x, c.y);
      if (d < pr || c.pulled) {
        c.pulled = true;
        var a = Math.atan2(p.y - c.y, p.x - c.x);
        c.vx = damp(c.vx, Math.cos(a) * 540, 8, dt);
        c.vy = damp(c.vy, Math.sin(a) * 540, 8, dt);
      } else { c.vx = damp(c.vx, 0, 5, dt); c.vy = damp(c.vy, 0, 5, dt); }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (d < 20) {
        var g = Math.max(1, Math.round(c.amt * p.stats.goldMul));
        this.runGold += g;
        this.coins.splice(i, 1);
        Sfx.coin();
        Particles.text(p.x, p.y - 28, '+' + g, { color: '#ffd166', size: 13, life: 0.7 });
      }
    }
  },

  updateBolts: function (dt) {
    for (var i = this.bolts.length - 1; i >= 0; i--) {
      var b = this.bolts[i];
      b.life += dt;
      if (b.life > b.max) this.bolts.splice(i, 1);
    }
  },

  /* ------------------------------------------------ 升级三选一 */
  openLevelUp: function () {
    this.state = 'levelup';
    this.pendingLevels--;
    UI.el.luLevel.textContent = this.player.level;
    this.choices = this.buildChoices(3);
    this.renderCards();
    UI.el.rerollCount.textContent = this.player.rerolls;
    UI.el.btnReroll.disabled = this.player.rerolls <= 0;
    UI.show('levelup');
    UI.banner('等级 ' + this.player.level, 900);
  },

  buildChoices: function (count) {
    var p = this.player, pool = [];
    var i, id;
    for (i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      if (w.evo) continue;                                  // 已进化：不再有普通升级
      if (w.lv < WEAPON_MAX_LV) pool.push({ kind: 'weapon', id: w.id, lv: w.lv + 1, weight: 3.2 });
      else if (canEvolve(w.id, w.lv, p.passives)) pool.push({ kind: 'evolve', id: w.id, weight: 7.5 });
    }
    if (p.weapons.length < MAX_WEAPON_SLOTS) {
      for (i = 0; i < WEAPON_IDS.length; i++) {
        id = WEAPON_IDS[i];
        var owned = false;
        for (var j = 0; j < p.weapons.length; j++) if (p.weapons[j].id === id) owned = true;
        if (!owned) pool.push({ kind: 'weapon', id: id, lv: 1, isNew: true, weight: p.weapons.length < 3 ? 3.6 : 2.2 });
      }
    }
    for (i = 0; i < PASSIVE_IDS.length; i++) {
      id = PASSIVE_IDS[i];
      var lv = p.passives[id] || 0;
      if (lv < PASSIVES[id].maxLv) pool.push({ kind: 'passive', id: id, lv: lv + 1, weight: 2.5 });
    }
    if (p.hp < p.stats.hpMax * 0.6) pool.push({ kind: 'heal', weight: 0.8 + (1 - p.hp / p.stats.hpMax) * 1.6 });
    if (this.runGold > 0) pool.push({ kind: 'gold', weight: 0.35 });

    // 幸运：让新武器/被动更容易出现（弱化治疗与金币）
    var luck = p.stats.luck || 0;
    for (i = 0; i < pool.length; i++) {
      if (pool[i].kind === 'heal' || pool[i].kind === 'gold') pool[i].weight *= clamp(1 - luck, 0.3, 1);
      else pool[i].weight *= (1 + luck * 0.35);
    }

    var out = [];
    for (var n = 0; n < count && pool.length; n++) {
      var total = 0;
      for (i = 0; i < pool.length; i++) total += pool[i].weight;
      var r = Math.random() * total, idx = 0;
      for (i = 0; i < pool.length; i++) { r -= pool[i].weight; if (r <= 0) { idx = i; break; } idx = i; }
      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  },

  /** 检查是否有武器"刚刚可以进化"，给玩家一个提示 */
  checkEvolvableHints: function () {
    var p = this.player;
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      if (w.evo || w.hinted) continue;
      if (canEvolve(w.id, w.lv, p.passives)) {
        w.hinted = true;
        var def = WEAPONS[w.id];
        UI.banner('★ ' + def.name + ' 可以进化了', 2200);
        UI.toast('下次升级可选择进化：' + def.evo.name);
        Sfx.levelUp();
        Particles.shock(this.player.x, this.player.y, 14, 320, { color: def.evo.color, life: 0.7, width: 6 });
        this.rebuildLoadout();
      }
    }
  },

  renderCards: function () {
    if (!UI.ready) return;
    var box = UI.el.cardList;
    box.innerHTML = '';
    var self = this;
    for (var i = 0; i < this.choices.length; i++) {
      var c = this.choices[i];
      var info = this.describeChoice(c);
      var el = document.createElement('div');
      el.className = 'card';
      var pips = '';
      if (info.pips) {
        pips = '<div class="pips">';
        for (var k = 0; k < info.pips[1]; k++) pips += '<div class="pip' + (k < info.pips[0] ? ' on' : '') + '"></div>';
        pips += '</div>';
      }
      el.innerHTML =
        (info.isEvo ? '<div class="card-evo-tag">★ 进化</div>' : (info.isNew ? '<div class="card-new">NEW</div>' : '')) +
        '<div class="card-top"><div class="card-glyph" style="color:' + info.color + ';box-shadow:0 0 18px ' + info.color + '44">' + info.glyph + '</div>' +
        '<div><div class="card-name">' + info.name + '</div><div class="card-kind" style="color:' + info.color + '">' + info.kind + '</div></div></div>' +
        '<div class="card-desc">' + info.desc + '</div>' +
        '<div class="card-foot"><span>' + (info.foot || '') + '</span>' + pips + '</div>';
      if (info.isEvo) el.className = 'card evo';
      (function (idx) {
        el.addEventListener('click', function () { self.chooseOption(idx); });
      })(i);
      box.appendChild(el);
    }
  },

  describeChoice: function (c) {
    var p = this.player;
    if (c.kind === 'evolve') {
      var edef = WEAPONS[c.id];
      return {
        name: edef.evo.name, glyph: edef.evo.glyph, color: edef.evo.color,
        kind: '★ 武器进化 · ' + edef.name,
        desc: edef.evo.desc + '<br><span style="color:#7dff9b">已满足条件：' + edef.name + ' Lv.8 + ' + edef.evo.needName + '</span>',
        foot: '进化', pips: [8, 8], isEvo: true
      };
    }
    if (c.kind === 'weapon') {
      var def = WEAPONS[c.id];
      var owned = false, curLv = 0;
      for (var i = 0; i < p.weapons.length; i++) if (p.weapons[i].id === c.id) { owned = true; curLv = p.weapons[i].lv; }
      var desc = c.lv === 1 ? def.desc : weaponDeltaText(c.id, c.lv);
      return {
        name: def.name, glyph: def.glyph, color: def.color,
        kind: c.isNew ? '新武器 · ' + def.kind.toUpperCase() : '武器强化 Lv.' + c.lv,
        desc: desc || def.desc,
        foot: c.isNew ? '解锁' : 'Lv.' + curLv + ' → ' + c.lv,
        pips: [c.lv, WEAPON_MAX_LV], isNew: !!c.isNew
      };
    }
    if (c.kind === 'passive') {
      var d = PASSIVES[c.id];
      var lv = p.passives[c.id] || 0;
      var total = (d.add * c.lv);
      var cur = (d.add * lv);
      var fmtv = function (v) {
        if (d.stat === 'hpMax' || d.stat === 'armor' || d.stat === 'regen') return '+' + (Math.round(v * 10) / 10);
        if (d.stat === 'pierceBonus') return '+' + v;
        return '+' + Math.round(v * 100) + '%';
      };
      return {
        name: d.name, glyph: d.glyph, color: d.color,
        kind: '被动 · Lv.' + c.lv,
        desc: d.desc + (lv > 0 ? '<br><span style="color:#8ea0c4">累计 ' + fmtv(total) + '（当前 ' + fmtv(cur) + '）</span>' : ''),
        foot: lv === 0 ? '新被动' : 'Lv.' + lv + ' → ' + c.lv,
        pips: [c.lv, d.maxLv]
      };
    }
    if (c.kind === 'heal') {
      var amt = Math.round(p.stats.hpMax * 0.35);
      return { name: '应急修复', glyph: '✚', color: '#8bff9f', kind: '补给', desc: '立刻回复 <b>' + amt + '</b> 点生命。', foot: '生命', pips: null };
    }
    return {
      name: '金币宝箱', glyph: '◈', color: '#ffd166', kind: '补给',
      desc: '立刻获得 <b>' + (30 + this.wave * 8) + '</b> 金币（计入本局收益）。', foot: '金币', pips: null
    };
  },

  chooseOption: function (i) {
    if (this.state !== 'levelup') return;
    var c = this.choices[i];
    if (!c) return;
    var p = this.player;
    if (c.kind === 'evolve') {
      var edef = WEAPONS[c.id];
      for (var k = 0; k < p.weapons.length; k++) {
        if (p.weapons[k].id === c.id) { p.weapons[k].evo = true; p.weapons[k].timer = 0; }
      }
      this.cam.addShake(18);
      this.cam.addFlash(0.5, edef.evo.color);
      this.cam.addHitstop(0.14);
      Sfx.bossDie();
      Particles.burst(p.x, p.y, 70, { color: [edef.evo.color, '#ffffff', '#ffd166'], speed: 460, life: 1.1, size: 4.5, jitter: 10 });
      for (var q = 0; q < 4; q++) Particles.shock(p.x, p.y, q * 6, 260 + q * 130, { color: edef.evo.color, life: 0.7, width: 7 - q });
      UI.banner('进化 · ' + edef.evo.name, 2400);
      UI.toast(edef.name + ' → ' + edef.evo.name);
      this.rebuildLoadout();
    } else if (c.kind === 'weapon') {
      if (c.isNew) this.giveWeapon(c.id, 1);
      else {
        for (var k2 = 0; k2 < p.weapons.length; k2++) if (p.weapons[k2].id === c.id) p.weapons[k2].lv = c.lv;
      }
      Sfx.choose();
      UI.toast(WEAPONS[c.id].name + ' → Lv.' + c.lv);
      this.checkEvolvableHints();
    } else if (c.kind === 'passive') {
      p.passives[c.id] = c.lv;
      var d = PASSIVES[c.id];
      if (d.stat === 'hpMax') p.hp = Math.min(p.stats.hpMax + d.add, p.hp + d.add);
      this.recomputeStats();
      Sfx.choose();
      UI.toast(d.name + ' → Lv.' + c.lv);
      this.checkEvolvableHints();
    } else if (c.kind === 'heal') {
      p.hp = Math.min(p.stats.hpMax, p.hp + p.stats.hpMax * 0.35);
      Sfx.heal();
      UI.toast('生命回复');
    } else {
      var g = 30 + this.wave * 8;
      this.runGold += g;
      Sfx.coin();
      UI.toast('金币 +' + g);
    }
    UI.hide('levelup');
    this.state = 'playing';
    this.refreshHud(true);
    if (this.pendingLevels > 0) {
      var self = this;
      setTimeout(function () { if (self.state === 'playing') self.openLevelUp(); }, 120);
    }
  },

  reroll: function () {
    if (this.state !== 'levelup' || this.player.rerolls <= 0) return;
    this.player.rerolls--;
    this.choices = this.buildChoices(3);
    this.renderCards();
    UI.el.rerollCount.textContent = this.player.rerolls;
    UI.el.btnReroll.disabled = this.player.rerolls <= 0;
    Sfx.ui();
  },

  skipLevel: function () {
    if (this.state !== 'levelup') return;
    var p = this.player;
    p.hp = Math.min(p.stats.hpMax, p.hp + 15);
    Sfx.heal();
    UI.hide('levelup');
    this.state = 'playing';
    if (this.pendingLevels > 0) {
      var self = this;
      setTimeout(function () { if (self.state === 'playing') self.openLevelUp(); }, 120);
    }
  },

  /* ------------------------------------------------ HUD */
  refreshHud: function (force) {
    if (!UI.ready) return;
    var p = this.player;
    if (!p) return;
    UI.width('hpFill', p.hp / p.stats.hpMax);
    UI.width('hpGhost', p.hp / p.stats.hpMax);
    UI.text('hpText', Math.ceil(p.hp) + ' / ' + Math.round(p.stats.hpMax));
    UI.width('xpFill', p.xp / p.xpNext);
    UI.text('xpText', 'LV.' + p.level + '  ' + Math.floor(p.xp) + '/' + Math.round(p.xpNext));
    UI.text('statTime', fmtTime(this.time));
    UI.text('statWave', '' + this.wave);
    UI.text('statKills', '' + this.kills);
    UI.text('statGold', fmtNum(Math.floor(this.runGold)));
    // 波次倒计时 / 下一波预告（Boss 波会变红闪烁）
    var nextLabel = '下一波', nextVal = '--', urgent = false;
    if (this.restT > 0) {
      var restNext = this.wave + 1;
      var bossNext = restNext % 5 === 0;
      nextLabel = bossNext ? '⚠ BOSS' : '补给中 (B)';
      nextVal = Math.max(0, this.restT).toFixed(1) + 's';
      urgent = bossNext;
    } else if (this.calm > 0) {
      var upcoming = this.wave + 1;
      var bossNext = upcoming % 5 === 0;
      nextLabel = bossNext ? '⚠ BOSS' : '下一波';
      nextVal = Math.max(0, this.calm).toFixed(1) + 's';
      urgent = bossNext;
    } else if (this.waveCfg) {
      var left = Math.max(0, this.waveCfg.dur - this.waveTimer);
      var bossAfter = (this.wave + 1) % 5 === 0;
      nextLabel = bossAfter ? '⚠ BOSS' : '波次剩余';
      nextVal = fmtTime(left);
      urgent = bossAfter && left <= 10;
    }
    UI.text('statNextK', nextLabel);
    UI.text('statNext', nextVal);
    var wrap = UI.el.statNextWrap;
    if (wrap) {
      if (urgent && !wrap.classList.contains('urgent')) wrap.classList.add('urgent');
      else if (!urgent) wrap.classList.remove('urgent');
    }
    // 局内商店按钮上的金币数
    UI.text('shopGoldHud', fmtNum(Math.floor(this.runGold)));
    // 性能显示
    var fpsBox = UI.el.fpsBox;
    if (fpsBox) {
      if (Fx.showFps) {
        if (fpsBox.classList.contains('hidden')) fpsBox.classList.remove('hidden');
        UI.text('fpsVal', this.fpsSmooth.toFixed(0));
        UI.text('msVal', (this.fpsSmooth > 1 ? (1000 / this.fpsSmooth) : 0).toFixed(1));
      } else if (!fpsBox.classList.contains('hidden')) fpsBox.classList.add('hidden');
    }
    var ready = p.dashCd <= 0;
    var ring = UI.el.dashRing;
    if (ring) {
      if (ready && !ring.classList.contains('ready')) ring.classList.add('ready');
      else if (!ready) ring.classList.remove('ready');
      var pct = ready ? 1 : 1 - p.dashCd / p.stats.dashCd;
      ring.style.background = 'conic-gradient(rgba(79,240,255,.35) ' + (pct * 360) + 'deg, rgba(8,12,24,.6) 0deg)';
      ring.style.borderColor = ready ? '#4ff0ff' : 'rgba(120,190,255,.18)';
    }
    // 终极技能环
    var ultRing = UI.el.ultRing;
    if (ultRing && p.ult) {
      var upct = clamp(p.ultCharge / p.ult.need, 0, 1);
      var ultReady = upct >= 1;
      if (ultReady && !ultRing.classList.contains('ready')) ultRing.classList.add('ready');
      else if (!ultReady) ultRing.classList.remove('ready');
      ultRing.style.background = 'conic-gradient(' + hexA(p.ult.color, ultReady ? 0.75 : 0.4) + ' ' + (upct * 360) + 'deg, rgba(8,12,24,.6) 0deg)';
      ultRing.style.borderColor = ultReady ? p.ult.color : 'rgba(120,190,255,.18)';
      UI.text('ultGlyph', p.ult.glyph);
      UI.text('ultPct', ultReady ? '就绪' : Math.floor(upct * 100) + '%');
      if (p.ultActive && p.ultActive.t > 0) UI.text('ultPct', p.ultActive.t.toFixed(1) + 's');
      if (UI.el.touchUlt) UI.el.touchUlt.classList.toggle('ready', ultReady);
    }
    if (this.boss && this.boss.hp > 0) UI.width('bossFill', this.boss.hp / this.boss.maxHp);
  },

  rebuildLoadout: function () {
    if (!UI.ready || !this.player) return;
    var box = UI.el.loadout;
    box.innerHTML = '';
    var p = this.player, i;
    for (i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i], def = WEAPONS[w.id];
      var disp = this.wDisp(w);
      var evolvable = !w.evo && canEvolve(w.id, w.lv, p.passives);
      var cls = 'lo' + (w.evo ? ' evo' : (w.lv >= WEAPON_MAX_LV ? ' max' : '')) + (evolvable ? ' evolvable' : '');
      var d = document.createElement('div');
      d.className = cls;
      d.title = disp.name + (w.evo ? '（已进化）' : ' Lv.' + w.lv);
      d.innerHTML = '<div class="lo-glyph" style="color:' + disp.color + '">' + disp.glyph + '</div>' +
        '<span class="lo-name">' + disp.name + '</span><span class="lo-lv">' + (w.evo ? '★' : w.lv) + '</span>';
      box.appendChild(d);
    }
    var first = true;
    for (var id in p.passives) {
      var lv = p.passives[id];
      if (!lv) continue;
      var pd = PASSIVES[id];
      var e = document.createElement('div');
      e.className = 'lo';
      e.innerHTML = '<div class="lo-glyph" style="color:' + pd.color + '">' + pd.glyph + '</div>' +
        '<span class="lo-name">' + pd.name + '</span><span class="lo-lv">' + lv + '</span>';
      box.appendChild(e);
    }
  },

  /* ------------------------------------------------ 局内补给商店 */
  openRunShop: function () {
    // 商店只在波次之间的休息时段开放
    if (this.state !== 'playing' || this.restT <= 0) {
      UI.toast('补给站只在每波结束后的休息时间开放');
      Sfx.ui();
      return false;
    }
    this.state = 'runshop';
    UI.show('runshop');
    this.refreshRunShop();
    this.refreshRestHud();       // 商店里也显示剩余休息时间
    Sfx.ui();
    return true;
  },

  closeRunShop: function () {
    if (this.state !== 'runshop') return false;
    this.state = 'playing';
    UI.hide('runshop');
    this.lastFrame = 0;
    Input.clearBuffer();
    return true;
  },

  refreshRunShop: function () {
    if (!UI.ready) return;
    var p = this.player;
    UI.text('runGold', fmtNum(Math.floor(this.runGold)));
    var box = UI.el.runShopList;
    box.innerHTML = '';
    var self = this;
    for (var i = 0; i < RUN_SHOP.length; i++) {
      var it = RUN_SHOP[i];
      var bought = (p.runBonus[it.id] || 0);
      var maxed = bought >= it.max;
      var cost = runShopCost(it, bought);
      var afford = this.runGold >= cost;
      var row = document.createElement('div');
      row.className = 'shop-row' + (maxed ? ' maxed' : '');
      row.innerHTML =
        '<div class="sr-glyph" style="color:' + it.color + '">' + it.glyph + '</div>' +
        '<div class="sr-body"><div class="sr-name">' + it.name +
        ' <span class="sr-lvl">' + (it.max < 90 ? bought + '/' + it.max : '已购 ' + bought) + '</span></div>' +
        '<div class="sr-desc">' + it.desc + '</div></div>' +
        '<button class="sr-buy"' + (maxed || !afford ? ' disabled' : '') + '>' +
        (maxed ? '已达上限' : fmtNum(cost) + ' 金币') + '</button>';
      (function (item) {
        row.querySelector('.sr-buy').addEventListener('click', function () { self.buyRunItem(item.id); });
      })(it);
      box.appendChild(row);
    }
  },

  buyRunItem: function (id) {
    if (this.state !== 'runshop') return false;
    var it = runShopItem(id);
    var p = this.player;
    if (!it) return false;
    var bought = p.runBonus[id] || 0;
    if (bought >= it.max) { Sfx.ui(); return false; }
    var cost = runShopCost(it, bought);
    if (this.runGold < cost) { Sfx.hurt(); UI.toast('金币不足'); return false; }

    this.runGold -= cost;
    p.runBonus[id] = bought + 1;
    var before = p.stats.hpMax;

    switch (it.type) {
      case 'heal':
        p.hp = Math.min(p.stats.hpMax, p.hp + p.stats.hpMax * 0.35);
        Sfx.heal();
        break;
      case 'revive':
        p.revives++;
        Sfx.levelUp();
        break;
      case 'reroll':
        p.rerolls++;
        Sfx.coin();
        break;
      case 'nova':
        // 休息时段场上本来就没有敌人，所以改成"装填"：下一波开始时自动引爆
        p.pendingPulse = (p.pendingPulse || 0) + 1;
        Sfx.levelUp();
        UI.toast('净化脉冲已装填 · 下一波开始时引爆（当前 ' + p.pendingPulse + ' 发）');
        break;
      case 'level':
        this.grantLevelUp();
        Sfx.levelUp();
        break;
    }

    this.recomputeStats(true);
    if (p.stats.hpMax > before) p.hp += (p.stats.hpMax - before);   // 生命扩容顺手回满这部分
    if (p.hp > p.stats.hpMax) p.hp = p.stats.hpMax;
    Sfx.choose();
    UI.toast(it.name + ' · 花费 ' + fmtNum(cost));
    this.refreshRunShop();
    this.refreshHud(true);
    this.rebuildLoadout();
    return true;
  },

  /** 净化脉冲：湮灭全场杂兵并转化为经验 */
  firePurge: function () {
    var p = this.player, n = 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead || e.isBoss) continue;
      e.dead = true;
      e.silentDeath = true;
      this.spawnGem(e.x, e.y, e.xpValue || 1, true);
      Particles.burst(e.x, e.y, 4, { color: ['#4ff0ff', '#ffffff'], speed: 220, life: 0.5, size: 3 });
      n++;
    }
    this.enemies = this.enemies.filter(function (en) { return !en.dead; });
    Grid.build(this.enemies);
    this.budgetLeft = Math.max(0, this.budgetLeft - 0);   // 本波剩余预算仍会继续刷
    Particles.shock(p.x, p.y, 16, 900, { color: '#4ff0ff', life: 0.9, width: 10 });
    Particles.burst(p.x, p.y, 60, { color: ['#4ff0ff', '#ffffff'], speed: 520, life: 1.0, size: 4 });
    this.cam.addFlash(0.5, '#4ff0ff');
    this.cam.addShake(16);
    Sfx.bossDie();
    UI.banner('净化脉冲', 1600);
    UI.toast('湮灭了 ' + n + ' 个敌人');
    return n;
  },

  /* ------------------------------------------------ 设置 */
  openSettings: function () {
    // 重复调用（连点按钮 / 键盘 + 鼠标同时）不能把来源状态冲成 'settings'，
    // 否则返回时会跳过暂停直接掉回主菜单
    if (this.state !== 'settings') this.settingsFrom = this.state;
    this.state = 'settings';
    UI.hide('menu'); UI.hide('pause');
    UI.show('settings');
    this.refreshSettings();
    Sfx.ui();
  },

  closeSettings: function () {
    UI.hide('settings');
    if (this.settingsFrom === 'paused') { this.state = 'paused'; UI.show('pause'); }
    else { this.state = 'menu'; UI.show('menu'); this.refreshMenu(); }
  },

  refreshSettings: function () {
    if (!UI.ready) return;
    var box = UI.el.settingsList;
    box.innerHTML = '';
    var self = this;
    for (var i = 0; i < SETTING_DEFS.length; i++) {
      var d = SETTING_DEFS[i];
      var idx = d.index();
      var row = document.createElement('div');
      row.className = 'shop-row set-row' + (idx === 0 ? '' : ' off');
      row.innerHTML =
        '<div class="sr-glyph" style="color:' + d.color + '">' + d.glyph + '</div>' +
        '<div class="sr-body"><div class="sr-name">' + d.name + '</div>' +
        '<div class="sr-desc">' + d.desc + '</div></div>' +
        '<div class="set-value">' + d.options[idx] + '</div>';
      (function (id) {
        row.addEventListener('click', function () { self.cycleSetting(id); });
      })(d.id);
      box.appendChild(row);
    }
  },

  cycleSetting: function (id) {
    Settings.cycle(id, 1);
    this.refreshSettings();
    Sfx.ui();
    this.refreshHud(true);
  },

  resetSettings: function () {
    var st = Store.load();
    st.opts = null;
    Settings.data = null;
    Settings.load();
    this.syncSettingLabels();
    this.refreshSettings();
    Sfx.ui();
    UI.toast('设置已恢复默认');
  },

  /** 把设置状态同步到暂停菜单里的两个快捷按钮文案 */
  syncSettingLabels: function () {
    if (!UI.ready) return;
    if (UI.el.btnToggleSound) UI.el.btnToggleSound.textContent = '音效：' + (Sfx.enabled ? '开' : '关');
    if (UI.el.btnToggleFx) UI.el.btnToggleFx.textContent = '画面特效：' + (Fx.lite ? '精简' : '完整');
  },

  /* ------------------------------------------------ 状态切换 */
  pause: function () {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    UI.el.pauseStats.innerHTML = UI.stats([
      ['游戏时间', fmtTime(this.time)],
      ['波次', this.wave],
      ['击杀', this.kills],
      ['等级', this.player.level],
      ['本局金币', Math.floor(this.runGold)],
      ['最高连击', this.maxCombo]
    ]);
    this.renderBuildPanel(UI.el.pauseBuild);
    this.renderAttrGrid(UI.el.pauseAttr);
    UI.show('pause');
    Sfx.setIntensity(0);
  },

  /** 当前构筑：武器（含进化）、被动、遗物 */
  renderBuildPanel: function (box) {
    if (!box) return;
    var p = this.player;
    var html = '', i;
    for (i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i], disp = this.wDisp(w);
      html += '<div class="build-item' + (w.evo ? ' evo' : '') + '">' +
        '<span class="bi-glyph" style="color:' + disp.color + '">' + disp.glyph + '</span>' +
        '<span>' + disp.name + '</span><span class="bi-lv">' + (w.evo ? '★ 进化' : 'Lv.' + w.lv) + '</span></div>';
    }
    for (var id in p.passives) {
      var lv = p.passives[id];
      if (!lv) continue;
      var pd = PASSIVES[id];
      html += '<div class="build-item"><span class="bi-glyph" style="color:' + pd.color + '">' + pd.glyph + '</span>' +
        '<span>' + pd.name + '</span><span class="bi-lv">Lv.' + lv + '</span></div>';
    }
    for (var rid in p.relics) {
      var rel = RELICS[rid];
      if (!rel) continue;
      html += '<div class="build-item evo" title="' + rel.desc + '"><span class="bi-glyph" style="color:' + rel.color + '">' + rel.glyph + '</span>' +
        '<span>' + rel.name + '</span><span class="bi-lv">遗物</span></div>';
    }
    box.innerHTML = html || '<div class="build-empty">暂无强化</div>';
  },

  /** 属性明细 */
  renderAttrGrid: function (box) {
    if (!box) return;
    var p = this.player, s = p.stats;
    var pct = function (v) { return Math.round(v * 100) + '%'; };
    var ult = p.ult;
    var rows = [
      ['最大生命', Math.round(s.hpMax), ''],
      ['移动速度', Math.round(s.speed * s.speedMul), ''],
      ['伤害倍率', pct(s.dmgMul), s.dmgMul > 1 ? 'good' : (s.dmgMul < 1 ? 'bad' : '')],
      ['攻击速度', pct(s.hasteMul), s.hasteMul > 1 ? 'good' : ''],
      ['技能范围', pct(s.areaMul), s.areaMul > 1 ? 'good' : ''],
      ['护甲', (Math.round(s.armor * 10) / 10), s.armor > 0 ? 'good' : ''],
      ['每秒回复', (Math.round(s.regen * 100) / 100), s.noRegen ? 'bad' : (s.regen > 0 ? 'good' : '')],
      ['暴击率', pct(s.critChance), 'good'],
      ['暴击伤害', pct(s.critMul), 'good'],
      ['拾取范围', Math.round(s.pickup * s.pickupMul), ''],
      ['经验加成', pct(s.xpMul), s.xpMul >= 1 ? 'good' : 'bad'],
      ['金币加成', pct(s.goldMul), s.goldMul >= 1 ? 'good' : 'bad'],
      ['额外穿透', '+' + s.pierceBonus, s.pierceBonus > 0 ? 'good' : ''],
      ['冲刺冷却', (Math.round(s.dashCd * 100) / 100) + 's', ''],
      ['复活次数', (p.revives - p.reviveUsed) + '/' + p.revives, p.revives > 0 ? 'good' : ''],
      ['终极技能', ult ? ult.name : '—', ''],
      ['充能进度', ult ? Math.floor(p.ultCharge) + '/' + ult.need : '—', p.ultCharge >= (ult ? ult.need : 1) ? 'good' : ''],
      ['受击承伤', pct(s.dmgTakenMul || 1), (s.dmgTakenMul || 1) > 1 ? 'bad' : ''],
      ['敌人速度', pct(s.enemySpeedMul || 1), (s.enemySpeedMul || 1) < 1 ? 'good' : ((s.enemySpeedMul || 1) > 1 ? 'bad' : '')]
    ];
    if (this.mutatorIds.length) rows.push(['突变因子数', '' + this.mutatorIds.length, 'bad']);
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      html += '<div class="attr ' + rows[i][2] + '"><span class="attr-k">' + rows[i][0] + '</span>' +
        '<span class="attr-v">' + rows[i][1] + '</span></div>';
    }
    box.innerHTML = html;
  },

  /** 各武器输出统计 */
  damageBreakdown: function () {
    var p = this.player;
    var rows = [];
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i], disp = this.wDisp(w);
      rows.push({
        name: disp.name, color: disp.color, glyph: disp.glyph,
        dealt: w.dealt || 0, lv: w.evo ? '★' : 'Lv.' + w.lv
      });
    }
    if (p.ult) rows.push({ name: p.ult.name, color: p.ult.color, glyph: p.ult.glyph, dealt: p.ultDealt || 0, lv: '终极' });
    rows.sort(function (a, b) { return b.dealt - a.dealt; });
    var total = 0;
    for (var k = 0; k < rows.length; k++) total += rows[k].dealt;
    return { rows: rows, total: Math.max(total, 1) };
  },

  renderDamagePanel: function (box) {
    if (!box) return;
    var data = this.damageBreakdown();
    var html = '';
    for (var i = 0; i < data.rows.length; i++) {
      var r = data.rows[i];
      var pctv = r.dealt / data.total;
      html += '<div class="dmg-row">' +
        '<span class="dmg-name"><span style="color:' + r.color + '">' + r.glyph + '</span>' + r.name +
        '<span class="dmg-lv">' + r.lv + '</span></span>' +
        '<span class="dmg-track"><span class="dmg-fill" style="width:' + (pctv * 100).toFixed(1) +
        '%;background:linear-gradient(90deg,' + r.color + ',' + hexA(r.color, 0.45) + ')"></span></span>' +
        '<span class="dmg-val">' + fmtNum(r.dealt) + ' (' + Math.round(pctv * 100) + '%)</span></div>';
    }
    box.innerHTML = html || '<div class="build-empty">没有造成任何伤害……</div>';
  },

  resume: function () {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    UI.hide('pause');
    Input.clearBuffer();          // 暂停期间的按键不该在恢复瞬间生效
    this.lastFrame = 0;
  },

  quitToMenu: function () {
    this.state = 'menu';
    this.challenge = null;
    this.mutatorIds = [];
    this.mutBonus = null;
    UI.hide('pause'); UI.hide('hud'); UI.hide('gameover'); UI.hide('levelup'); UI.hide('bossBar');
    UI.hide('touch'); UI.hide('runshop');
    UI.show('menu');
    this.refreshMenu();
    Sfx.stopMusic();
  },

  gameOver: function (victory) {
    this.state = 'dead';
    this.pendingLevels = 0;          // 结算后不再弹升级窗
    var p = this.player;
    Sfx.stopMusic();
    Sfx.gameOver();
    this.cam.addShake(30);
    this.cam.addFlash(0.6, victory ? '#7dff9b' : '#ff2b55');
    Particles.burst(p.x, p.y, 60, { color: ['#ff5570', '#ffd166', '#ffffff'], speed: 380, life: 1.1, size: 4 });
    Particles.shock(p.x, p.y, 8, 460, { color: victory ? '#7dff9b' : '#ff5570', life: 0.8, width: 8 });

    // 结算金币：只有一部分存入永久账户，其余视为本局内已消耗（避免一把刷满商店）
    var earned = Math.round(this.runGold);
    var banked = Math.max(0, Math.round(earned * GOLD_BANK_RATIO));
    // 成就：先用"本局进行中"的数据判定一次（此时存档还没累加本局，不会重复计数）
    Achievements.check(this);
    var st = Store.load();
    st.gold = (st.gold || 0) + banked;
    st.totalGold = (st.totalGold || 0) + earned;
    st.runs = (st.runs || 0) + 1;
    st.kills = (st.kills || 0) + this.kills;
    st.evolutions = (st.evolutions || 0) + evoCount(this);
    st.relicsTotal = (st.relicsTotal || 0) + Object.keys(p.relics).length;
    if (victory) {
      st.wins = (st.wins || 0) + 1;
      if (!st.winsBy) st.winsBy = {};
      st.winsBy[this.difficulty] = (st.winsBy[this.difficulty] || 0) + 1;
      if (this.mutatorIds.indexOf('glass') >= 0) st.glassWin = (st.glassWin || 0) + 1;
    }
    var bestKey = this.challenge && this.challenge.date ? ('daily:' + this.challenge.date) : this.difficulty;
    var best = st.best[bestKey] || { time: 0, wave: 0, kills: 0, level: 0 };
    if (this.time > best.time) best.time = this.time;
    if (this.wave > best.wave) best.wave = this.wave;
    if (this.kills > best.kills) best.kills = this.kills;
    if (p.level > best.level) best.level = p.level;
    st.best[bestKey] = best;
    // 战绩历史（最近 10 局）
    if (!st.history) st.history = [];
    st.history.unshift({
      t: Date.now(), char: this.charId, diff: this.difficulty,
      wave: this.wave, kills: this.kills, level: p.level,
      gold: earned, secs: Math.round(this.time),
      muts: this.mutatorIds.slice(), win: !!victory
    });
    if (st.history.length > 10) st.history.length = 10;
    Store.save();
    // 成就：再按累计数据判定一次（此时存档已包含本局）
    Achievements.check(null);

    UI.el.goTitle.textContent = victory ? '你活下来了' : '你被吞噬了';
    UI.el.goTitle.className = 'go-title' + (victory ? ' win' : '');
    var rows = [
      ['存活时间', fmtTime(this.time)],
      ['抵达波次', this.wave],
      ['击杀数', this.kills],
      ['等级', p.level],
      ['造成伤害', fmtNum(p.dmgDealt)],
      ['承受伤害', fmtNum(p.dmgTaken)],
      ['最高连击', this.maxCombo],
      ['难度', this.diff.name]
    ];
    if (this.mutatorIds.length) {
      var names = [];
      for (var mi = 0; mi < this.mutatorIds.length; mi++) {
        var mu = getMutator(this.mutatorIds[mi]);
        if (mu) names.push(mu.name);
      }
      rows.push(['突变因子', names.join(' · ')]);
      rows.push(['遗物收集', Object.keys(p.relics).length + ' / ' + RELIC_IDS.length]);
    } else {
      rows.push(['遗物收集', Object.keys(p.relics).length + ' / ' + RELIC_IDS.length]);
    }
    UI.el.goStats.innerHTML = UI.stats(rows);
    this.renderDamagePanel(UI.el.goDamage);
    UI.el.goGold.textContent = '+' + fmtNum(earned) + '（存入永久 ' + fmtNum(banked) + ' · 总计 ' + fmtNum(st.gold) + '）';
    UI.el.btnRetry.textContent = victory ? '继续挑战（无尽）' : '再来一局';
    this.victoryOpen = victory;
    UI.show('gameover');
  },

  /* ------------------------------------------------ 主菜单 / 商店 */
  refreshMenu: function () {
    if (!UI.ready) return;
    var self = this;
    // 角色列表
    var box = UI.el.charList;
    box.innerHTML = '';
    for (var i = 0; i < CHARACTERS.length; i++) {
      var c = CHARACTERS[i];
      var d = document.createElement('div');
      d.className = 'char-card' + (c.id === this.charId ? ' sel' : '');
      var chips = [];
      chips.push('生命 ' + c.stats.hpMax);
      chips.push('速度 ' + c.stats.speed);
      if (c.stats.armor) chips.push('护甲 ' + c.stats.armor);
      if (c.stats.critChance) chips.push('暴击 ' + Math.round(c.stats.critChance * 100) + '%');
      if (c.stats.areaMul && c.stats.areaMul > 1) chips.push('范围 +' + Math.round((c.stats.areaMul - 1) * 100) + '%');
      if (c.stats.dashCd) chips.push('冲刺快');
      var chipHtml = '';
      for (var k = 0; k < chips.length; k++) chipHtml += '<span class="chip">' + chips[k] + '</span>';
      d.innerHTML = '<div class="cc-top"><div class="char-glyph" style="color:' + c.color + '">' + c.glyph + '</div>' +
        '<div><div class="char-name">' + c.name + '</div><div class="char-tag">' + c.en + ' · ' + c.tag + '</div></div></div>' +
        '<div class="char-desc">' + c.desc + '</div><div class="char-stats">' + chipHtml + '</div>';
      (function (id) {
        d.addEventListener('click', function () {
          self.charId = id;
          Store.set('lastChar', id);
          self.refreshMenu(); Sfx.ui(); Sfx.unlock();
        });
      })(c.id);
      box.appendChild(d);
    }
    // 难度
    var dbox = UI.el.difficultyList;
    dbox.innerHTML = '';
    for (var j = 0; j < DIFFICULTIES.length; j++) {
      var df = DIFFICULTIES[j];
      var e = document.createElement('div');
      e.className = 'diff' + (df.id === this.difficulty ? ' sel' : '');
      e.innerHTML = df.name + '<br><span style="font-size:10px;opacity:.7">' + df.desc + '</span>';
      (function (id) {
        e.addEventListener('click', function () {
          self.difficulty = id;
          Store.set('lastDiff', id);
          self.refreshMenu(); Sfx.ui();
        });
      })(df.id);
      dbox.appendChild(e);
    }
    // 记录
    var st = Store.load();
    var b = (st.best && st.best[this.difficulty]) || { time: 0, wave: 0, kills: 0, level: 0 };
    UI.el.records.innerHTML =
      '本难度最佳 &nbsp;|&nbsp; 存活 <b>' + fmtTime(b.time) + '</b> &nbsp; 波次 <b>' + b.wave +
      '</b> &nbsp; 击杀 <b>' + b.kills + '</b> &nbsp; 等级 <b>' + b.level + '</b>' +
      '<br>金币 <b>' + (st.gold || 0) + '</b> &nbsp;|&nbsp; 总局数 <b>' + (st.runs || 0) +
      '</b> &nbsp; 总击杀 <b>' + (st.kills || 0) + '</b> &nbsp; 通关 <b>' + (st.wins || 0) + '</b>' +
      '<br>成就 <b>' + Achievements.unlockedCount(st) + '/' + ACHIEVEMENTS.length + '</b>' +
      ' &nbsp;|&nbsp; 进化总数 <b>' + (st.evolutions || 0) + '</b>';
    if (UI.el.btnArchive) UI.el.btnArchive.textContent = '档案室 ' + Achievements.unlockedCount(st) + '/' + ACHIEVEMENTS.length;
    this.refreshChallenge();
  },

  /* ------------------------------------------------ 档案室（图鉴 / 成就 / 战绩） */
  openArchive: function (tab) {
    this.archiveFrom = (this.state === 'menu') ? 'menu' : 'gameover';
    this.state = 'archive';
    UI.hide('menu'); UI.hide('gameover');
    UI.show('archive');
    this.archiveTab = tab || this.archiveTab || 'codex';
    this.refreshArchive();
  },

  closeArchive: function () {
    UI.hide('archive');
    if (this.archiveFrom === 'menu') { this.state = 'menu'; UI.show('menu'); this.refreshMenu(); }
    else { this.state = 'dead'; UI.show('gameover'); }
  },

  setArchiveTab: function (tab) {
    this.archiveTab = tab;
    Sfx.ui();
    this.refreshArchive();
  },

  refreshArchive: function () {
    if (!UI.ready) return;
    var st = Store.load();
    UI.text('achCount', Achievements.unlockedCount(st) + '/' + ACHIEVEMENTS.length);
    UI.text('achGold', '' + (st.gold || 0));
    var tabs = [['codex', 'tabCodex'], ['ach', 'tabAch'], ['hist', 'tabHist']];
    for (var i = 0; i < tabs.length; i++) {
      var el = UI.el[tabs[i][1]];
      if (!el) continue;
      if (tabs[i][0] === this.archiveTab) { if (!el.classList.contains('sel')) el.classList.add('sel'); }
      else el.classList.remove('sel');
    }
    var body = UI.el.archiveBody;
    if (this.archiveTab === 'ach') body.innerHTML = this.renderAchievements(st);
    else if (this.archiveTab === 'hist') body.innerHTML = this.renderHistory(st);
    else body.innerHTML = this.renderCodex(st);
  },

  /** 图鉴：全部数据一览（武器含进化与等级成长） */
  renderCodex: function (st) {
    var defStats = function (id, lv) { return weaponStats(id, lv); };
    var pick = function (s, keys) {
      var out = [];
      for (var i = 0; i < keys.length; i++) if (typeof s[keys[i]] === 'number') out.push(WEAPONS[WID].labels[keys[i]] || keys[i] + ' ' + s[keys[i]]);
      return out.join(' · ');
    };
    var html = '';

    // 武器
    html += '<div class="codex-sec">武器 · ' + WEAPON_IDS.length + ' 把（每把 8 级 + 1 个进化形态）</div><div class="codex-grid">';
    for (var i = 0; i < WEAPON_IDS.length; i++) {
      var WID = WEAPON_IDS[i];
      var def = WEAPONS[WID];
      var a = defStats(WID, 1), b = defStats(WID, WEAPON_MAX_LV);
      var key = ['dmg', 'dps', 'count', 'radius', 'pierce', 'targets'];
      html += '<div class="codex-item">' +
        '<span class="ci-glyph" style="color:' + def.color + '">' + def.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + def.name + '<span class="ci-tag">' + def.kind + '</span>' +
        (def.evo ? '<span class="ci-tag evo">★ ' + def.evo.name + '</span>' : '') + '</div>' +
        '<div class="ci-desc">' + def.desc + '</div>' +
        '<div class="ci-num">Lv1 ' + pick(a, key) + '　→　Lv8 ' + pick(b, key) + '</div>' +
        (def.evo ? '<div class="ci-num evo">进化条件：' + def.name + ' Lv.8 + ' + def.evo.needName + ' — ' + def.evo.desc + '</div>' : '') +
        '</div></div>';
    }
    html += '</div>';

    // 被动
    html += '<div class="codex-sec">被动 · ' + PASSIVE_IDS.length + ' 种</div><div class="codex-grid">';
    for (var p = 0; p < PASSIVE_IDS.length; p++) {
      var pd = PASSIVES[PASSIVE_IDS[p]];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + pd.color + '">' + pd.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + pd.name + '<span class="ci-tag">上限 Lv.' + pd.maxLv + '</span></div>' +
        '<div class="ci-desc">' + pd.desc + '</div></div></div>';
    }
    html += '</div>';

    // 终极技能
    html += '<div class="codex-sec">终极技能 · 按角色绑定（充能满后按 Q）</div><div class="codex-grid">';
    for (var ci = 0; ci < CHARACTERS.length; ci++) {
      var ch = CHARACTERS[ci], U = ULTIMATES[ch.id];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + U.color + '">' + U.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + U.name + '<span class="ci-tag">' + ch.name + ' · 充能 ' + U.need + '</span></div>' +
        '<div class="ci-desc">' + U.desc + '</div></div></div>';
    }
    html += '</div>';

    // 遗物
    var gotRelic = 0;
    for (var r = 0; r < RELIC_IDS.length; r++) if (st.ach) gotRelic += 0;
    html += '<div class="codex-sec">遗物 · ' + RELIC_IDS.length + ' 件（Boss 必掉 / 精英有概率掉落）</div><div class="codex-grid">';
    for (var k = 0; k < RELIC_IDS.length; k++) {
      var rel = RELICS[RELIC_IDS[k]];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + rel.color + '">' + rel.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + rel.name + (rel.flag ? '<span class="ci-tag">特效</span>' : '<span class="ci-tag">数值</span>') + '</div>' +
        '<div class="ci-desc">' + rel.desc + '</div></div></div>';
    }
    html += '</div>';

    // 精英词缀
    html += '<div class="codex-sec">精英词缀 · ' + AFFIXES.length + ' 条（12 波后精英带 2 条）</div><div class="codex-grid">';
    for (var af = 0; af < AFFIXES.length; af++) {
      var A = AFFIXES[af];
      var fx = [];
      if (A.shield) fx.push('护盾 ' + Math.round(A.shield * 55) + '% 最大生命');
      if (A.hpMul) fx.push('生命 ×' + A.hpMul);
      if (A.rage) fx.push('残血加速 ×' + A.rage.maxMul + '、增伤 ×' + A.rage.dmgMul);
      if (A.toxic) fx.push('死亡留毒圈 ' + A.toxic.dps + '/秒');
      if (A.vamp) fx.push('每 ' + A.vamp.cd + ' 秒治疗同伴 ' + A.vamp.hps);
      if (A.summon) fx.push('每 ' + A.summon.cd + ' 秒召唤 ' + A.summon.n + ' 只');
      if (A.affixSplit) fx.push('死亡分裂 ' + A.affixSplit.n + ' 只');
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + A.color + '">' + A.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + A.name + '</div><div class="ci-desc">' + fx.join(' · ') + '</div></div></div>';
    }
    html += '</div>';

    // 敌人
    var behavior = { chase: '追击', shooter: '远程', charger: '冲锋', orbiter: '环绕' };
    html += '<div class="codex-sec">敌人 · ' + ENEMY_IDS.length + ' 种</div><div class="codex-grid">';
    for (var e = 0; e < ENEMY_IDS.length; e++) {
      var en = ENEMIES[ENEMY_IDS[e]];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + en.color + '">◆</span>' +
        '<div class="ci-body"><div class="ci-name">' + en.name + '<span class="ci-tag">' + (behavior[en.behavior] || en.behavior) + ' · ' + en.minWave + ' 波起</span></div>' +
        '<div class="ci-num">生命 ' + en.hp + ' · 速度 ' + en.speed + ' · 伤害 ' + en.dmg + ' · 护甲 ' + en.armor + ' · 经验 ' + en.xp + '</div></div></div>';
    }
    html += '</div>';

    // Boss
    html += '<div class="codex-sec">Boss · ' + BOSSES.length + ' 个（每 5 波，20 波后循环强化）</div><div class="codex-grid">';
    for (var b = 0; b < BOSSES.length; b++) {
      var B = BOSSES[b];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + B.color + '">☠</span>' +
        '<div class="ci-body"><div class="ci-name">' + B.name + '<span class="ci-tag">' + B.en + '</span></div>' +
        '<div class="ci-num">基础生命 ' + B.hp + ' · 半径 ' + B.radius + ' · 招式 ' + B.attacks.length + ' 种</div></div></div>';
    }
    html += '</div>';

    // 突变因子
    html += '<div class="codex-sec">突变因子 · ' + MUTATORS.length + ' 条（每日/随机挑战）</div><div class="codex-grid">';
    for (var m = 0; m < MUTATORS.length; m++) {
      var M = MUTATORS[m];
      html += '<div class="codex-item"><span class="ci-glyph" style="color:' + M.color + '">' + M.glyph + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + M.name + '</div><div class="ci-desc">' + M.desc + '</div></div></div>';
    }
    html += '</div>';
    return html;
  },

  renderAchievements: function (st) {
    var html = '';
    var unlocked = Achievements.unlockedCount(st);
    html += '<div class="codex-sec">成就 · ' + unlocked + ' / ' + ACHIEVEMENTS.length +
      '　（每项达成后立刻发放金币奖励）</div><div class="ach-grid">';
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      var got = !!(st.ach && st.ach[a.id]);
      var progHtml = '';
      if (!got && a.prog) {
        var pr = null;
        try { pr = a.prog(this, st); } catch (e) { pr = null; }
        if (pr && pr[1] > 0) {
          var pct = clamp(pr[0] / pr[1], 0, 1);
          progHtml = '<div class="ach-bar"><span style="width:' + (pct * 100).toFixed(1) + '%;background:' + a.color + '"></span></div>' +
            '<div class="ach-prog">' + fmtNum(pr[0]) + ' / ' + fmtNum(pr[1]) + '</div>';
        }
      }
      html += '<div class="ach-item' + (got ? ' got' : '') + '">' +
        '<span class="ci-glyph" style="color:' + (got ? a.color : '#4a5878') + '">' + (got ? a.glyph : '?') + '</span>' +
        '<div class="ci-body"><div class="ci-name">' + a.name +
        '<span class="ci-tag">' + (got ? '已达成' : '金币 +' + a.reward) + '</span></div>' +
        '<div class="ci-desc">' + a.desc + '</div>' + progHtml + '</div></div>';
    }
    html += '</div>';
    return html;
  },

  renderHistory: function (st) {
    var h = st.history || [];
    if (!h.length) return '<div class="codex-sec">战绩 · 最近 10 局</div><div class="build-empty">还没有战绩，去打一局吧。</div>';
    var html = '<div class="codex-sec">战绩 · 最近 ' + h.length + ' 局</div><div class="hist-list">';
    for (var i = 0; i < h.length; i++) {
      var r = h[i];
      var ch = getChar(r.char);
      var dname = r.diff;
      for (var d = 0; d < DIFFICULTIES.length; d++) if (DIFFICULTIES[d].id === r.diff) dname = DIFFICULTIES[d].name;
      var muts = '';
      for (var m = 0; m < (r.muts || []).length; m++) {
        var mu = getMutator(r.muts[m]);
        if (mu) muts += '<span class="ci-tag mut">' + mu.name + '</span>';
      }
      var when = '';
      try {
        var dt = new Date(r.t);
        when = (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' +
          (dt.getHours() < 10 ? '0' : '') + dt.getHours() + ':' + (dt.getMinutes() < 10 ? '0' : '') + dt.getMinutes();
      } catch (e) { when = ''; }
      html += '<div class="hist-row' + (r.win ? ' win' : '') + '">' +
        '<span class="hist-when">' + when + '</span>' +
        '<span class="hist-char" style="color:' + ch.color + '">' + ch.glyph + ' ' + ch.name + '</span>' +
        '<span class="hist-diff">' + dname + muts + '</span>' +
        '<span class="hist-num">波次 <b>' + r.wave + '</b></span>' +
        '<span class="hist-num">击杀 <b>' + fmtNum(r.kills) + '</b></span>' +
        '<span class="hist-num">等级 <b>' + r.level + '</b></span>' +
        '<span class="hist-num">' + fmtTime(r.secs) + '</span>' +
        '<span class="hist-gold">+' + r.gold + '</span>' +
        (r.win ? '<span class="hist-win">通关</span>' : '') +
        '</div>';
    }
    html += '</div>';
    return html;
  },

  /** 菜单里的"今日挑战"面板 */
  refreshChallenge: function () {
    if (!UI.ready) return;
    var daily = dailyChallenge(todayString());
    this._daily = daily;
    UI.text('chDate', daily.date);
    var c = getChar(daily.charId);
    var dname = daily.difficulty;
    for (var i = 0; i < DIFFICULTIES.length; i++) if (DIFFICULTIES[i].id === daily.difficulty) dname = DIFFICULTIES[i].name;
    var html = '<span class="ch-chip">角色 · ' + c.name + '</span>' +
      '<span class="ch-chip">难度 · ' + dname + '</span>';
    for (var m = 0; m < daily.mutators.length; m++) {
      var mu = getMutator(daily.mutators[m]);
      if (mu) html += '<span class="ch-chip mut" title="' + mu.desc + '">' + mu.glyph + ' ' + mu.name + '</span>';
    }
    var st = Store.load();
    var rec = st.best['daily:' + daily.date];
    html += '<span class="ch-record">' + (rec ? '今日最佳：波次 ' + rec.wave + ' · 击杀 ' + rec.kills : '今日尚未挑战') + '</span>';
    UI.el.chBody.innerHTML = html;
  },

  startDaily: function () {
    var daily = this._daily || dailyChallenge(todayString());
    Sfx.ui();
    this.startRun({ charId: daily.charId, difficulty: daily.difficulty, mutators: daily.mutators, date: daily.date });
  },

  startRandomChallenge: function () {
    Sfx.ui();
    var r = randomChallenge();
    this.startRun({ charId: r.charId, difficulty: r.difficulty, mutators: r.mutators, date: null });
  },

  /** 普通开局：走一次默认挑战为空的开局 */
  startNormal: function () {
    this.startRun(null);
  },

  openShop: function () {
    this.shopFrom = (this.state === 'menu') ? 'menu' : 'gameover';
    this.state = 'shop';
    UI.hide('menu'); UI.hide('gameover');
    UI.show('shop');
    this.refreshShop();
  },

  refreshShop: function () {
    var st = Store.load();
    UI.el.shopGold.textContent = st.gold || 0;
    var box = UI.el.shopList;
    box.innerHTML = '';
    var self = this;
    for (var i = 0; i < SHOP.length; i++) {
      var it = SHOP[i];
      var lv = st.meta[it.id] || 0;
      var maxed = lv >= it.maxLv;
      var cost = shopCost(it, lv);
      var row = document.createElement('div');
      row.className = 'shop-row' + (maxed ? ' maxed' : '');
      row.innerHTML =
        '<div class="sr-glyph">' + it.glyph + '</div>' +
        '<div class="sr-body"><div class="sr-name">' + it.name +
        ' <span class="sr-lvl">Lv.' + lv + '/' + it.maxLv + '</span></div>' +
        '<div class="sr-desc">' + it.desc + '</div></div>' +
        '<button class="sr-buy"' + (maxed || (st.gold || 0) < cost ? ' disabled' : '') + '>' +
        (maxed ? '已满级' : cost + ' 金币') + '</button>';
      (function (item, level) {
        row.querySelector('.sr-buy').addEventListener('click', function () {
          var s = Store.load();
          var c = shopCost(item, level);
          if ((s.meta[item.id] || 0) >= item.maxLv) return;
          if ((s.gold || 0) < c) { Sfx.hurt(); return; }
          s.gold -= c;
          s.meta[item.id] = (s.meta[item.id] || 0) + 1;
          Store.save();
          Sfx.coin();
          self.refreshShop();
          self.refreshMenu();
        });
      })(it, lv);
      box.appendChild(row);
    }
  },

  closeShop: function () {
    UI.hide('shop');
    if (this.shopFrom === 'menu') {
      this.state = 'menu';
      UI.show('menu');
      this.refreshMenu();
    } else {
      this.state = 'dead';
      UI.show('gameover');
    }
  },

  toggleFx: function () {
    Settings.cycle('fxLite', 1);
    this.syncSettingLabels();
    UI.toast(Fx.lite ? '已切到精简特效（护眼 / 低配）' : '已恢复完整特效');
  },

  toggleSound: function () {
    Settings.cycle('sound', 1);
    this.syncSettingLabels();
    if (Sfx.enabled) { Sfx.unlock(); if (this.state === 'playing') Sfx.startMusic(); }
    else Sfx.stopMusic();
    UI.toast('音效已' + (Sfx.enabled ? '开启' : '关闭'));
  },

  retry: function () {
    if (this.victoryOpen) {
      // 无尽模式继续
      this.victoryOpen = false;
      this.victory = false;
      this.state = 'playing';
      UI.hide('gameover');
      UI.show('hud');
      this.calm = 2.5;
      this.lastFrame = 0;
      if (Sfx.enabled) Sfx.startMusic();
      UI.banner('无尽模式', 1600);
      return;
    }
    this.startRun();
  },

  /* ============================================================ 渲染 */
  render: function () {
    var ctx = this.ctx;
    if (!ctx) return;
    var w = View.w, h = View.h;
    this.drawStats.drawn = 0;
    this.drawStats.culled = 0;
    this._dmgText = 0;          // 每帧重置伤害数字配额
    this._dmgCrit = 0;

    // 背景
    var grd = ctx.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#070912');
    grd.addColorStop(0.55, '#0a1024');
    grd.addColorStop(1, '#05070f');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);

    if (this.state === 'menu' || this.state === 'shop' || !this.player) {
      Starfield.render(ctx, this.cam, this.time + (this.lastFrame || 0) * 0.001);
      drawGrid(ctx, this.cam, w, h, 90, 'rgba(90,140,255,0.05)');
      this.renderVignette(ctx, w, h);
      return;
    }

    Starfield.render(ctx, this.cam, this.time);
    drawGrid(ctx, this.cam, w, h, 100, 'rgba(90,140,255,0.055)');

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.cam.zoom, this.cam.zoom);
    ctx.translate(-this.cam.x + this.cam.shakeX, -this.cam.y + this.cam.shakeY);

    this.renderZones(ctx);
    this.renderMines(ctx);
    this.renderGems(ctx);
    this.renderCoins(ctx);
    this.renderOrbs(ctx);
    this.renderRelicDrops(ctx);
    this.renderAura(ctx);
    this.renderEnemies(ctx);
    this.renderShocks(ctx);
    this.renderBullets(ctx);
    this.renderEnemyBullets(ctx);
    this.renderOrbit(ctx);
    this.renderBeams(ctx);
    this.renderBolts(ctx);
    this.renderPlayer(ctx);
    Particles.render(ctx, this.cam, View.w / (2 * this.cam.zoom), View.h / (2 * this.cam.zoom));

    ctx.restore();

    // 屏幕特效
    if (this.cam.flash > 0) {
      ctx.globalAlpha = this.cam.flash;
      ctx.fillStyle = this.cam.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    this.renderVignette(ctx, w, h);
    this.renderMinimapOffscreen(ctx);
  },

  renderVignette: function (ctx, w, h) {
    // 静态全屏暗角：缓存贴图后每帧只做一次 drawImage
    if (Vignette.render(ctx, w, h)) return;
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },

  /** 屏幕边缘的敌人指示器（简易雷达） */
  renderMinimapOffscreen: function (ctx) {
    if (this.state !== 'playing') return;
    var p = this.player, w = View.w, h = View.h;
    var list = [];
    if (this.boss && !this.boss.dead) list.push(this.boss);
    else for (var i = 0; i < this.enemies.length; i++) if (this.enemies[i].elite) list.push(this.enemies[i]);
    var margin = 26;
    for (var j = 0; j < list.length && j < 12; j++) {
      var e = list[j];
      var sx = (e.x - this.cam.x) * this.cam.zoom + w / 2;
      var sy = (e.y - this.cam.y) * this.cam.zoom + h / 2;
      if (sx > margin && sx < w - margin && sy > margin && sy < h - margin) continue;
      var a = Math.atan2(e.y - p.y, e.x - p.x);
      var r = Math.min(w, h) / 2 - margin;
      var px = w / 2 + Math.cos(a) * r;
      var py = h / 2 + Math.sin(a) * r;
      var col = e.isBoss ? '#ff3d7a' : ELITE.color;
      Draw.glow(ctx, col, 14);
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(a);
      var s = e.isBoss ? 9 : 6;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.6, s * 0.7); ctx.lineTo(-s * 0.6, -s * 0.7); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  },

  renderZones: function (ctx) {
    for (var i = 0; i < this.zones.length; i++) {
      var z = this.zones[i];
      if (!this.visible(z.x, z.y, z.r + 12)) continue;
      var t = 1 - z.life / z.dur;                 // 1 → 0
      var pulse = 0.85 + 0.15 * Math.sin(this.time * 6 + i * 2);
      // 中心几乎透明、边缘发光的能量场（用渐变代替实心填充，避免多层叠加成泥）
      var g = ctx.createRadialGradient(z.x, z.y, z.r * 0.45, z.x, z.y, z.r);
      g.addColorStop(0, hexA(z.color, 0));
      g.addColorStop(0.72, hexA(z.color, 0.07 * t));
      g.addColorStop(1, hexA(z.color, 0.26 * t * pulse));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.fill();
      // 旋转虚线外环
      if (ctx.setLineDash) {
        ctx.setLineDash([13, 11]);
        ctx.lineDashOffset = -this.time * 46;
      }
      ctx.globalAlpha = 0.75 * t;
      ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      Draw.glow(ctx, z.color, 10);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, TAU); ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      ctx.shadowBlur = 0;
      // 内侧旋转的三段弧
      ctx.globalAlpha = 0.35 * t;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (var k = 0; k < 3; k++) {
        var a0 = this.time * 1.5 + (k / 3) * TAU;
        ctx.arc(z.x, z.y, z.r * 0.66, a0, a0 + 0.5);
        ctx.moveTo(z.x + Math.cos(a0 + 1.1) * z.r * 0.66, z.y + Math.sin(a0 + 1.1) * z.r * 0.66);
      }
      ctx.stroke();
      // 敌方危险区域：额外的警示内环 + 上升气泡，一眼区分"这是敌人的，别站进去"
      if (z.hostile) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(this.time * 7);
        ctx.strokeStyle = '#e8ffe8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r * 0.82, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.55 * t;
        for (var b2 = 0; b2 < 4; b2++) {
          var ba = (b2 / 4) * TAU + this.time * 0.8;
          var br = z.r * (0.25 + 0.5 * ((this.time * 0.5 + b2 * 0.25) % 1));
          ctx.beginPath();
          ctx.arc(z.x + Math.cos(ba) * br, z.y + Math.sin(ba) * br, 3.5, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  },

  renderMines: function (ctx) {
    for (var i = 0; i < this.mines.length; i++) {
      var m = this.mines[i];
      var armed = m.arm >= m.armTime;
      var pulse = armed ? 0.6 + 0.4 * Math.sin(this.time * 8 + i) : 0.25;
      var fade = clamp((m.maxLife - m.life) / 2, 0.3, 1);
      ctx.globalAlpha = fade;
      Draw.glow(ctx, m.color, 14 * pulse);
      ctx.fillStyle = m.color;
      Draw.poly(ctx, m.x, m.y, armed ? 9 : 6, 6, this.time * 1.4 + i, m.color, '#ffffff', 1.4);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.35 * fade;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.aoe * (armed ? pulse : 0.2), 0, TAU);
      ctx.strokeStyle = m.color; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  },

  /** 视口剔除：屏幕外的实体不进渲染管线（发光模糊是这里最贵的一步）
   *  extent = 该实体最大绘制半径（含光环、血条等外扩），保证不会误剔 */
  visible: function (x, y, extent) {
    extent = extent || 0;
    var z = this.cam.zoom || 1;
    var hw = View.w / (2 * z) + extent + 40;
    var hh = View.h / (2 * z) + extent + 40;
    var vis = Math.abs(x - this.cam.x) <= hw && Math.abs(y - this.cam.y) <= hh;
    if (vis) this.drawStats.drawn++; else this.drawStats.culled++;
    return vis;
  },

  renderGems: function (ctx) {
    for (var i = 0; i < this.gems.length; i++) {
      var g = this.gems[i];
      if (!this.visible(g.x, g.y, g.size + 16)) continue;
      var bob = Math.sin(this.time * 4 + g.rot) * 1.6;
      Draw.glow(ctx, g.color, 12);
      ctx.fillStyle = g.color;
      var s = g.size;
      ctx.save();
      ctx.translate(g.x, g.y + bob); ctx.rotate(this.time * 2 + g.rot);
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.72, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.72, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  },

  renderCoins: function (ctx) {
    for (var i = 0; i < this.coins.length; i++) {
      var c = this.coins[i];
      if (!this.visible(c.x, c.y, 20)) continue;
      var s = 5 + Math.sin(this.time * 6 + c.rot) * 1;
      Draw.glow(ctx, '#ffd166', 12);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.ellipse ? ctx.ellipse(c.x, c.y, Math.abs(Math.cos(this.time * 4 + c.rot)) * s + 1, s, 0, 0, TAU)
                  : ctx.arc(c.x, c.y, s, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  },

  renderOrbs: function (ctx) {
    for (var i = 0; i < this.orbs.length; i++) {
      var o = this.orbs[i];
      if (!this.visible(o.x, o.y, 22)) continue;
      var pulse = 0.75 + 0.25 * Math.sin(this.time * 5 + o.rot);
      var bob = Math.sin(this.time * 3 + o.rot) * 2;
      Draw.glow(ctx, '#8bff9f', 20);
      // 外圈
      ctx.globalAlpha = 0.55 * pulse;
      Draw.ring(ctx, o.x, o.y + bob, 9, '#8bff9f', 2, '#8bff9f');
      // 十字（治疗标志）
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#d9ffe4';
      ctx.fillRect(o.x - 5, o.y + bob - 1.8, 10, 3.6);
      ctx.fillRect(o.x - 1.8, o.y + bob - 5, 3.6, 10);
      ctx.shadowBlur = 0;
    }
  },

  renderRelicDrops: function (ctx) {
    for (var i = 0; i < this.relicDrops.length; i++) {
      var r = this.relicDrops[i];
      var rel = RELICS[r.id];
      if (!rel) continue;
      if (!this.visible(r.x, r.y, 190)) continue;   // 光柱很高，给足外扩
      var bob = Math.sin(this.time * 2.6 + r.rot) * 4;
      var pulse = 0.7 + 0.3 * Math.sin(this.time * 4 + r.rot);
      // 光束
      ctx.globalAlpha = 0.22 * pulse;
      var g = ctx.createLinearGradient(r.x, r.y - 130, r.x, r.y + 20);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, rel.color);
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 11, r.y - 130 + bob, 22, 150);
      ctx.globalAlpha = 1;
      // 地面光环
      ctx.globalAlpha = 0.5 * pulse;
      Draw.ring(ctx, r.x, r.y + 10, 22 + 3 * pulse, rel.color, 2, rel.color);
      ctx.globalAlpha = 1;
      // 本体：旋转菱形 + 图标
      Draw.glow(ctx, rel.color, 26);
      ctx.save();
      ctx.translate(r.x, r.y + bob);
      ctx.rotate(this.time * 1.2 + r.rot);
      ctx.fillStyle = rel.color;
      ctx.beginPath();
      ctx.moveTo(0, -15); ctx.lineTo(11, 0); ctx.lineTo(0, 15); ctx.lineTo(-11, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0a0f1e';
      ctx.font = '800 13px ' + FONT_STACK;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rel.glyph, r.x, r.y + bob);
      ctx.fillStyle = rel.color;
      ctx.font = '700 11px ' + FONT_STACK;
      ctx.fillText(rel.name, r.x, r.y + bob - 28);
      ctx.textBaseline = 'alphabetic';
    }
  },

  renderAura: function (ctx) {
    var p = this.player;
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      if (WEAPONS[w.id].kind !== 'aura' || !w.visualR) continue;
      var def = WEAPONS[w.id];
      var r = w.visualR;
      var pulse = 0.5 + 0.5 * Math.sin(this.time * 3.4);
      // 内部：中心透明、边缘发光的热浪
      var g = ctx.createRadialGradient(p.x, p.y, r * 0.28, p.x, p.y, r);
      g.addColorStop(0, hexA(def.color, 0.02));
      g.addColorStop(0.68, hexA(def.color, 0.055 + 0.02 * pulse));
      g.addColorStop(0.93, hexA(def.color, 0.16 + 0.06 * pulse));
      g.addColorStop(1, hexA(def.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
      // 主边界
      ctx.globalAlpha = 0.55;
      Draw.ring(ctx, p.x, p.y, r, def.color, 2, def.color);
      // 逆时针旋转的刻度环
      ctx.globalAlpha = 0.30;
      ctx.strokeStyle = def.color; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (var k = 0; k < 18; k++) {
        var a0 = -this.time * 0.9 + (k / 18) * TAU;
        var r1 = r * 0.9, r2 = r * (k % 3 === 0 ? 0.975 : 0.945);
        ctx.moveTo(p.x + Math.cos(a0) * r1, p.y + Math.sin(a0) * r1);
        ctx.lineTo(p.x + Math.cos(a0) * r2, p.y + Math.sin(a0) * r2);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.18;
      Draw.ring(ctx, p.x, p.y, r * (0.66 + 0.05 * pulse), def.color, 1.4, def.color);
      ctx.globalAlpha = 1;
    }
  },

  renderEnemies: function (ctx) {
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (e.dead) continue;
      // 视口剔除：精英/Boss 身上有额外光环与血条，外扩给大一些
      if (!this.visible(e.x, e.y, e.isBoss ? e.r * 1.6 + 20 : e.r + (e.elite ? 46 : 26))) continue;
      var def = e.def;
      var flash = e.hitFlash > 0;
      var col = flash ? '#ffffff' : (e.elite ? ELITE.color : def.color);
      var spawnScale = e.spawnT > 0 ? lerp(1.5, 1, 1 - e.spawnT / 0.35) : 1;

      if (e.isBoss) this.renderBoss(ctx, e, col, flash);
      else {
        Draw.glow(ctx, col, e.elite ? 22 : 12);
        if (e.spawnT > 0) {
          ctx.globalAlpha = clamp(1 - e.spawnT / 0.35, 0.3, 1);
          Draw.ring(ctx, e.x, e.y, e.r * (2.2 - spawnScale), col, 2, col);
        }
        var sides = def.shape || 3;
        Draw.poly(ctx, e.x, e.y, e.r * spawnScale, sides, e.rot, flash ? '#ffffff' : 'rgba(10,14,28,0.85)', col, 2.4);
        // 内部核心
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = col;
        var inner = e.r * 0.34 * spawnScale;
        ctx.beginPath(); ctx.arc(e.x, e.y, inner, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        // 精英标记
        if (e.elite) {
          ctx.globalAlpha = 0.8;
          Draw.poly(ctx, e.x, e.y - e.r - 9, 5, 3, Math.PI, ELITE.color, null, 0);
          ctx.globalAlpha = 1;
        }
        // 精英词缀环（每种词缀一圈，用词缀色）
        if (e.affixes && e.affixes.length) {
          for (var ai = 0; ai < e.affixes.length; ai++) {
            var af = e.affixes[ai];
            var spin = this.time * (1.1 + ai * 0.5);
            ctx.globalAlpha = 0.75;
            ctx.strokeStyle = af.color;
            ctx.lineWidth = 2;
            Draw.glow(ctx, af.color, 10);
            ctx.beginPath();
            for (var seg = 0; seg < 3; seg++) {
              var s0 = spin + (seg / 3) * TAU + ai;
              ctx.arc(e.x, e.y, e.r + 5 + ai * 4, s0, s0 + 0.7);
              var s1 = s0 + 0.7;
              ctx.moveTo(e.x + Math.cos(s1) * (e.r + 5 + ai * 4), e.y + Math.sin(s1) * (e.r + 5 + ai * 4));
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
            // 词缀图标
            ctx.save();
            ctx.translate(e.x + Math.cos(spin * 0.8) * (e.r + 15 + ai * 12), e.y + Math.sin(spin * 0.8) * (e.r + 15 + ai * 12));
            ctx.fillStyle = af.color;
            ctx.font = '700 13px ' + FONT_STACK;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(af.glyph, 0, 0);
            ctx.restore();
            ctx.textBaseline = 'alphabetic';
          }
        }
        // 护盾
        if (e.shield > 0) {
          var sp2 = clamp(e.shield / (e.maxHp * 0.55), 0, 1);
          ctx.globalAlpha = 0.55 + 0.25 * Math.sin(this.time * 5);
          Draw.ring(ctx, e.x, e.y, e.r + 9, '#4ff0ff', 2.5, '#4ff0ff');
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = '#4ff0ff'; ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * sp2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        // 血条
        if (e.hp < e.maxHp * 0.999 || e.elite) {
          var hw = e.r * 2.1;
          Draw.bar(ctx, e.x - hw / 2, e.y - e.r - (e.elite ? 16 : 9), hw, 3.4, clamp(e.hp / e.maxHp, 0, 1),
            'rgba(0,0,0,0.6)', e.elite ? ELITE.color : '#ff5570', false);
        }
        // 状态
        if (e.slowT > 0) { ctx.globalAlpha = 0.5; Draw.ring(ctx, e.x, e.y, e.r + 4, '#7df9ff', 1.6, '#7df9ff'); ctx.globalAlpha = 1; }
        if (e.burnT > 0) { ctx.globalAlpha = 0.5; Draw.ring(ctx, e.x, e.y, e.r + 7, '#ff8a3d', 1.6, '#ff8a3d'); ctx.globalAlpha = 1; }
        if (e.stunT > 0) { ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffe066'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('✦', e.x, e.y - e.r - 6); ctx.globalAlpha = 1; }
        if (e.pulse) {
          var pu = 0.5 + 0.5 * Math.sin(this.time * 22);
          ctx.globalAlpha = 0.5 + pu * 0.5;
          Draw.ring(ctx, e.x, e.y, e.r + 8 + pu * 4, '#ff4d4d', 3, '#ff4d4d');
          ctx.globalAlpha = 1;
        }
      }
    }
  },

  renderBoss: function (ctx, b, col, flash) {
    var def = b.def;
    var r = b.r;
    Draw.glow(ctx, col, 34);
    // 外层旋转环
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a0 = b.rot + (i / 6) * TAU;
      ctx.moveTo(b.x + Math.cos(a0) * r * 1.25, b.y + Math.sin(a0) * r * 1.25);
      ctx.arc(b.x, b.y, r * 1.25, a0, a0 + 0.55);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 主体
    Draw.poly(ctx, b.x, b.y, r, def.shape || 6, -b.rot * 0.6, flash ? '#ffffff' : 'rgba(12,8,20,0.92)', col, 4);
    // 内核
    Draw.glow(ctx, col, 26);
    ctx.fillStyle = flash ? '#ffffff' : col;
    ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.42, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(b.x, b.y, r * 0.42 * (1 + 0.12 * Math.sin(this.time * 6)), 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    if (b.state === 'charge') {
      Draw.ring(ctx, b.x, b.y, r + 12 + Math.sin(this.time * 30) * 4, '#ff4d4d', 3, '#ff4d4d');
    }
    if (b.slowT > 0) { ctx.globalAlpha = 0.5; Draw.ring(ctx, b.x, b.y, r + 8, '#7df9ff', 2, '#7df9ff'); ctx.globalAlpha = 1; }
    // ---- 出手预警：把"接下来会发生什么"画清楚 ----
    if (b.windup) this.renderBossTelegraph(ctx, b);
  },

  /** Boss 攻击预告：方向箭头 / 扩散圈 / 落点提示 */
  renderBossTelegraph: function (ctx, b) {
    var w = b.windup;
    var k = 1 - w.t / w.total;                 // 0 → 1 蓄力进度
    var col = (w.atk.color || b.def.color);
    var r = b.r;

    // 蓄力外圈（所有招共通：圈越满越快出手）
    ctx.globalAlpha = 0.35 + 0.45 * k;
    ctx.strokeStyle = col;
    ctx.lineWidth = 3 + 3 * k;
    Draw.glow(ctx, col, 22);
    ctx.beginPath();
    ctx.arc(b.x, b.y, r + 16 + 22 * (1 - k), -Math.PI / 2, -Math.PI / 2 + TAU * k);
    ctx.stroke();
    ctx.shadowBlur = 0;

    var t = w.atk.type;
    if (t === 'charge' || t === 'aimed') {
      // 方向提示：一条越来越实的箭头
      var len = t === 'charge' ? (w.atk.dist || 640) : 460;
      var x2 = b.x + Math.cos(w.aim) * len, y2 = b.y + Math.sin(w.aim) * len;
      ctx.globalAlpha = 0.20 + 0.55 * k;
      ctx.strokeStyle = col; ctx.lineWidth = t === 'charge' ? 26 : 16;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.globalAlpha = 0.5 + 0.5 * k;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(x2, y2); ctx.stroke();
      // 箭头
      ctx.globalAlpha = 0.35 + 0.6 * k;
      ctx.fillStyle = col;
      ctx.save();
      ctx.translate(x2, y2); ctx.rotate(w.aim);
      var s = t === 'charge' ? 26 : 16;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, s * 0.7); ctx.lineTo(-s * 0.7, -s * 0.7);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      if (t === 'aimed') {
        // 扇形范围
        ctx.globalAlpha = 0.12 + 0.2 * k;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.arc(b.x, b.y, 460, w.aim - w.atk.spread * 2.5, w.aim + w.atk.spread * 2.5);
        ctx.closePath(); ctx.fill();
      }
    } else if (t === 'radial' || t === 'spiral' || t === 'sweep' || t === 'homing') {
      // 扩散警示圈：圈到最大时子弹正好飞出去
      var maxR = (w.atk.speed || 200) * 0.55;
      ctx.globalAlpha = 0.10 + 0.22 * k;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(b.x, b.y, maxR * (0.3 + 0.7 * k), 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.4 + 0.5 * k;
      ctx.strokeStyle = col; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, maxR * (0.3 + 0.7 * k), 0, TAU); ctx.stroke();
    } else if (t === 'summon') {
      // 召唤：Boss 周围浮现的召唤位
      ctx.globalAlpha = 0.3 + 0.5 * k;
      for (var i = 0; i < w.atk.n; i++) {
        var a = (i / w.atk.n) * TAU + this.time * 1.5;
        Draw.poly(ctx, b.x + Math.cos(a) * (b.r + 34), b.y + Math.sin(a) * (b.r + 34),
          6 + 6 * k, 3, a, null, col, 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  },

  renderBullets: function (ctx) {
    for (var i = 0; i < this.bullets.length; i++) {
      var b = this.bullets[i];
      if (!this.visible(b.x, b.y, b.r * 3 + 20)) continue;
      Draw.glow(ctx, b.color, b.kind === 'missile' ? 18 : 12);
      if (b.kind === 'missile') {
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.a);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(11, 0); ctx.lineTo(-6, 5); ctx.lineTo(-3, 0); ctx.lineTo(-6, -5);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = b.color;
        ctx.save();
        ctx.translate(b.x, b.y); ctx.rotate(b.a);
        ctx.beginPath();
        ctx.ellipse ? ctx.ellipse(0, 0, b.r * 2.1, b.r * 0.8, 0, 0, TAU) : ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
      }
      ctx.shadowBlur = 0;
    }
  },

  renderEnemyBullets: function (ctx) {
    for (var i = 0; i < this.ebullets.length; i++) {
      var b = this.ebullets[i];
      if (!this.visible(b.x, b.y, b.r + 20)) continue;
      Draw.glow(ctx, b.color, 16);
      ctx.fillStyle = b.color;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.rot);
      Draw.poly(ctx, 0, 0, b.r, 4, 0, b.color, '#ffffff', 1.4);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  },

  renderOrbit: function (ctx) {
    var p = this.player;
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      if (WEAPONS[w.id].kind !== 'orbit' || !w.visualR) continue;
      var def = WEAPONS[w.id];
      for (var j = 0; j < w.visualCount; j++) {
        var a = w.angle + (j / w.visualCount) * TAU;
        var bx = p.x + Math.cos(a) * w.visualR, by = p.y + Math.sin(a) * w.visualR;
        Draw.glow(ctx, def.color, 20);
        Draw.poly(ctx, bx, by, w.visualSize, 3, a + Math.PI / 2, def.color, '#ffffff', 1.6);
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 0.12;
      Draw.ring(ctx, p.x, p.y, w.visualR, def.color, 1, null);
      ctx.globalAlpha = 1;
    }
  },

  renderBeams: function (ctx) {
    var p = this.player;
    for (var i = 0; i < p.weapons.length; i++) {
      var w = p.weapons[i];
      if (!w.beams) continue;
      var def = WEAPONS[w.id];
      for (var j = 0; j < w.beams.length; j++) {
        var b = w.beams[j];
        var flick = 0.85 + Math.random() * 0.3;
        ctx.globalAlpha = 0.28 * flick;
        Draw.glow(ctx, def.color, 30);
        ctx.strokeStyle = def.color; ctx.lineWidth = b.width * 2.6 * flick;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = b.width * 0.55 * flick;
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
    }
  },

  renderBolts: function (ctx) {
    for (var i = 0; i < this.bolts.length; i++) {
      var b = this.bolts[i];
      var a = 1 - b.life / b.max;
      ctx.globalAlpha = a;
      for (var j = 0; j < b.pts.length - 1; j++) {
        Draw.bolt(ctx, b.pts[j].x, b.pts[j].y, b.pts[j + 1].x, b.pts[j + 1].y, b.color, 2.6, 6);
        Draw.bolt(ctx, b.pts[j].x, b.pts[j].y, b.pts[j + 1].x, b.pts[j + 1].y, '#ffffff', 1.1, 6);
      }
      ctx.globalAlpha = 1;
    }
  },

  renderShocks: function (ctx) {
    for (var i = 0; i < this.shocks.length; i++) {
      var s = this.shocks[i];
      if (!this.visible(s.x, s.y, s.max + 12)) continue;
      var t = s.life / s.dur;
      ctx.globalAlpha = (1 - t) * 0.9;
      Draw.glow(ctx, s.color, 26);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 8 * (1 - t) + 1.5;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = (1 - t) * 0.35;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.78, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
  },

  renderPlayer: function (ctx) {
    var p = this.player;
    var c = getChar(this.charId);
    var blink = p.invuln > 0 && Math.floor(this.time * 22) % 2 === 0;

    // 主角底衬：在霓虹混战里压一层暗色，保证永远能一眼找到自己
    var halo = ctx.createRadialGradient(p.x, p.y, p.r * 0.6, p.x, p.y, p.r * 3.4);
    halo.addColorStop(0, 'rgba(3,5,12,0.62)');
    halo.addColorStop(0.55, 'rgba(3,5,12,0.30)');
    halo.addColorStop(1, 'rgba(3,5,12,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.4, 0, TAU); ctx.fill();

    ctx.globalAlpha = blink ? 0.45 : 1;

    // 拾取范围（淡淡的圈）
    ctx.globalAlpha *= 0.14;
    Draw.ring(ctx, p.x, p.y, p.stats.pickup * p.stats.pickupMul, '#4ff0ff', 1.2, null);
    ctx.globalAlpha = blink ? 0.45 : 1;

    // 冲刺方向指示
    if (p.dashCd <= 0) {
      ctx.globalAlpha *= 0.5;
      Draw.ring(ctx, p.x, p.y, p.r + 6 + Math.sin(this.time * 4) * 1.5, c.color, 1.4, null);
      ctx.globalAlpha = blink ? 0.45 : 1;
    } else {
      var pct = 1 - p.dashCd / p.stats.dashCd;
      ctx.globalAlpha *= 0.35;
      ctx.strokeStyle = c.color; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * pct); ctx.stroke();
      ctx.globalAlpha = blink ? 0.45 : 1;
    }

    // 无敌护盾
    if (p.invuln > 0.1) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(this.time * 30);
      Draw.ring(ctx, p.x, p.y, p.r + 10, '#ffffff', 2, '#7df9ff');
      ctx.globalAlpha = blink ? 0.45 : 1;
    }

    // 机体
    Draw.glow(ctx, c.color, 26);
    Draw.poly(ctx, p.x, p.y, p.r, 6, this.time * 0.8, 'rgba(6,10,22,0.98)', '#ffffff', 2.2);
    Draw.poly(ctx, p.x, p.y, p.r * 0.86, 6, this.time * 0.8, 'rgba(10,16,32,0.98)', c.color, 2.6);
    ctx.shadowBlur = 0;
    Draw.arrow(ctx, p.x, p.y, p.r * 0.78, p.facing, c.color, '#ffffff');

    // 受伤闪红
    if (p.hurtFlash > 0) {
      ctx.globalAlpha = p.hurtFlash * 0.6;
      ctx.fillStyle = '#ff3355';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }
};

/** 点是否靠近线段（用于射线） */
function pointLineDist(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var len2 = dx * dx + dy * dy;
  if (len2 < 0.001) return dist(px, py, x1, y1);
  var t = clamp(((px - x1) * dx + (py - y1) * dy) / len2, 0, 1);
  return dist(px, py, x1 + dx * t, y1 + dy * t);
}

/* ---------------------------------------------------- 敌人空间网格
 * 生命值/碰撞查询原本是 O(实体数 × 敌人数)：满屏 700 子弹 × 300 敌人
 * 就是每帧 21 万次距离检测，后期必掉帧。这里按 110px 网格分桶，
 * 查询只取邻近几格，量级直接降一个数量级。
 * 每帧在 updateEnemies 末尾重建一次；期间新刷的怪 spawnT>0.2 本就打不到，
 * 死掉的怪有 e.dead 兜底，所以轻微过期是安全的。
 * ------------------------------------------------------------------------ */
var Grid = {
  cell: 110,
  map: Object.create(null),
  build: function (enemies) {
    var m = Object.create(null);
    var c = this.cell;
    for (var i = 0; i < enemies.length; i++) {
      var e = enemies[i];
      if (e.dead) continue;
      var k = (Math.floor(e.x / c) * 100003 + Math.floor(e.y / c));
      var arr = m[k];
      if (arr === undefined) { arr = m[k] = []; }
      arr.push(e);
    }
    this.map = m;
    return m;
  },
  /** 新生成的敌人立刻入网格，免得"本帧刚出生 → 本帧打不到" */
  insert: function (e) {
    if (!e) return e;
    var k = (Math.floor(e.x / this.cell) * 100003 + Math.floor(e.y / this.cell));
    var arr = this.map[k];
    if (arr === undefined) { arr = this.map[k] = []; }
    arr.push(e);
    return e;
  },
  /** 清空网格（清场/重开时必须调用，否则会留下"幽灵敌人"供武器命中） */
  clear: function () { this.map = Object.create(null); },
  /** 把 (x,y,r) 邻域内的敌人收集进 out（out 由调用方复用，避免每帧分配） */
  query: function (x, y, r, out) {
    out.length = 0;
    var c = this.cell, m = this.map;
    var x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    var y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    for (var gx = x0; gx <= x1; gx++) {
      var base = gx * 100003;
      for (var gy = y0; gy <= y1; gy++) {
        var arr = m[base + gy];
        if (arr === undefined) continue;
        for (var i = 0; i < arr.length; i++) out.push(arr[i]);
      }
    }
    return out;
  }
};
var MAX_ENEMY_R = 44;      // 普通敌人最大半径（精英 ×1.45 后也在内），Boss 单独放宽
var REST_SECONDS = 7;      // 每波之间的休息（局内商店）时长

function nearestEnemyIn(g, list, x, y) {
  var best = null, bd = Infinity;
  for (var i = 0; i < list.length; i++) {
    var e = list[i];
    if (e.dead) continue;
    var d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/* ============================================================== 成就系统 */
var Achievements = {
  /** 检查并解锁；g 传 null 表示只按存档里的累计数据判定 */
  check: function (g) {
    var st = Store.load();
    if (!st.ach) st.ach = {};
    var got = null;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) {
      var a = ACHIEVEMENTS[i];
      if (st.ach[a.id]) continue;
      var ok = false;
      try { ok = !!a.check(g, st); } catch (e) { ok = false; }
      if (!ok) continue;
      st.ach[a.id] = 1;
      st.gold = (st.gold || 0) + a.reward;
      st.totalGold = (st.totalGold || 0) + a.reward;
      if (!got) got = [];
      got.push(a);
    }
    if (got) {
      Store.save();
      for (var k = 0; k < got.length && k < 3; k++) this.announce(g, got[k]);
      if (got.length > 3) UI.toast('另有 ' + (got.length - 3) + ' 项成就同时达成');
    }
    return got;
  },

  announce: function (g, a) {
    UI.banner('🏆 ' + a.name, 2200);
    UI.toast(a.desc + ' · 金币 +' + a.reward);
    Sfx.levelUp();
    if (g && g.player) {
      g.cam.addFlash(0.3, a.color);
      g.cam.addShake(8);
      Particles.shock(g.player.x, g.player.y, 12, 300, { color: a.color, life: 0.7, width: 6 });
      Particles.burst(g.player.x, g.player.y, 40, { color: [a.color, '#ffffff'], speed: 340, life: 0.9, size: 4 });
    }
  },

  unlockedCount: function (st) {
    st = st || Store.load();
    var n = 0;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) if (st.ach && st.ach[ACHIEVEMENTS[i].id]) n++;
    return n;
  }
};

/* ============================================================== 设置
 * 全部存进同一个存档，改完立刻生效（不需要重启）
 * ======================================================================== */
var SETTING_DEFS = [
  {
    id: 'sound', name: '音效与音乐', glyph: '♪', color: '#7df9ff',
    desc: '全部音效与背景音乐（快捷键 M）',
    options: ['开', '关'],
    index: function () { return Sfx.enabled ? 0 : 1; },
    toStore: function (i) { return i === 0; },
    set: function (i) { Sfx.enabled = (i === 0); Sfx.setEnabled(Sfx.enabled); if (Sfx.enabled) { Sfx.unlock(); if (GAME && GAME.state === 'playing') Sfx.startMusic(); } else Sfx.stopMusic(); }
  },
  {
    id: 'dmgText', name: '伤害数字', glyph: '#', color: '#ffd166',
    desc: '满屏数字既看不清也吃性能，关掉后只保留其他手感反馈',
    options: ['全部', '仅暴击', '关闭'],
    index: function () { return Fx.damageText === 'all' ? 0 : (Fx.damageText === 'crit' ? 1 : 2); },
    toStore: function (i) { return i === 0 ? 'all' : (i === 1 ? 'crit' : 'off'); },
    set: function (i) { Fx.damageText = i === 0 ? 'all' : (i === 1 ? 'crit' : 'off'); }
  },
  {
    id: 'fxLite', name: '画面特效', glyph: '✦', color: '#a06bff',
    desc: '精简模式：粒子减到 40%、关闭全屏闪光、震动与顿帧减半',
    options: ['完整', '精简'],
    index: function () { return Fx.lite ? 1 : 0; },
    toStore: function (i) { return i === 1; },
    set: function (i) { Fx.setLite(i === 1); if (UI.el.btnToggleFx) UI.el.btnToggleFx.textContent = '画面特效：' + (Fx.lite ? '精简' : '完整'); }
  },
  {
    id: 'shake', name: '屏幕震动', glyph: '≈', color: '#4ff0ff',
    desc: '关闭后受击、击杀、Boss 都不会再晃屏（晕动症友好）',
    options: ['开', '关'],
    index: function () { return Fx.shakeOn ? 0 : 1; },
    toStore: function (i) { return i === 0; },
    set: function (i) { Fx.shakeOn = (i === 0); }
  },
  {
    id: 'hitstop', name: '命中停顿', glyph: '⏸', color: '#ff8a3d',
    desc: '关闭后不再有打击定格，节奏更连贯',
    options: ['开', '关'],
    index: function () { return Fx.hitstopOn ? 0 : 1; },
    toStore: function (i) { return i === 0; },
    set: function (i) { Fx.hitstopOn = (i === 0); }
  },
  {
    id: 'fps', name: '性能显示', glyph: '⏱', color: '#8bff9f',
    desc: '在 HUD 上显示帧率与每帧耗时（排查卡顿用）',
    options: ['关', '开'],
    index: function () { return Fx.showFps ? 1 : 0; },
    toStore: function (i) { return i === 1; },
    set: function (i) { Fx.showFps = (i === 1); }
  }
];

var Settings = {
  data: null,
  defaults: { sound: true, fxLite: false, dmgText: 'all', shake: true, hitstop: true, fps: false },
  load: function () {
    var st = Store.load();
    if (!st.opts) st.opts = {};
    // 兼容旧存档里的 sound / fxLite 顶层字段：迁移一次后就把旧字段删掉，
    // 否则「恢复默认」清空 opts 重读时又会被旧值盖回来
    var migrated = false;
    if (st.sound !== undefined) {
      if (st.opts.sound === undefined) st.opts.sound = !!st.sound;
      delete st.sound; migrated = true;
    }
    if (st.fxLite !== undefined) {
      if (st.opts.fxLite === undefined) st.opts.fxLite = !!st.fxLite;
      delete st.fxLite; migrated = true;
    }
    for (var k in this.defaults) if (st.opts[k] === undefined) st.opts[k] = this.defaults[k];
    if (migrated) Store.save();
    this.data = st.opts;
    this.apply();
    return this.data;
  },
  apply: function () {
    var d = this.data || this.defaults;
    Sfx.enabled = !!d.sound; Sfx.setEnabled(Sfx.enabled);
    Fx.setLite(!!d.fxLite);
    Fx.damageText = d.dmgText || 'all';
    Fx.shakeOn = d.shake !== false;
    Fx.hitstopOn = d.hitstop !== false;
    Fx.showFps = !!d.fps;
  },
  /** 切到下一个选项并立即生效 + 存档 */
  cycle: function (id, dir) {
    for (var i = 0; i < SETTING_DEFS.length; i++) {
      var d = SETTING_DEFS[i];
      if (d.id !== id) continue;
      var n = d.options.length;
      var idx = (d.index() + (dir || 1) + n) % n;
      d.set(idx);
      this.data[id] = d.toStore(idx);
      Store.save();
      return true;
    }
    return false;
  }
};

/* ============================================================== 触屏控制 */
var Touch = {
  enabled: false,
  init: function () {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    var coarse = false;
    try { coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch (e) { coarse = false; }
    var touchPoints = (typeof navigator !== 'undefined' && navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0;
    this.enabled = !!coarse || ('ontouchstart' in window) || touchPoints > 0;
    if (!this.enabled) return;
    if (document.body && document.body.classList) document.body.classList.add('touch-mode');

    var zone = UI.el.stickZone, knob = UI.el.stickKnob;
    if (!zone || !knob) return;
    var pid = null, cx = 0, cy = 0;
    var MAXR = 46;
    var setKnob = function (dx, dy) {
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    };
    var onDown = function (e) {
      pid = e.pointerId;
      if (zone.setPointerCapture) { try { zone.setPointerCapture(pid); } catch (err) { } }
      var r = zone.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      onMove(e);
      e.preventDefault();
    };
    var onMove = function (e) {
      if (pid === null || e.pointerId !== pid) return;
      var dx = e.clientX - cx, dy = e.clientY - cy;
      var len = Math.sqrt(dx * dx + dy * dy);
      if (len > MAXR) { dx *= MAXR / len; dy *= MAXR / len; }
      Input.stick.active = true;
      Input.stick.x = dx / MAXR;
      Input.stick.y = dy / MAXR;
      setKnob(dx, dy);
      e.preventDefault();
    };
    var onUp = function (e) {
      if (pid !== null && e.pointerId !== pid) return;
      pid = null;
      Input.stick.active = false;
      Input.stick.x = 0; Input.stick.y = 0;
      setKnob(0, 0);
    };
    zone.addEventListener('pointerdown', onDown);
    zone.addEventListener('pointermove', onMove);
    zone.addEventListener('pointerup', onUp);
    zone.addEventListener('pointercancel', onUp);
    zone.addEventListener('pointerleave', onUp);

    var btn = function (el, fn) {
      if (!el) return;
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        if (typeof Sfx !== 'undefined') Sfx.unlock();
        fn();
      });
    };
    btn(UI.el.touchDash, function () { Input.press('space'); });
    btn(UI.el.touchUlt, function () { if (GAME) GAME.castUlt(); });
  }
};

/* ============================================================== 启动 */
var GAME = null;

function bootGame() {
  if (typeof document === 'undefined') return;
  UI.init();
  var canvas = document.getElementById('game');
  GAME = new Game(canvas);
  View.resize(canvas, GAME.ctx);
  Input.init(window);

  var st = Store.load();
  Settings.load();                    // 音效/特效/伤害数字等全部从这里统一应用
  GAME.syncSettingLabels();

  var applyView = function () {
    View.resize(canvas, GAME.ctx);
    // 视口越小越拉远镜头，保证小窗口也能看到足够的战场
    GAME.cam.zoom = clamp(Math.min(View.w / 1180, View.h / 760), 0.6, 1.15);
  };
  GAME._applyView = applyView;
  window.addEventListener('resize', applyView);

  // 按钮绑定
  UI.el.btnStart.addEventListener('click', function () { Sfx.unlock(); Sfx.ui(); GAME.startNormal(); });
  UI.el.btnDaily.addEventListener('click', function () { Sfx.unlock(); GAME.startDaily(); });
  UI.el.btnRandom.addEventListener('click', function () { Sfx.unlock(); GAME.startRandomChallenge(); });
  UI.el.btnRunShopClose.addEventListener('click', function () { Sfx.ui(); GAME.closeRunShop(); });
  UI.el.shopBtn.addEventListener('click', function () { Sfx.ui(); GAME.openRunShop(); });
  UI.el.btnShop.addEventListener('click', function () { Sfx.ui(); GAME.openShop(); });
  UI.el.btnArchive.addEventListener('click', function () { Sfx.ui(); GAME.openArchive('codex'); });
  UI.el.btnSettings.addEventListener('click', function () { Sfx.unlock(); GAME.openSettings(); });
  UI.el.btnSettings2.addEventListener('click', function () { Sfx.ui(); GAME.openSettings(); });
  UI.el.btnSettingsClose.addEventListener('click', function () { Sfx.ui(); GAME.closeSettings(); });
  UI.el.btnSettingsReset.addEventListener('click', function () { GAME.resetSettings(); });
  UI.el.btnArchive2.addEventListener('click', function () { Sfx.ui(); GAME.openArchive('ach'); });
  UI.el.btnArchiveClose.addEventListener('click', function () { Sfx.ui(); GAME.closeArchive(); });
  UI.el.tabCodex.addEventListener('click', function () { GAME.setArchiveTab('codex'); });
  UI.el.tabAch.addEventListener('click', function () { GAME.setArchiveTab('ach'); });
  UI.el.tabHist.addEventListener('click', function () { GAME.setArchiveTab('hist'); });
  UI.el.btnShop2.addEventListener('click', function () { Sfx.ui(); GAME.openShop(); });
  UI.el.btnShopClose.addEventListener('click', function () { Sfx.ui(); GAME.closeShop(); });
  UI.el.btnShopReset.addEventListener('click', function () {
    var s = Store.load();
    s.meta = {};
    Store.save();
    Sfx.ui();
    GAME.refreshShop();
    GAME.refreshMenu();
    UI.toast('已重置全部永久强化');
  });
  UI.el.btnResume.addEventListener('click', function () { Sfx.ui(); GAME.resume(); });
  UI.el.btnQuit.addEventListener('click', function () { Sfx.ui(); GAME.quitToMenu(); });
  UI.el.btnToggleSound.addEventListener('click', function () { Sfx.unlock(); GAME.toggleSound(); });
  UI.el.btnToggleFx.addEventListener('click', function () { Sfx.ui(); GAME.toggleFx(); });
  UI.el.btnRetry.addEventListener('click', function () { Sfx.ui(); GAME.retry(); });
  UI.el.btnMenu.addEventListener('click', function () { Sfx.ui(); GAME.quitToMenu(); });
  UI.el.btnReroll.addEventListener('click', function () { GAME.reroll(); });
  UI.el.btnSkip.addEventListener('click', function () { Sfx.ui(); GAME.skipLevel(); });

  UI.hide('hud'); UI.hide('levelup'); UI.hide('pause'); UI.hide('gameover'); UI.hide('shop');
  UI.hide('touch'); UI.hide('settings');
  // 记住上次选择的角色与难度
  var lastChar = Store.get('lastChar', null), lastDiff = Store.get('lastDiff', null);
  if (lastChar && getChar(lastChar).id === lastChar) GAME.charId = lastChar;
  if (lastDiff) for (var di = 0; di < DIFFICULTIES.length; di++) if (DIFFICULTIES[di].id === lastDiff) GAME.difficulty = lastDiff;
  UI.show('menu');
  GAME.refreshMenu();
  applyView();
  Touch.init();

  window.addEventListener('blur', function () { if (GAME.state === 'playing') GAME.pause(); });

  requestAnimationFrame(function (t) { GAME.frame(t); });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGame);
  else bootGame();
}

/* 供无头测试使用 */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Game: Game, UI: UI, bootGame: bootGame };
}
