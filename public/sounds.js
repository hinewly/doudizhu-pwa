/* 斗地主音效+BGM v1 · Web Audio 全合成（零外部资源）
 * window.DDSound: init() 首次手势后调用；play(name)；toggle() 循环 全开→仅音效→静音
 */
(function (global) {
  "use strict";
  var SAVE_KEY = "dbdoudizhu-sound-v1"; // 2=全开 1=仅音效 0=静音
  var mode = 2;
  try { mode = parseInt(localStorage.getItem(SAVE_KEY), 10); if (isNaN(mode)) mode = 2; } catch (e) {}
  var ctx = null, bgmTimer = null, bgmStep = 0, bgmNextTime = 0;

  function ac() {
    if (!ctx) {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* ---------- 基础合成 ---------- */
  function tone(freq, t0, dur, gain, type) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(t0, dur, gain, freq) {
    var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq || 2400; f.Q.value = 0.8;
    var g = c.createGain(); g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t0);
  }

  /* ---------- 音效 ---------- */
  var sfx = {
    deal: function (t) { noise(t, 0.09, 0.16, 3200); },
    play: function (t) { noise(t, 0.06, 0.2, 2000); tone(880, t, 0.05, 0.06, "triangle"); },
    pass: function (t) { tone(330, t, 0.1, 0.07, "sine"); tone(247, t + 0.07, 0.12, 0.06, "sine"); },
    bid: function (t) { tone(523, t, 0.09, 0.09, "triangle"); tone(659, t + 0.09, 0.12, 0.09, "triangle"); },
    bomb: function (t) { noise(t, 0.5, 0.5, 400); tone(90, t, 0.45, 0.3, "sawtooth"); tone(60, t + 0.05, 0.5, 0.25, "sine"); },
    win: function (t) { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, t + i * 0.11, 0.22, 0.12, "triangle"); }); },
    lose: function (t) { [392, 330, 262].forEach(function (f, i) { tone(f, t + i * 0.14, 0.25, 0.1, "sine"); }); },
    click: function (t) { tone(660, t, 0.04, 0.05, "square"); },
    unlock: function (t) { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, t + i * 0.09, 0.18, 0.1, "triangle"); }); }
  };

  function play(name) {
    if (mode === 0) return;
    var c = ac(); if (!c) return;
    if (sfx[name]) sfx[name](c.currentTime + 0.01);
  }

  /* ---------- BGM：C 宫五声音阶轻柔拨弦 + 长音衬底 ---------- */
  var SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.26, 784.0, 880.0];
  var MELODY = [0, 2, 1, 2, 4, 3, 2, 0,   1, 3, 2, 4, 5, 4, 3, 1,
                2, 4, 3, 5, 4, 6, 5, 3,   2, 1, 0, 1, 2, 0, 1, 2];
  var BEAT = 60 / 84; // 84 bpm
  function pluck(freq, t, gain) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "triangle"; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = 2200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(f).connect(g).connect(c.destination);
    o.start(t); o.stop(t + 1.0);
  }
  function pad(freqs, t, dur) {
    var c = ac(); if (!c) return;
    freqs.forEach(function (f) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = "sine"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.028, t + dur * 0.35);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }
  function scheduleBGM() {
    var c = ac(); if (!c) return;
    while (bgmNextTime < c.currentTime + 0.6) {
      var step = bgmStep % MELODY.length;
      var f = SCALE[MELODY[step]];
      pluck(f, bgmNextTime, 0.075);
      if (step % 8 === 0) pad([SCALE[0] / 2, SCALE[2] / 2, SCALE[4] / 2], bgmNextTime, BEAT * 8);
      bgmNextTime += BEAT;
      bgmStep++;
    }
  }
  function startBGM() {
    if (bgmTimer || mode !== 2) return;
    var c = ac(); if (!c) return;
    bgmNextTime = c.currentTime + 0.3; bgmStep = 0;
    scheduleBGM();
    bgmTimer = setInterval(scheduleBGM, 250);
  }
  function stopBGM() { clearInterval(bgmTimer); bgmTimer = null; }

  function setMode(m) {
    mode = m;
    try { localStorage.setItem(SAVE_KEY, String(m)); } catch (e) {}
    if (mode === 2) startBGM(); else stopBGM();
  }
  function toggle() { setMode(mode === 0 ? 2 : mode - 1); return mode; }
  function getMode() { return mode; }

  function init() {
    if (mode === 2) startBGM();
    if (!init._bound) {
      init._bound = true;
      document.addEventListener("pointerdown", function once() {
        if (mode === 2 && !bgmTimer) startBGM();
        document.removeEventListener("pointerdown", once);
      });
    }
  }

  global.DDSound = { init: init, play: play, toggle: toggle, getMode: getMode, setMode: setMode };
  if (typeof module !== "undefined" && module.exports) module.exports = global.DDSound;
})(typeof window !== "undefined" ? window : globalThis);
