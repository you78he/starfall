/* ============================================================================
 * 星陨幸存者 · STARFALL SURVIVORS
 * engine.js — 引擎层
 *   数学工具 / 输入 / 粒子系统 / WebAudio 音效合成器 / 相机震屏 / 绘制工具 / 存档
 * 无任何外部依赖，全部为普通(非模块)脚本，可直接用 file:// 打开。
 * ==========================================================================*/
'use strict';

/* ------------------------------------------------------------------ 数学 */
var TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
/** 帧率无关的指数逼近 */
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
function rand(a, b) {
  if (a === undefined) return Math.random();
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}
function randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
function chance(p) { return Math.random() < p; }
function dist(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); }
function dist2(ax, ay, bx, by) { var dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
function approach(a, b, step) { return a < b ? Math.min(a + step, b) : Math.max(a - step, b); }
function smoothAngle(from, to, t) {
  var d = ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return from + d * t;
}
function fmtNum(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return '' + n;
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  var m = Math.floor(s / 60);
  return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
}
/** '#rrggbb' → 'rgba(r,g,b,a)'，用于需要控制透明度的发光层 */
function hexA(hex, a) {
  var h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var n = parseInt(h, 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
/** 可播种随机数（用于稳定的商店/关卡布局） */
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ 存档 */
var Store = {
  key: 'starfall_survivors_v1',
  data: null,
  load: function () {
    if (this.data) return this.data;
    var def = {
      gold: 0, meta: {}, best: {}, sound: true, runs: 0, kills: 0, wins: 0,
      ach: {}, history: [], totalGold: 0, evolutions: 0, winsBy: {}, glassWin: 0,
      introDone: false, fxLite: false, lastChar: null, lastDiff: null
    };
    try {
      var raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(this.key) : null;
      if (raw) {
        var parsed = JSON.parse(raw);
        for (var k in def) if (!(k in parsed)) parsed[k] = def[k];
        if (!parsed.meta) parsed.meta = {};
        if (!parsed.best) parsed.best = {};
        this.data = parsed;
      } else this.data = def;
    } catch (e) { this.data = def; }
    return this.data;
  },
  save: function () {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) { /* 隐身模式 / file:// 限制：静默降级为内存存档 */ }
  },
  get: function (path, dflt) {
    var d = this.load(), parts = path.split('.'), cur = d;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object' || !(parts[i] in cur)) return dflt;
      cur = cur[parts[i]];
    }
    return cur === undefined ? dflt : cur;
  },
  set: function (path, val) {
    var d = this.load(), parts = path.split('.'), cur = d;
    for (var i = 0; i < parts.length - 1; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
    this.save();
  }
};

/* ------------------------------------------------------------------ 输入 */
var Input = {
  keys: Object.create(null),
  pressed: Object.create(null),   // 本帧刚按下
  released: Object.create(null),
  pressTime: Object.create(null), // 按键时间戳（输入缓冲用）
  mouse: { x: 0, y: 0, down: false, clicked: false, wx: 0, wy: 0 },
  stick: { x: 0, y: 0, active: false },   // 虚拟摇杆
  enabled: true,
  _bound: false,

  /** 供触屏按钮等外部来源模拟一次按键 */
  press: function (k) {
    if (!this.keys[k]) this.pressed[k] = true;
    this.keys[k] = true;
    this.pressTime[k] = this.now();
  },

  /** 单调时钟（用于输入缓冲） */
  now: function () {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  },

  /** 查询缓冲里是否还有效，但**不消费**（用于"先看能不能处理，再决定消费"） */
  buffered: function (k, ms) {
    var t = this.pressTime[k];
    if (t === undefined || t === null) return false;
    if (this.now() - t > (ms == null ? 250 : ms)) { this.pressTime[k] = null; return false; }
    return true;
  },

  /** 缓冲一次按键：在 ms 毫秒内"消费"它。
   *  用途：冲刺/开店这类动作，不该因为按键恰好落在顿帧或升级弹窗的那几帧里就丢失。 */
  consume: function (k, ms) {
    if (!this.buffered(k, ms)) return false;
    this.pressTime[k] = null;
    return true;
  },

  /** 清空所有缓冲（开局/恢复时调用，避免"上一局的按键"在下一局生效） */
  clearBuffer: function () {
    for (var k in this.pressTime) this.pressTime[k] = null;
  },

  init: function (target) {
    if (this._bound || typeof window === 'undefined') return;
    this._bound = true;
    var self = this;
    this._target = target || window;

    window.addEventListener('keydown', function (e) {
      var k = self.norm(e);
      if (!self.keys[k]) {
        self.pressed[k] = true;
        self.pressTime[k] = self.now();      // 记下时间戳，供带冷却的动作缓冲
      }
      self.keys[k] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'spacebar'].indexOf(k) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) {
      var k = self.norm(e);
      self.keys[k] = false;
      self.released[k] = true;
    });
    window.addEventListener('blur', function () {
      for (var k in self.keys) self.keys[k] = false;
    });
    var t = target || window;
    t.addEventListener('mousemove', function (e) {
      var r = t.getBoundingClientRect ? t.getBoundingClientRect() : { left: 0, top: 0 };
      self.mouse.x = e.clientX - r.left;
      self.mouse.y = e.clientY - r.top;
    });
    t.addEventListener('mousedown', function () {
      self.mouse.down = true; self.mouse.clicked = true;
      if (typeof Sfx !== 'undefined') Sfx.unlock();
    });
    window.addEventListener('mouseup', function () { self.mouse.down = false; });
    window.addEventListener('touchstart', function () { if (typeof Sfx !== 'undefined') Sfx.unlock(); }, { passive: true });
  },

  norm: function (e) {
    var k = (e.key || '').toLowerCase();
    if (k === ' ' || k === 'spacebar' || e.code === 'Space') return 'space';
    if (e.code === 'Escape') return 'escape';
    return k;
  },

  down: function () {
    for (var i = 0; i < arguments.length; i++) if (this.keys[arguments[i]]) return true;
    return false;
  },
  hit: function () {
    for (var i = 0; i < arguments.length; i++) if (this.pressed[arguments[i]]) return true;
    return false;
  },

  /** 归一化移动向量（键盘 + 虚拟摇杆） */
  moveVec: function () {
    var x = 0, y = 0;
    if (this.down('a', 'arrowleft')) x -= 1;
    if (this.down('d', 'arrowright')) x += 1;
    if (this.down('w', 'arrowup')) y -= 1;
    if (this.down('s', 'arrowdown')) y += 1;
    if (this.stick.active) { x += this.stick.x; y += this.stick.y; }
    var len = Math.sqrt(x * x + y * y);
    if (len > 1) { x /= len; y /= len; }
    return { x: x, y: y };
  },

  endFrame: function () {
    this.pressed = Object.create(null);
    this.released = Object.create(null);
    this.mouse.clicked = false;
  }
};

/* ------------------------------------------------- 音效合成器 (WebAudio) */
var Sfx = {
  ctx: null, master: null, musicGain: null, sfxGain: null,
  enabled: true, musicEnabled: true, noiseBuf: null, ready: false,
  _music: { next: 0, step: 0, bpm: 96, playing: false, intensity: 0 },

  unlock: function () {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    if (typeof window === 'undefined') return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.75;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);
      // 预生成白噪声
      var len = Math.floor(this.ctx.sampleRate * 1.2);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.ready = true;
    } catch (e) { this.ready = false; }
  },

  setEnabled: function (on) {
    this.enabled = !!on;
    if (this.master) this.master.gain.value = on ? 0.75 : 0.0;
  },

  now: function () { return this.ctx ? this.ctx.currentTime : 0; },

  /** 基础振荡器音 */
  tone: function (o) {
    if (!this.enabled || !this.ready) return;
    try {
      var t0 = this.now() + (o.delay || 0);
      var dur = o.dur || 0.12;
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(o.freq, t0);
      if (o.freq2 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + dur);
      var vol = (o.vol == null ? 0.2 : o.vol);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.006));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      var node = osc;
      if (o.filter) {
        var f = this.ctx.createBiquadFilter();
        f.type = o.filter;
        f.frequency.value = o.filterFreq || 1200;
        osc.connect(f); node = f;
      }
      node.connect(g);
      g.connect(this.sfxGain);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  /** 噪声爆破 */
  noise: function (o) {
    if (!this.enabled || !this.ready) return;
    try {
      var t0 = this.now() + (o.delay || 0);
      var dur = o.dur || 0.2;
      var src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      var f = this.ctx.createBiquadFilter();
      f.type = o.filter || 'lowpass';
      f.frequency.setValueAtTime(o.from || 3000, t0);
      f.frequency.exponentialRampToValueAtTime(Math.max(60, o.to || 200), t0 + dur);
      f.Q.value = o.q || 1;
      var g = this.ctx.createGain();
      var vol = (o.vol == null ? 0.2 : o.vol);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    } catch (e) { /* ignore */ }
  },

  /* ---- 具体音效 ---- */
  shoot: function (pitch) {
    var f = 720 + (pitch || 0) * 90;
    this.tone({ type: 'square', freq: f, freq2: f * 0.42, dur: 0.07, vol: 0.075 });
  },
  laser: function () { this.tone({ type: 'sawtooth', freq: 1300, freq2: 900, dur: 0.06, vol: 0.035 }); },
  hit: function () { this.noise({ dur: 0.07, from: 4200, to: 900, vol: 0.055 }); },
  crit: function () { this.tone({ type: 'triangle', freq: 1500, freq2: 2400, dur: 0.1, vol: 0.09 }); this.noise({ dur: 0.08, from: 6000, to: 2000, vol: 0.05 }); },
  kill: function () { this.noise({ dur: 0.16, from: 1800, to: 180, vol: 0.09 }); this.tone({ type: 'triangle', freq: 260, freq2: 90, dur: 0.13, vol: 0.06 }); },
  pickup: function () { this.tone({ type: 'sine', freq: 900, freq2: 1500, dur: 0.055, vol: 0.05 }); },
  coin: function () { this.tone({ type: 'sine', freq: 1200, freq2: 1800, dur: 0.08, vol: 0.07 }); this.tone({ type: 'sine', freq: 1800, freq2: 2400, dur: 0.1, vol: 0.04, delay: 0.06 }); },
  hurt: function () { this.tone({ type: 'sawtooth', freq: 260, freq2: 70, dur: 0.22, vol: 0.16 }); this.noise({ dur: 0.18, from: 900, to: 120, vol: 0.12 }); },
  explode: function (big) {
    this.noise({ dur: big ? 0.55 : 0.3, from: big ? 2600 : 1800, to: 60, vol: big ? 0.24 : 0.15, q: 0.8 });
    this.tone({ type: 'sine', freq: big ? 150 : 220, freq2: 40, dur: big ? 0.5 : 0.28, vol: big ? 0.2 : 0.12 });
  },
  dash: function () { this.noise({ dur: 0.18, from: 4200, to: 700, vol: 0.08, filter: 'bandpass', q: 2 }); },
  levelUp: function () {
    var notes = [523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++)
      this.tone({ type: 'triangle', freq: notes[i], dur: 0.3, vol: 0.11, delay: i * 0.06 });
  },
  choose: function () { this.tone({ type: 'triangle', freq: 880, freq2: 1320, dur: 0.12, vol: 0.1 }); },
  waveStart: function () { this.tone({ type: 'sawtooth', freq: 180, freq2: 420, dur: 0.45, vol: 0.11, filter: 'lowpass', filterFreq: 900 }); },
  bossWarn: function () {
    for (var i = 0; i < 3; i++) this.tone({ type: 'sawtooth', freq: 130, freq2: 96, dur: 0.4, vol: 0.16, delay: i * 0.28, filter: 'lowpass', filterFreq: 620 });
  },
  bossDie: function () {
    this.explode(true);
    var notes = [392, 523, 659, 784, 1046];
    for (var i = 0; i < notes.length; i++) this.tone({ type: 'triangle', freq: notes[i], dur: 0.6, vol: 0.1, delay: 0.1 + i * 0.1 });
  },
  gameOver: function () {
    var notes = [440, 349, 262, 196];
    for (var i = 0; i < notes.length; i++) this.tone({ type: 'sawtooth', freq: notes[i], dur: 0.7, vol: 0.13, delay: i * 0.18, filter: 'lowpass', filterFreq: 800 });
  },
  ui: function () { this.tone({ type: 'square', freq: 1200, freq2: 1600, dur: 0.035, vol: 0.05 }); },
  /** Boss 出手预警：短促上扬的提示音 */
  telegraph: function () {
    this.tone({ type: 'triangle', freq: 420, freq2: 760, dur: 0.12, vol: 0.075 });
  },
  heal: function () { this.tone({ type: 'sine', freq: 620, freq2: 1100, dur: 0.24, vol: 0.09 }); },

  /* ---- 背景音乐：极简步骤音序器（由主循环驱动） ---- */
  startMusic: function () {
    if (!this.ready || !this.musicEnabled) return;
    this._music.playing = true;
    this._music.next = this.now() + 0.1;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.3, this.now(), 1.2);
  },
  stopMusic: function () {
    this._music.playing = false;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(0, this.now(), 0.5);
  },
  setIntensity: function (v) { this._music.intensity = clamp(v, 0, 1); },

  tickMusic: function () {
    if (!this.playing || !this.ready || !this.enabled) return;
    var m = this._music;
    var spb = 60 / m.bpm / 4;          // 16 分音符
    var t = this.now();
    if (m.next < t) m.next = t + 0.05;
    var guard = 0;
    while (m.next < t + 0.25 && guard++ < 32) {
      this._musicStep(m.step, m.next);
      m.step = (m.step + 1) % 32;
      m.next += spb;
    }
  },

  _musicStep: function (step, t) {
    var I = this._music.intensity;
    var bass = [55, 0, 0, 0, 82.4, 0, 0, 0, 65.4, 0, 0, 0, 73.4, 0, 0, 0,
                55, 0, 0, 0, 82.4, 0, 0, 0, 98, 0, 0, 0, 73.4, 0, 0, 0];
    var self = this;
    var note = bass[step];
    if (note) {
      this._sched(function () {
        var o = self.ctx.createOscillator(), g = self.ctx.createGain(), f = self.ctx.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = note;
        f.type = 'lowpass'; f.frequency.value = 260 + I * 500; f.Q.value = 6;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
        o.connect(f); f.connect(g); g.connect(self.musicGain);
        o.start(t); o.stop(t + 0.4);
      });
    }
    // 高音琶音：强度越高越密
    if (I > 0.15 && step % 2 === 0 && Math.random() < 0.25 + I * 0.45) {
      var scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3];
      var f2 = scale[(Math.random() * scale.length) | 0];
      this._sched(function () {
        var o = self.ctx.createOscillator(), g = self.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = f2;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.06 + I * 0.05, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g); g.connect(self.musicGain);
        o.start(t); o.stop(t + 0.26);
      });
    }
    // 打击垫
    if (I > 0.3 && step % 8 === 0) {
      this._sched(function () {
        var s = self.ctx.createBufferSource(); s.buffer = self.noiseBuf; s.loop = true;
        var f = self.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6500;
        var g = self.ctx.createGain();
        g.gain.setValueAtTime(0.05 * I, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        s.connect(f); f.connect(g); g.connect(self.musicGain);
        s.start(t); s.stop(t + 0.12);
      });
    }
  },
  _sched: function (fn) { try { fn(); } catch (e) { /* ignore */ } }
};

/* ------------------------------------------------------- 特效强度（护眼/低配） */
var Fx = {
  lite: false,
  damageText: 'all',      // 'all' | 'crit' | 'off'
  shakeOn: true,
  hitstopOn: true,
  showFps: false,
  setLite: function (on) { this.lite = !!on; return this.lite; },
  /** 粒子数量缩放 */
  count: function (n) { return this.lite ? Math.max(1, Math.round(n * 0.4)) : n; },
  /** 震屏强度缩放（整体调低：密集战斗时画面不该一直抖） */
  shake: function (mag) { return this.shakeOn ? (this.lite ? mag * 0.3 : mag) * 0.7 : 0; },
  /** 全屏闪光强度（精简模式直接关掉，避免强闪） */
  flash: function (a) { return this.lite ? 0 : a; },
  /** 命中停顿（精简模式减半，保留手感但减少顿挫） */
  hitstop: function (t) { return this.hitstopOn ? (this.lite ? t * 0.4 : t * 0.7) : 0; },
  /** 伤害数字是否显示：crit=true 时表示这是一次暴击 */
  allowDamageText: function (crit) {
    if (this.damageText === 'off') return false;
    if (this.damageText === 'crit') return !!crit;
    return true;
  }
};

/* ------------------------------------------------------------------ 粒子 */
var Particles = {
  list: [],
  max: 900,

  clear: function () { this.list.length = 0; },

  add: function (p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(p);
  },

  /** 爆发式粒子 */
  burst: function (x, y, count, o) {
    o = o || {};
    count = Fx.count(count);
    var speed = o.speed || 160, spread = o.spread == null ? TAU : o.spread;
    var dir = o.dir == null ? 0 : o.dir;
    for (var i = 0; i < count; i++) {
      var a = dir + rand(-spread / 2, spread / 2);
      var s = speed * rand(o.speedMin || 0.35, o.speedMax || 1);
      this.add({
        x: x + rand(-(o.jitter || 0), (o.jitter || 0)),
        y: y + rand(-(o.jitter || 0), (o.jitter || 0)),
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: (o.life || 0.5) * rand(0.7, 1.3),
        size: (o.size || 3) * rand(0.6, 1.4),
        color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#7df9ff'),
        drag: o.drag == null ? 3.2 : o.drag,
        grav: o.grav || 0,
        glow: o.glow == null ? true : o.glow,
        shape: o.shape || 'dot',
        spin: rand(-6, 6), rot: rand(0, TAU),
        fade: o.fade || 1
      });
    }
  },

  ring: function (x, y, count, radius, o) {
    o = o || {};
    count = Fx.count(count);
    for (var i = 0; i < count; i++) {
      var a = (i / count) * TAU + rand(-0.08, 0.08);
      var s = (o.speed || 220) * rand(0.8, 1.2);
      this.add({
        x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0, max: (o.life || 0.45) * rand(0.8, 1.2),
        size: (o.size || 3) * rand(0.7, 1.3),
        color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#ffd166'),
        drag: 2.6, grav: 0, glow: true, shape: o.shape || 'dot',
        spin: rand(-8, 8), rot: rand(0, TAU), fade: 1
      });
    }
  },

  /** 冲击波环（单独渲染） */
  shock: function (x, y, r0, r1, o) {
    o = o || {};
    this.add({
      shock: true, x: x, y: y, r0: r0, r1: r1,
      life: 0, max: o.life || 0.4, color: o.color || '#7df9ff',
      width: o.width || 4, drag: 0, grav: 0, glow: true
    });
  },

  text: function (x, y, text, o) {
    o = o || {};
    this.add({
      text: text, x: x, y: y,
      vx: o.vx == null ? rand(-24, 24) : o.vx,
      vy: o.vy == null ? -62 : o.vy,
      life: 0, max: o.life || 0.8,
      size: o.size || 14, color: o.color || '#fff',
      drag: o.drag == null ? 1.6 : o.drag, grav: o.grav == null ? 34 : o.grav,
      glow: true, bold: o.bold !== false, fade: 1, crit: !!o.crit
    });
  },

  update: function (dt) {
    var l = this.list;
    for (var i = l.length - 1; i >= 0; i--) {
      var p = l[i];
      p.life += dt;
      if (p.life >= p.max) { l.splice(i, 1); continue; }
      if (p.shock) continue;
      var d = Math.exp(-(p.drag || 0) * dt);
      p.vx *= d; p.vy *= d;
      p.vy += (p.grav || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot += (p.spin || 0) * dt;
    }
  },

  render: function (ctx, cam, halfW, halfH) {
    var l = this.list;
    // 视口剔除：只对点/火花这类小粒子做（冲击波环可能很大，不剔）
    var cull = !!(cam && halfW);
    for (var i = 0; i < l.length; i++) {
      var p = l[i];
      if (cull && !p.shock) {
        var ex = p.text ? (p.size || 14) * 8 : (p.size || 3) * 4 + 18;
        if (Math.abs(p.x - cam.x) > halfW + ex || Math.abs(p.y - cam.y) > halfH + ex) continue;
      }
      var t = p.life / p.max;
      var a = (1 - t) * (p.fade == null ? 1 : p.fade);
      if (a <= 0.01) continue;
      if (p.shock) {
        var r = lerp(p.r0, p.r1, 1 - Math.pow(1 - t, 2.2));
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.width * (1 - t * 0.7);
        ctx.shadowBlur = 22; ctx.shadowColor = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
        continue;
      }
      if (p.text) {
        ctx.globalAlpha = a > 1 ? 1 : a;
        ctx.fillStyle = p.color;
        ctx.font = (p.bold ? '800 ' : '600 ') + (p.size * (p.crit ? 1.25 : 1)) + 'px ' + FONT_STACK;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = p.crit ? 16 : 8; ctx.shadowColor = p.color;
        if (p.crit) { ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(p.text, p.x, p.y); }
        ctx.fillText(p.text, p.x, p.y);
        continue;
      }
      var s = p.size * (1 - t * 0.55);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      // 发光：用缓存好的软光斑贴图（一次 drawImage），比每帧 shadowBlur 便宜。
      // 但要限制光晕尺寸——它是大面积半透明填充，900 个粒子放大光晕会吃满填充率。
      var sprite = (p.glow && s >= 2.2) ? GlowSprite.get(p.color) : null;
      if (sprite) {
        var gr = Math.min(s * 2.6, 13);
        ctx.globalAlpha = a * 0.5;
        ctx.drawImage(sprite, p.x - gr, p.y - gr, gr * 2, gr * 2);
        ctx.globalAlpha = a;
      } else if (p.glow) {
        ctx.shadowBlur = 4; ctx.shadowColor = p.color;
      }
      if (p.shape === 'spark') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx));
        ctx.fillRect(-s * 2.6, -s * 0.34, s * 5.2, s * 0.68);
        ctx.restore();
      } else if (p.shape === 'square') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
};

var FONT_STACK = '"Noto Sans SC","PingFang SC","Microsoft YaHei",system-ui,sans-serif';

/* ------------------------------------------------------------------ 相机 */
function Camera() { this.reset(); }
Camera.prototype = {
  x: 0, y: 0, zoom: 1,
  trauma: 0, shakeT: 0, shakeX: 0, shakeY: 0, maxOffset: 26,
  flash: 0, flashColor: '#ff3355',
  hitstop: 0, slowmo: 0,
  reset: function () {
    this.x = 0; this.y = 0; this.zoom = 1;
    this.trauma = 0; this.shakeT = 0; this.shakeX = 0; this.shakeY = 0;
    this.flash = 0; this.hitstop = 0; this.slowmo = 0;
    this._hitstopLock = 0;
  },
  /** 震屏用 trauma 模型：传入的是事件权重，累加成 0..1，实际位移 = trauma² × maxOffset。
   *  密集的小事件（暴击、杂兵击杀）几乎不产生位移，只有真正的重击才明显抖动，
   *  不会像"每个事件各自加一个偏移"那样在群攻时叠加成一团乱晃。 */
  addShake: function (mag) {
    mag = Fx.shake(mag);
    if (mag <= 0) return;
    this.trauma = Math.min(1, this.trauma + mag / 16);
  },
  addFlash: function (a, color) {
    a = Fx.flash(a);
    if (a <= 0) return;
    this.flash = Math.min(0.85, this.flash + a);
    if (color) this.flashColor = color;
  },
  addHitstop: function (t) {
    t = Fx.hitstop(t);
    // 顿帧是"卡顿感"的主要来源：限量触发 + 限制时长
    if (this._hitstopLock > 0 || t <= 0) return;
    this._hitstopLock = 0.28;
    this.hitstop = Math.max(this.hitstop, Math.min(t, 0.07));
  },
  update: function (dt, tx, ty) {
    if (this._hitstopLock > 0) this._hitstopLock -= dt;
    var lam = 9;
    this.x = damp(this.x, tx, lam, dt);
    this.y = damp(this.y, ty, lam, dt);
    if (this.trauma > 0.001) {
      this.trauma = Math.max(0, this.trauma - dt * 2.2);      // 线性衰减，约 0.45 秒归零
      var amp = this.trauma * this.trauma * this.maxOffset;   // 平方映射
      this.shakeT += dt * 34;
      this.shakeX = Math.sin(this.shakeT * 1.7) * amp;
      this.shakeY = Math.cos(this.shakeT * 2.3) * amp;
    } else { this.trauma = 0; this.shakeX = 0; this.shakeY = 0; }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.6);
  },
  apply: function (ctx) { ctx.translate(this.shakeX, this.shakeY); }
};

/* -------------------------------------------------------------- 绘制工具 */
var Draw = {
  /** 设置发光 */
  glow: function (ctx, color, blur) {
    ctx.shadowColor = color; ctx.shadowBlur = blur == null ? 14 : blur;
  },
  noglow: function (ctx) { ctx.shadowBlur = 0; },

  circle: function (ctx, x, y, r, fill, glowColor, blur) {
    if (glowColor) this.glow(ctx, glowColor, blur);
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  },

  ring: function (ctx, x, y, r, color, w, glowColor) {
    if (glowColor !== null) this.glow(ctx, glowColor || color, 16);
    ctx.strokeStyle = color; ctx.lineWidth = w || 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.shadowBlur = 0;
  },

  poly: function (ctx, x, y, r, sides, rot, fill, stroke, lw) {
    ctx.beginPath();
    for (var i = 0; i < sides; i++) {
      var a = rot + (i / sides) * TAU;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
  },

  /** 尖端朝 angle 的箭头形 */
  arrow: function (ctx, x, y, r, angle, fill, stroke) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(r * 1.35, 0);
    ctx.lineTo(-r * 0.72, r * 0.86);
    ctx.lineTo(-r * 0.3, 0);
    ctx.lineTo(-r * 0.72, -r * 0.86);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.6; ctx.stroke(); }
    ctx.restore();
  },

  line: function (ctx, x1, y1, x2, y2, color, w, glowColor) {
    if (glowColor !== null) this.glow(ctx, glowColor || color, 12);
    ctx.strokeStyle = color; ctx.lineWidth = w || 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
  },

  /** 折线闪电（确定性抖动由 seed 决定） */
  bolt: function (ctx, x1, y1, x2, y2, color, w, segs) {
    segs = segs || 5;
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len, ny = dx / len;
    this.glow(ctx, color, 18);
    ctx.strokeStyle = color; ctx.lineWidth = w || 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1);
    for (var i = 1; i < segs; i++) {
      var t = i / segs;
      var j = (Math.random() - 0.5) * len * 0.16;
      ctx.lineTo(x1 + dx * t + nx * j, y1 + dy * t + ny * j);
    }
    ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
  },

  roundRect: function (ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  /** 圆角条 */
  bar: function (ctx, x, y, w, h, pct, bg, fg, glow) {
    this.roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = bg; ctx.fill();
    var fw = Math.max(0, Math.min(1, pct)) * w;
    if (fw > 0.5) {
      if (glow) this.glow(ctx, fg, 12);
      ctx.save();
      this.roundRect(ctx, x, y, w, h, h / 2);
      ctx.clip();
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, fw, h);
      ctx.restore();
      ctx.shadowBlur = 0;
    }
  }
};

/* ------------------------------------------------------------ 画布与视口 */
var View = {
  w: 1280, h: 720, dpr: 1, canvas: null, ctx: null,
  quality: 1,            // 渲染倍率（帧率不足时自动下调）
  /** 画布总像素上限：全屏渐变、发光模糊的代价与像素数成正比。
   *  4K + dpr2 时画布有近 1500 万像素，任何全屏操作都会拖垮帧率。 */
  MAXPIX: 4200000,
  resize: function (canvas, ctx) {
    var w = (typeof window !== 'undefined' ? window.innerWidth : 1280);
    var h = (typeof window !== 'undefined' ? window.innerHeight : 720);
    var raw = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    var dpr = Math.min(1.5, raw);          // 先压掉最常见的 dpr=2
    if (w * h * dpr * dpr > this.MAXPIX) {
      dpr = Math.max(0.7, Math.sqrt(this.MAXPIX / (w * h)));
    }
    dpr *= this.quality;
    this.w = w; this.h = h; this.dpr = dpr;
    canvas.width = Math.max(320, Math.floor(w * dpr));
    canvas.height = Math.max(240, Math.floor(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    if (ctx.setTransform) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return dpr;
  }
};

/** 全屏暗角：静态内容，缓存成位图，避免每帧再做一次全屏径向渐变填充 */
var Vignette = {
  canvas: null, w: 0, h: 0,
  render: function (ctx, w, h) {
    if (typeof document === 'undefined') return false;
    if (!this.canvas || this.w !== w || this.h !== h) {
      var c = document.createElement('canvas');
      if (!c || !c.getContext) return false;
      var g2 = c.getContext('2d');
      if (!g2 || !g2.createRadialGradient) return false;
      c.width = w; c.height = h;
      var g = g2.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.62)');
      g2.fillStyle = g;
      g2.fillRect(0, 0, w, h);
      this.canvas = c; this.w = w; this.h = h;
    }
    ctx.drawImage(this.canvas, 0, 0, w, h);
    return true;
  }
};

/** 发光用的软光斑贴图缓存：drawImage 一次贴图，比每帧 shadowBlur 便宜得多 */
var GlowSprite = {
  cache: Object.create(null),
  size: 64,
  get: function (color) {
    if (typeof document === 'undefined') return null;
    var hit = this.cache[color];
    if (hit !== undefined) return hit;
    var c = document.createElement('canvas');
    if (!c || !c.getContext) { this.cache[color] = null; return null; }
    var g2 = c.getContext('2d');
    if (!g2 || !g2.createRadialGradient) { this.cache[color] = null; return null; }
    var s = this.size;
    c.width = s; c.height = s;
    var g = g2.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, hexA(color, 0.95));
    g.addColorStop(0.28, hexA(color, 0.55));
    g.addColorStop(0.6, hexA(color, 0.16));
    g.addColorStop(1, hexA(color, 0));
    g2.fillStyle = g;
    g2.fillRect(0, 0, s, s);
    this.cache[color] = c;
    return c;
  }
};

/* ------------------------------------------------------------ 星野背景 */
var Starfield = {
  layers: [],
  init: function () {
    this.layers = [];
    var conf = [
      { n: 90, sp: 0.06, size: 1.1, color: 'rgba(150,190,255,0.55)' },
      { n: 55, sp: 0.16, size: 1.7, color: 'rgba(190,215,255,0.7)' },
      { n: 26, sp: 0.3, size: 2.5, color: 'rgba(255,235,255,0.85)', twinkle: true }
    ];
    for (var i = 0; i < conf.length; i++) {
      var c = conf[i], arr = [];
      for (var j = 0; j < c.n; j++) {
        arr.push({ x: rand(-1600, 1600), y: rand(-1600, 1600), t: rand(0, TAU) });
      }
      this.layers.push({ c: c, arr: arr });
    }
  },
  PX: 1600, PY: 1000,
  render: function (ctx, cam, time) {
    var PX = this.PX, PY = this.PY;
    var cx = View.w * 0.5, cy = View.h * 0.5;
    for (var i = 0; i < this.layers.length; i++) {
      var L = this.layers[i], c = L.c, arr = L.arr;
      var twinkle = c.twinkle;
      if (!twinkle) {
        // 整层合并成一条路径，一次 fill 画完（逐星 fillRect 会有上百次状态切换）
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(time * 0.9 + i * 2);
        ctx.fillStyle = c.color;
        ctx.beginPath();
        for (var j = 0; j < arr.length; j++) {
          var s = arr[j];
          var wx = s.x - cam.x * c.sp, wy = s.y - cam.y * c.sp;
          var px = ((wx % PX) + PX) % PX - PX / 2 + cx;
          var py = ((wy % PY) + PY) % PY - PY / 2 + cy;
          if (px < -8 || px > View.w + 8 || py < -8 || py > View.h + 8) continue;
          ctx.rect(px, py, c.size, c.size);
        }
        ctx.fill();
        continue;
      }
      // 最近的一层保留逐星闪烁（数量少，可以逐个画）
      ctx.fillStyle = c.color;
      for (var k = 0; k < arr.length; k++) {
        var s2 = arr[k];
        var wx2 = s2.x - cam.x * c.sp, wy2 = s2.y - cam.y * c.sp;
        var px2 = ((wx2 % PX) + PX) % PX - PX / 2 + cx;
        var py2 = ((wy2 % PY) + PY) % PY - PY / 2 + cy;
        if (px2 < -8 || px2 > View.w + 8 || py2 < -8 || py2 > View.h + 8) continue;
        ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 1.6 + s2.t);
        ctx.fillRect(px2, py2, c.size, c.size);
      }
    }
    ctx.globalAlpha = 1;
  }
};

/* --------------------------------------------------------------- 网格 */
function drawGrid(ctx, cam, w, h, spacing, color) {
  var ox = (-cam.x) % spacing, oy = (-cam.y) % spacing;
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (var x = ox - spacing; x < w + spacing; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
  for (var y = oy - spacing; y < h + spacing; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
}
