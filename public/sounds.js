/* 斗地主音效+BGM v2 · Web Audio 全合成（零外部资源，欢快原创旋律，不使用任何现有版权曲）
 * window.DDSound: init() 首次手势后调用；play(name)；toggle() 循环 全开→仅音效→静音
 */
(function (global) {
  "use strict";
  var SAVE_KEY = "dbdoudizhu-sound-v2"; // 2=全开 1=仅音效 0=静音
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
    unlock: function (t) { [659, 784, 988, 1319].forEach(function (f, i) { tone(f, t + i * 0.09, 0.18, 0.1, "triangle"); }); },
    pause: function (t) { tone(523, t, 0.12, 0.08, "sine"); tone(392, t + 0.1, 0.16, 0.07, "sine"); }
  };

  function play(name) {
    if (mode === 0) return;
    var c = ac(); if (!c) return;
    if (sfx[name]) sfx[name](c.currentTime + 0.01);
  }

  /* ---------- BGM v2：欢快风原创循环（C 大调 · 132bpm · 跳弓拨弦+贝斯+沙锤） ----------
   四小节和弦进行 C→G→Am→F，旋律为原创短句，避免与任何现有乐曲雷同 */
  var NOTE = { C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.0, A4:440.0, B4:493.88,
               C5:523.25, D5:587.33, E5:659.26, F5:698.46, G5:783.99, A5:880.0, B5:987.77, C6:1046.5 };
  var MELODY = [
    // 小节1（C）：轻快跳音
    "E5","G5","C6","G5", "E5","G5","E5","C5",
    // 小节2（G）
    "D5","G5","B5","G5", "D5","G5","D5","B4",
    // 小节3（Am）
    "C5","E5","A5","E5", "C5","E5","C5","A4",
    // 小节4（F）回勾
    "F5","A5","F5","C5", "G5","E5","C5", null
  ];
  var BASS = { C: 65.41, G: 49.0, Am: 55.0, F: 43.65 }; // 低音根音
  var PROG = ["C", "G", "Am", "F"];
  var EIGHTH = 60 / 132 / 2;

  function pluck2(freq, t, gain, dur) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = "square"; o.frequency.value = freq;
    f.type = "lowpass"; f.frequency.value = 3000; f.Q.value = 1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.16));
    o.connect(f).connect(g).connect(c.destination);
    o.start(t); o.stop(t + (dur || 0.16) + 0.05);
  }
  function sparkle(freq, t) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o.frequency.value = freq * 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.15);
  }
  function bassNote(freq, t) {
    var c = ac(); if (!c) return;
    var o = c.createOscillator(), g = c.createGain();
    o.type = "triangle"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.25);
  }
  function hat(t, gain) {
    var c = ac(); if (!c) return;
    var len = Math.floor(c.sampleRate * 0.04);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(); src.buffer = buf;
    var f = c.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 6000;
    var g = c.createGain(); g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  }
  function scheduleBGM() {
    var c = ac(); if (!c) return;
    while (bgmNextTime < c.currentTime + 0.8) {
      var step = bgmStep % 32;           // 32 个八分音符 = 4 小节
      var bar = Math.floor(step / 8);
      var chord = PROG[bar];
      // 旋律跳音（每步）
      var m = MELODY[step];
      if (m) {
        pluck2(NOTE[m], bgmNextTime, step % 4 === 0 ? 0.075 : 0.055);
        if (step % 8 === 0) sparkle(NOTE[m], bgmNextTime);
      }
      // 贝斯：每拍（偶数步）根音，第 4、8 步加五度
      if (step % 2 === 0) {
        bassNote(BASS[chord], bgmNextTime);
        if (step % 8 === 4) bassNote(BASS[chord] * 1.5, bgmNextTime);
      }
      // 沙锤：反拍轻，正拍更轻
      hat(bgmNextTime, step % 2 === 1 ? 0.05 : 0.025);
      bgmNextTime += EIGHTH;
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
  function pauseBGM() { stopBGM(); }
  function resumeBGM() { if (mode === 2 && !bgmTimer) { var c = ac(); if (c) { bgmNextTime = c.currentTime + 0.2; scheduleBGM(); bgmTimer = setInterval(scheduleBGM, 250); } } }

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

  global.DDSound = { init: init, play: play, toggle: toggle, getMode: getMode, setMode: setMode, pauseBGM: pauseBGM, resumeBGM: resumeBGM };
  if (typeof module !== "undefined" && module.exports) module.exports = global.DDSound;
})(typeof window !== "undefined" ? window : globalThis);
