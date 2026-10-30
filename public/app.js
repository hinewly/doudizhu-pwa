/* 斗地主 PWA 主控 v0.1.0 —— 经典模式 + 残局闯关 */
(function () {
  "use strict";
  var R = window.DDRules;
  var AI = window.DDAI;
  var SFX = window.DDSound;
  var APP_VERSION = "v0.1.5";
  var SAVE_CLASSIC = "dbdoudizhu-classic-v1";
  var SAVE_SCORE = "dbdoudizhu-score-v1";
  var SAVE_UNLOCK = "dbdoudizhu-unlock-v1";
  var SAVE_PZ = "dbdoudizhu-puzzle-v1";
  var SEAT_NAMES = ["你", "下家", "上家"];
  var SUITS = ["S", "H", "D", "C"];
  var $ = function (id) { return document.getElementById(id); };

  var screen = "menu";
  var C = null;           // 经典局状态
  var P = null;           // 残局状态
  var selected = new Set();
  var hintIdx = 0;
  var aiTimer = null;
  var locked = false;
  var paused = false;
  var dragSel = { active: false, mode: "add", last: -1 };
  var pzHintTimer = null;

  /* ---------- 工具 ---------- */
  function decodeHand(str) {
    // 紧凑串 → 卡牌数组（花色按同点数轮转，仅展示用）
    var map = { "3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"T":10,"J":11,"Q":12,"K":13,"A":14,"2":15,"x":16,"X":17 };
    var per = {}, out = [];
    str = str.replace(/\s+/g, "");
    for (var i = 0; i < str.length; i++) {
      var ch = str[i], r = map[ch];
      if (ch === "x" || ch === "X") { out.push({ s: "J", r: r }); continue; }
      var k = per[r] || 0; per[r] = k + 1;
      out.push({ s: SUITS[k % 4], r: r });
    }
    return out;
  }
  function sortHand(hand) {
    hand.sort(function (a, b) { return b.r - a.r || (a.s + a.r).localeCompare(b.s + b.r); });
  }
  function loadScore() { try { return parseInt(localStorage.getItem(SAVE_SCORE), 10) || 0; } catch (e) { return 0; } }
  function addScore(d) { try { localStorage.setItem(SAVE_SCORE, String(loadScore() + d)); } catch (e) {} }
  function loadUnlock() { try { return Math.min(parseInt(localStorage.getItem(SAVE_UNLOCK), 10) || 1, window.DDPuzzles.length); } catch (e) { return 1; } }
  function saveUnlock(n) { try { localStorage.setItem(SAVE_UNLOCK, String(n)); } catch (e) {} }

  /* ---------- 牌面 ---------- */
  function rankText(r) {
    if (r === 11) return "J"; if (r === 12) return "Q"; if (r === 13) return "K";
    if (r === 14) return "A"; if (r === 15) return "2";
    if (r === 16) return "小王"; if (r === 17) return "大王";
    return String(r);
  }
  function suitSym(s) { return { S: "♠", H: "♥", D: "♦", C: "♣", J: "★" }[s] || ""; }
  function cardHTML(c, cls) {
    var red = c.s === "H" || c.s === "D" || c.r === 17;
    var joker = c.s === "J";
    var inner = joker
      ? '<span class="r">' + (c.r === 17 ? "大" : "小") + '王</span><span class="s">★</span>'
      : '<span class="r">' + rankText(c.r) + '</span><span class="s">' + suitSym(c.s) + "</span>";
    return '<span class="card ' + (joker ? "joker " : "") + (red ? "red" : "blk") + (cls ? " " + cls : "") + '">' + inner + "</span>";
  }
  function typeName(t) {
    var m = { single:"单张", pair:"对子", trio:"三张", trio1:"三带一", trio2:"三带二", straight:"顺子", pairseq:"连对", plane:"飞机", plane1:"飞机带单", plane2:"飞机带对", bomb:"炸弹", rocket:"王炸" };
    return m[t.type] || t.type;
  }
  function playText(play) { return typeName(play) + " " + play.len + "张"; }

  /* ---------- 屏幕切换 ---------- */
  function show(scr) {
    screen = scr;
    paused = false;
    $("pause-modal").classList.add("hidden");
    $("menu").classList.toggle("hidden", scr !== "menu");
    $("classic").classList.toggle("hidden", scr !== "classic");
    $("puzzle").classList.toggle("hidden", scr !== "puzzle");
    if (scr === "menu") {
      clearTimeout(aiTimer);
      $("puzzle-progress").textContent = "已通关 " + (loadUnlock() - 1) + " / " + window.DDPuzzles.length + " 关";
      $("menu-score").textContent = "经典模式积分：" + loadScore();
      try { if (window.DaoBox && window.DaoBox.refresh) window.DaoBox.refresh(); } catch (e) {}
    }
  }

  /* ================= 经典模式 ================= */
  function freshClassic() {
    C = {
      v: 1, phase: "bid",
      hands: [[], [], []], bottom: [],
      bidTurn: Math.floor(Math.random() * 3), bidHighest: 0, bidWinner: -1, bidCount: 0,
      landlord: -1, base: 0, multiplier: 1,
      landlordPlays: 0,
      turn: 0, trick: null, table: [null, null, null], passFlags: [false, false, false]
    };
    deal();
  }
  function deal() {
    var deck = R.shuffle(R.makeDeck());
    for (var s = 0; s < 3; s++) { C.hands[s] = deck.slice(s * 17, (s + 1) * 17); sortHand(C.hands[s]); }
    C.bottom = deck.slice(51);
    C.table = [null, null, null]; C.passFlags = [false, false, false]; C.trick = null;
    selected.clear(); hintIdx = 0;
    SFX.play("deal");
    if (C.phase === "play") { C.turn = C.landlord; log("重新发牌。地主：" + SEAT_NAMES[C.landlord] + "（底分 " + C.base + "）"); }
    else { log("发牌完毕，从 " + SEAT_NAMES[C.bidTurn] + " 开始叫分。"); }
    renderClassic();
    scheduleBidAI();
  }
  function log(msg) {
    var el = $("game-log");
    var p = document.createElement("div");
    p.textContent = msg;
    el.insertBefore(p, el.firstChild);
    while (el.children.length > 4) el.removeChild(el.lastChild);
  }
  function pzLog(msg) {
    var el = $("puzzle-log");
    var p = document.createElement("div");
    p.textContent = msg;
    el.insertBefore(p, el.firstChild);
    while (el.children.length > 4) el.removeChild(el.lastChild);
  }
  function flashMsg(msg) {
    var el = $("flash");
    el.textContent = msg;
    el.classList.remove("hidden");
    clearTimeout(flashMsg._t);
    flashMsg._t = setTimeout(function () { el.classList.add("hidden"); }, 1800);
  }

  /* 叫分 */
  function scheduleBidAI() {
    clearTimeout(aiTimer);
    if (!C || C.phase !== "bid" || paused) return;
    var seat = C.bidTurn;
    if (seat === 0) { renderBidControls(); return; }
    aiTimer = setTimeout(function () {
      if (!C || C.phase !== "bid" || C.bidTurn !== seat) return;
      var b = AI.bid(C.hands[seat]);
      if (b <= C.bidHighest) b = 0;
      applyBid(seat, b);
    }, 700);
  }
  function renderBidControls() {
    var box = $("bid-controls");
    box.classList.remove("hidden");
    $("play-controls").classList.add("hidden");
    box.querySelectorAll("button").forEach(function (b) {
      var v = parseInt(b.dataset.bid, 10);
      b.disabled = v !== 0 && v <= C.bidHighest;
    });
    $("bid-label").textContent = C.bidHighest > 0 ? "当前最高 " + C.bidHighest + " 分：" : "请叫分：";
  }
  function applyBid(seat, b) {
    C.bidCount++;
    if (b > 0) SFX.play("bid");
    if (b > C.bidHighest) { C.bidHighest = b; C.bidWinner = seat; }
    log(SEAT_NAMES[seat] + (b === 0 ? " 不叫" : " 叫 " + b + " 分"));
    if (b === 3 || C.bidCount >= 3) {
      if (C.bidWinner === -1) { log("三家都不叫，重新发牌。"); C.phase = "bid"; C.bidTurn = 0; C.bidHighest = 0; C.bidWinner = -1; C.bidCount = 0; freshClassic(); return; }
      becomeLandlord(C.bidWinner, C.bidHighest);
      return;
    }
    C.bidTurn = (seat + 1) % 3;
    save();
    renderClassic();
    scheduleBidAI();
  }
  function becomeLandlord(seat, base) {
    C.landlord = seat; C.base = base; C.multiplier = 1; C.phase = "play";
    for (var i = 0; i < 3; i++) C.hands[i].push.apply(C.hands[i], C.bottom);
    sortHand(C.hands[seat]);
    log(SEAT_NAMES[seat] + " 当地主（底分 " + base + "），拿底牌：" + C.bottom.map(function (c) { return rankText(c.r); }).join(" "));
    C.turn = seat;
    $("bid-controls").classList.add("hidden");
    $("play-controls").classList.remove("hidden");
    save();
    renderClassic();
    scheduleAI();
  }

  /* 出牌/过牌 */
  function doPlay(seat, cards) {
    var hand = C.hands[seat];
    var play = R.classify(cards);
    if (!play) return false;
    if (C.trick && !R.beats(play, C.trick)) return false;
    var ids = cards.map(function (c) { return c.s + c.r; });
    for (var i = hand.length - 1; i >= 0; i--) {
      var idx = ids.indexOf(hand[i].s + hand[i].r);
      if (idx !== -1) { ids.splice(idx, 1); hand.splice(i, 1); }
    }
    dragSel.sigs = null;
    if (play.type === "bomb" || play.type === "rocket") { C.multiplier *= 2; SFX.play("bomb"); log("💣 翻倍！当前倍数 ×" + C.multiplier); }
    else SFX.play("play");
    C.table[seat] = cards;
    C.passFlags = [false, false, false];
    C.trick = { play: play, seat: seat, passes: 0, cards: cards.length };
    if (seat === C.landlord) C.landlordPlays++;
    log(SEAT_NAMES[seat] + " 出 " + playText(play));
    if (hand.length === 0) { endClassic(seat); return true; }
    C.turn = (seat + 1) % 3;
    save();
    renderClassic();
    scheduleAI();
    return true;
  }
  function doPass(seat) {
    if (!C.trick || C.trick.seat === seat) return;
    SFX.play("pass");
    C.trick.passes++;
    C.passFlags[seat] = true;
    C.table[seat] = null;
    log(SEAT_NAMES[seat] + " 要不起");
    if (C.trick.passes >= 2) {
      var winner = C.trick.seat;
      C.table = [null, null, null];
      C.trick = null;
      selected.clear();
      C.turn = winner;
      log("— " + SEAT_NAMES[winner] + " 赢得本轮，继续出牌 —");
    } else {
      C.turn = (seat + 1) % 3;
    }
    save();
    renderClassic();
    scheduleAI();
  }
  // 春天/反春判定（纯函数便于测试）：春天=地主赢且两农民一张未出；反春=农民赢且地主只出过一手
  function springType(isLL, left1, left2, landlordPlays) {
    if (isLL && left1 === 17 && left2 === 17) return "spring";
    if (!isLL && landlordPlays === 1) return "anti";
    return null;
  }
  function endClassic(winner) {
    var isLL = winner === C.landlord;
    var spring = springType(isLL, C.hands[(C.landlord + 1) % 3].length, C.hands[(C.landlord + 2) % 3].length, C.landlordPlays);
    if (spring) C.multiplier *= 2;
    var delta;
    if (isLL) delta = winner === 0 ? 2 * C.base * C.multiplier : -2 * C.base * C.multiplier;
    else delta = winner === 0 ? C.base * C.multiplier : -C.base * C.multiplier;
    addScore(delta);
    SFX.play(delta > 0 ? "win" : "lose");
    save();
    var box = $("result-modal");
    $("result-title").textContent = delta > 0 ? "🎉 你赢了！" : "惜败";
    $("result-body").innerHTML =
      "<p>" + SEAT_NAMES[winner] + "（" + (isLL ? "地主" : "农民") + "）先出完。</p>" +
      (spring === "spring" ? "<p>🌸 春天！两农民一张未出，倍数翻倍</p>" : "") +
      (spring === "anti" ? "<p>🍃 反春！地主只出过一手，倍数翻倍</p>" : "") +
      "<p>底分 " + C.base + " × 倍数 " + C.multiplier + "</p>" +
      "<p>积分变化：" + (delta > 0 ? "+" : "") + delta + "</p>";
    $("btn-result-ok").dataset.action = "classic";
    box.classList.remove("hidden");
  }

  /* AI 调度（经典） */
  function scheduleAI() {
    clearTimeout(aiTimer);
    if (!C || C.phase !== "play" || locked || paused || screen !== "classic") return;
    var seat = C.turn;
    if (seat === 0) return;
    aiTimer = setTimeout(function () {
      if (!C || C.phase !== "play" || C.turn !== seat || locked || screen !== "classic") return;
      var ctx = {
        mySeat: seat, landlordSeat: C.landlord,
        landlordLeft: C.hands[C.landlord].length,
        peasantMinLeft: Math.min(C.hands[(C.landlord + 1) % 3].length, C.hands[(C.landlord + 2) % 3].length),
        oppMin: minOpp(seat)
      };
      var mv = AI.decide(C.hands[seat], C.trick, ctx);
      if (mv) doPlay(seat, mv.cards); else doPass(seat);
    }, 800);
  }
  function minOpp(seat) {
    var m = Infinity;
    for (var s = 0; s < 3; s++) {
      if (s === seat) continue;
      var enemy = (C.landlord === seat) ? s !== C.landlord : s === C.landlord;
      if (enemy && C.hands[s].length > 0) m = Math.min(m, C.hands[s].length);
    }
    return m === Infinity ? null : m;
  }

  /* 人类操作（经典/残局共用，mode 参数） */
  function humanPlay(mode) {
    if (paused) return;
    var st = mode === "classic" ? C : P;
    var hand = st.hands[0];
    var cards = Array.from(selected).map(function (i) { return hand[i]; });
    if (!cards.length) { flashMsg("先点选要出的牌"); return; }
    var play = R.classify(cards);
    if (!play) { flashMsg("不是合法牌型"); return; }
    if (st.trick && !R.beats(play, st.trick)) { flashMsg("压不过上家，试试别的牌型或「要不起」"); return; }
    selected.clear();
    if (mode === "classic") doPlay(0, cards); else pzDoPlay(0, cards);
  }
  function humanPass(mode) {
    if (paused) return;
    var st = mode === "classic" ? C : P;
    if (!st.trick || st.trick.seat === 0) { flashMsg("本轮由你先出，不能过"); return; }
    selected.clear();
    if (mode === "classic") doPass(0); else pzDoPass(0);
  }
  function humanHint(mode) {
    if (paused) return;
    var st = mode === "classic" ? C : P;
    var hand = st.hands[0];
    var opts = st.trick ? R.responses(hand, st.trick) : R.allLeads(hand);
    if (!opts.length) { flashMsg("没有能压的牌，可以点「要不起」"); selected.clear(); renderHand(mode); return; }
    var mv = opts[hintIdx % opts.length];
    hintIdx++;
    selected.clear();
    mv.cards.forEach(function (c) {
      for (var i = 0; i < hand.length; i++)
        if (hand[i].s === c.s && hand[i].r === c.r) { selected.add(i); break; }
    });
    renderHand(mode);
  }

  /* 渲染（经典） */
  function renderClassic() {
    if (!C) return;
    $("cd-role").textContent = C.landlord === -1 ? "叫分中" : (C.landlord === 0 ? "地主" : "农民");
    $("cd-mult").textContent = C.landlord === -1 ? "—" : C.base + "×" + C.multiplier;
    $("cd-score").textContent = loadScore();
    if (C.phase === "bid") {
      $("cd-info").textContent = "叫分阶段：从 " + SEAT_NAMES[C.bidTurn] + " 开始";
    } else {
      $("cd-info").textContent = C.trick
        ? "桌面：" + playText(C.trick.play) + "（" + SEAT_NAMES[C.trick.seat] + "）· 轮到 " + SEAT_NAMES[C.turn]
        : (C.turn === 0 ? "轮到你先出" : SEAT_NAMES[C.turn] + " 思考中…");
    }
    for (var s = 1; s < 3; s++) renderSeatClassic(s);
    renderBottom();
    renderHand("classic");
    updateButtons("classic");
  }
  function renderSeatClassic(seat) {
    var el = $("seat-" + seat);
    var n = C.hands[seat].length;
    var mine = C.turn === seat && C.phase === "play";
    var html = '<div class="seat-head' + (mine ? " active" : "") + '"><b>' + SEAT_NAMES[seat] + "</b>" +
      (C.landlord === seat ? '<span class="landlord-tag">地主</span>' : "") +
      "<span>" + n + " 张</span></div>";
    if (C.phase === "play") {
      if (C.passFlags[seat]) html += '<div class="pass-tag">要不起</div>';
      else if (C.table[seat]) html += '<div class="played">' + C.table[seat].map(function (c) { return cardHTML(c, "mini"); }).join("") + "</div>";
    }
    html += '<div class="backs">' + "<i></i>".repeat(Math.min(n, 14)) + (n > 14 ? "<em>…</em>" : "") + "</div>";
    el.innerHTML = html;
  }
  function renderBottom() {
    var el = $("bottom-cards");
    if (C.landlord === -1) { el.innerHTML = ""; return; }
    el.innerHTML = C.bottom.map(function (c) { return cardHTML(c, "mini"); }).join("");
  }
  function renderHand(mode) {
    var st = mode === "classic" ? C : P;
    var el = $(mode === "classic" ? "my-hand" : "pz-my-hand");
    var hand = st.hands[0];
    var html = "";
    for (var i = 0; i < hand.length; i++) {
      var c = hand[i];
      var cls = "hand-card" + (selected.has(i) ? " sel" : "");
      html += cardHTML(c, cls).replace('<span class="card', '<span data-i="' + i + '" class="card');
    }
    el.innerHTML = html || '<span class="empty-tip">（手牌已出完）</span>';
  }

  /* ---------- 滑动连选：按住划过即选，支持鼠标拖拽与手机滑动 ---------- */
  /* 划选加牌是否可入：候选(已选+新牌)必须是手牌中某个合法牌型的"子集"——
     即按点数统计后，每种牌的张数都不超过某个可打出牌型对应张数。
     这样 67889T 划选会自动跳过多余的 8（不存在含两张 8 的 6-10 顺子），继续划 76 仍能补成完整顺子 */
  function rebuildPlaySigs(st) {
    dragSel.sigs = R.allPlays(st.hands[0]).map(function (mv) { return R.countsOf(mv.cards); });
    dragSel.sigHand = st.hands[0];
    dragSel.sigLen = st.hands[0].length;
  }
  function dragCanAdd(st, card) {
    var counts = {};
    Array.from(selected).forEach(function (idx) {
      var r = st.hands[0][idx].r;
      counts[r] = (counts[r] || 0) + 1;
    });
    counts[card.r] = (counts[card.r] || 0) + 1;
    if (!dragSel.sigs || dragSel.sigHand !== st.hands[0] || dragSel.sigLen !== st.hands[0].length) rebuildPlaySigs(st);
    var sigs = dragSel.sigs;
    for (var i = 0; i < sigs.length; i++) {
      var sig = sigs[i], ok = true;
      for (var k in counts) if ((sig[k] || 0) < counts[k]) { ok = false; break; }
      if (ok) return true;
    }
    return false;
  }
  function handPointerDown(e) {
    var container = e.currentTarget;
    var st = screen === "classic" ? C : P;
    if (!st || st.turn !== 0 || locked || paused) return;
    if (screen === "classic" && st.phase !== "play") return;
    var node = e.target.closest ? e.target.closest(".card") : null;
    if (!node || node.dataset.i == null) return;
    try { container.setPointerCapture(e.pointerId); } catch (err) {}
    var i = parseInt(node.dataset.i, 10);
    dragSel.active = true;
    dragSel.last = i;
    if (selected.has(i)) { selected.delete(i); dragSel.mode = "remove"; }
    else { selected.add(i); dragSel.mode = "add"; }
    SFX.play("click");
    renderHand(screen);
    e.preventDefault();
  }
  function handPointerMove(e) {
    if (!dragSel.active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var node = el && el.closest ? el.closest(".card[data-i]") : null;
    if (!node) return;
    var i = parseInt(node.dataset.i, 10);
    if (i === dragSel.last) return;
    dragSel.last = i;
    if (dragSel.mode === "add") {
      var st = screen === "classic" ? C : P;
      if (!dragCanAdd(st, st.hands[0][i])) { e.preventDefault(); return; } // 不合牌型规律，跳过
      selected.add(i);
    } else {
      selected.delete(i);
    }
    renderHand(screen);
    e.preventDefault();
  }
  function handPointerUp() { dragSel.active = false; }
  function updateButtons(mode) {
    var st = mode === "classic" ? C : P;
    var my = st && st.turn === 0 && !locked && (mode !== "classic" || st.phase === "play");
    if (mode === "classic") {
      $("btn-play").disabled = !my;
      $("btn-pass").disabled = !my || !st.trick || st.trick.seat === 0;
      $("btn-hint").disabled = !my;
    } else {
      $("pz-play").disabled = !my;
      $("pz-pass").disabled = !my || !st.trick || st.trick.seat === 0;
      $("pz-hint").disabled = !my;
    }
  }
  function save() {
    try {
      if (C) localStorage.setItem(SAVE_CLASSIC, JSON.stringify(C));
      if (P) localStorage.setItem(SAVE_PZ, JSON.stringify(P));
    } catch (e) {}
  }

  /* ================= 残局模式 ================= */
  function startPuzzle(lv) {
    var data = window.DDPuzzles[lv - 1];
    P = { lv: lv, hands: [decodeHand(data.player), decodeHand(data.ai1), decodeHand(data.ai2)], turn: 0, trick: null, table: [null, null, null], passFlags: [false, false, false], solved: false };
    sortHand(P.hands[0]); sortHand(P.hands[1]); sortHand(P.hands[2]);
    selected.clear(); hintIdx = 0;
    $("pz-level").textContent = "第 " + lv + " 关";
    $("puzzle-log").innerHTML = "";
    pzLog("第 " + lv + " 关：你先出，出完即胜。对手手牌全明。");
    save();
    renderPuzzle();
    schedulePzAI();
  }
  function schedulePzAI() {
    clearTimeout(aiTimer);
    if (!P || locked || paused || screen !== "puzzle" || P.turn === 0) return;
    var seat = P.turn;
    aiTimer = setTimeout(function () {
      if (!P || P.turn !== seat || locked || screen !== "puzzle") return;
      var ctx = { mySeat: seat, landlordSeat: 0, landlordLeft: P.hands[0].length, peasantMinLeft: Math.min(P.hands[(seat + 1) % 3].length, P.hands[(seat + 2) % 3].length), oppMin: minOppPz(seat) };
      var mv = AI.decide(P.hands[seat], P.trick, ctx);
      if (mv) pzDoPlay(seat, mv.cards); else pzDoPass(seat);
    }, 800);
  }
  function minOppPz(seat) {
    var m = Infinity;
    for (var s = 1; s < 3; s++) if (s !== seat) m = Math.min(m, P.hands[s].length);
    return m === Infinity ? null : m;
  }
  function pzDoPlay(seat, cards) {
    var hand = P.hands[seat];
    var play = R.classify(cards);
    if (!play) return false;
    if (P.trick && !R.beats(play, P.trick)) return false;
    var ids = cards.map(function (c) { return c.s + c.r; });
    for (var i = hand.length - 1; i >= 0; i--) {
      var idx = ids.indexOf(hand[i].s + hand[i].r);
      if (idx !== -1) { ids.splice(idx, 1); hand.splice(i, 1); }
    }
    P.table[seat] = cards;
    P.passFlags = [false, false, false];
    P.trick = { play: play, seat: seat, passes: 0, cards: cards.length };
    pzLog(SEAT_NAMES[seat] + " 出 " + playText(play));
    if (hand.length === 0) {
      if (seat === 0) puzzleWin(); else puzzleFail();
      return true;
    }
    P.turn = (seat + 1) % 3;
    save();
    renderPuzzle();
    schedulePzAI();
    return true;
  }
  function pzDoPass(seat) {
    if (!P.trick || P.trick.seat === seat) return;
    SFX.play("pass");
    P.trick.passes++;
    P.passFlags[seat] = true;
    P.table[seat] = null;
    pzLog(SEAT_NAMES[seat] + " 要不起");
    if (P.trick.passes >= 2) {
      P.turn = P.trick.seat;
      P.trick = null;
      P.table = [null, null, null];
      selected.clear();
      pzLog("— " + SEAT_NAMES[P.turn] + " 继续出牌 —");
    } else {
      P.turn = (seat + 1) % 3;
    }
    save();
    renderPuzzle();
    schedulePzAI();
  }
  function puzzleWin() {
    var lv = P.lv;
    if (lv >= loadUnlock()) saveUnlock(Math.min(lv + 1, window.DDPuzzles.length + 1));
    save();
    SFX.play("unlock");
    $("result-title").textContent = "🎉 第 " + lv + " 关通关！";
    $("result-body").innerHTML = "<p>" + (lv < window.DDPuzzles.length ? "已解锁第 " + (lv + 1) + " 关。" : "全部 12 关通关，太强了！") + "</p>";
    $("btn-result-ok").dataset.action = "puzzle-next";
    $("result-modal").classList.remove("hidden");
  }
  function puzzleFail() {
    SFX.play("lose");
    $("result-title").textContent = "惜败";
    $("result-body").innerHTML = "<p>对手先出完了。残局一定有必胜路线，再想想？</p>";
    $("btn-result-ok").dataset.action = "puzzle-retry";
    $("result-modal").classList.remove("hidden");
  }
  function renderPuzzle() {
    if (!P) return;
    $("pz-info").textContent = P.trick
      ? "桌面：" + playText(P.trick.play) + "（" + SEAT_NAMES[P.trick.seat] + "）· 轮到 " + SEAT_NAMES[P.turn]
      : (P.turn === 0 ? "轮到你先出" : SEAT_NAMES[P.turn] + " 思考中…");
    for (var s = 1; s < 3; s++) {
      var el = $("pseat-" + s);
      var n = P.hands[s].length;
      var mine = P.turn === s;
      var html = '<div class="seat-head' + (mine ? " active" : "") + '"><b>' + SEAT_NAMES[s] + "</b><span>" + n + " 张</span></div>";
      if (P.passFlags[s]) html += '<div class="pass-tag">要不起</div>';
      else if (P.table[s]) html += '<div class="played">' + P.table[s].map(function (c) { return cardHTML(c, "mini"); }).join("") + "</div>";
      html += '<div class="opencards">' + P.hands[s].map(function (c) { return cardHTML(c, "mini"); }).join("") + "</div>";
      el.innerHTML = html;
    }
    renderHand("puzzle");
    updateButtons("puzzle");
    $("btn-pz-prev").disabled = P.lv <= 1;
    $("btn-pz-next").disabled = P.lv >= loadUnlock();
  }
  /* 残局提示：调求解器找必胜着法 */
  function pzHint() {
    if (!P || P.turn !== 0 || locked || paused) return;
    flashMsg("计算中…");
    setTimeout(function () {
      try {
        var mv = solverBestMove();
        if (!mv) { flashMsg("当前局面没有必胜着法（之前可能已走偏），试试重进本关"); return; }
        selected.clear();
        mv.cards.forEach(function (c) {
          for (var i = 0; i < P.hands[0].length; i++)
            if (P.hands[0][i].s === c.s && P.hands[0][i].r === c.r) { selected.add(i); break; }
        });
        renderHand("puzzle");
        flashMsg("必胜着法已标出（绿色虚线）");
      } catch (e) { flashMsg("局面较复杂，提示超时，先自己试试"); }
    }, 50);
  }
  function solverBestMove() {
    // 动态加载求解器逻辑（浏览器内置精简版）
    var counts = P.hands.map(cardsToCounts);
    var moves = P.trick ? R.responses(P.hands[0], P.trick) : R.allPlays(P.hands[0]);
    // 先试能不能直接出完
    for (var i = 0; i < moves.length; i++) if (moves[i].cards.length === P.hands[0].length) return moves[i];
    // 逐个试，找必胜着
    var capped = moves.slice(0, 40);
    for (var j = 0; j < capped.length; j++) {
      var mv = capped[j];
      var h = counts.map(function (m) { return JSON.parse(JSON.stringify(m)); });
      applyCounts(h[0], mv.cards);
      var nk = { type: mv.play.type, rank: mv.play.rank, len: mv.play.len, seat: 0, passes: 0 };
      if (pzSolve(h, 1, nk)) return mv;
    }
    if (!P.trick) return null;
    // 试试"过"
    var passes = P.trick.passes + 1;
    var h2 = counts.map(function (m) { return JSON.parse(JSON.stringify(m)); });
    var nt, nk2;
    if (passes >= 2) { nk2 = null; nt = P.trick.seat; }
    else { nk2 = { type: P.trick.type, rank: P.trick.rank, len: P.trick.len, seat: P.trick.seat, passes: passes }; nt = 1; }
    if (pzSolve(h2, nt, nk2)) return { cards: [], pass: true };
    return null;
  }
  function cardsToCounts(cards) { var m = {}; for (var c of cards) m[c.r] = (m[c.r] || 0) + 1; return m; }
  function applyCounts(m, cards) { for (var c of cards) { m[c.r]--; if (!m[c.r]) delete m[c.r]; } }
  function totalM(m) { var t = 0; for (var k in m) t += m[k]; return t; }
  function cloneM(m) { var o = {}; for (var k in m) o[k] = m[k]; return o; }
  function countsToCardList(m) { var out = []; for (var k in m) for (var i = 0; i < m[k]; i++) out.push({ s: "S", r: +k }); return out; }
  function movesForM(m, trick) {
    var cards = countsToCardList(m);
    return trick ? R.responses(cards, trick) : R.allPlays(cards);
  }
  function pzSolve(hands, turn, trick) {
    var memo = new Map(), nodes = 0, CAP = 300000;
    function rec(hands, turn, trick) {
      nodes++;
      if (nodes > CAP) throw new Error("cap");
      if (totalM(hands[0]) === 0) return true;
      if (totalM(hands[1]) === 0 || totalM(hands[2]) === 0) return false;
      var me = turn === 0;
      var key = JSON.stringify([hands[0], hands[1], hands[2], me ? "P" : "A", trick ? [trick.type, trick.rank, trick.len, trick.seat, trick.passes] : null]);
      if (memo.has(key)) return memo.get(key);
      var m = hands[turn];
      var moves = movesForM(m, trick);
      var result;
      if (me) {
        result = false;
        var opts = [];
        for (var mv of moves) opts.push({ mv: mv, pass: false });
        if (trick) opts.push({ mv: null, pass: true });
        for (var opt of opts) {
          var won = false;
          if (opt.pass) {
            var passes = (trick.passes || 0) + 1;
            var nt0, nk0;
            if (passes >= 2) { nk0 = null; nt0 = trick.seat; }
            else { nk0 = { type: trick.type, rank: trick.rank, len: trick.len, seat: trick.seat, passes: passes }; nt0 = (turn + 1) % 3; }
            won = rec(hands, nt0, nk0);
          } else {
            applyCounts(m, opt.mv.cards);
            if (totalM(m) === 0) won = true;
            else won = rec(hands, (turn + 1) % 3, { type: opt.mv.play.type, rank: opt.mv.play.rank, len: opt.mv.play.len, seat: turn, passes: 0 });
            for (var c2 of opt.mv.cards) m[c2.r] = (m[c2.r] || 0) + 1; // undo
          }
          if (won) { result = true; break; }
        }
      } else {
        result = true;
        var opts2 = [];
        if (trick) { for (var mv2 of moves) opts2.push({ mv: mv2, pass: false }); opts2.push({ mv: null, pass: true }); }
        else { for (var mv3 of moves) opts2.push({ mv: mv3, pass: false }); }
        if (!opts2.length) result = false;
        for (var opt2 of opts2) {
          var h2 = [cloneM(hands[0]), cloneM(hands[1]), cloneM(hands[2])];
          var nt2, nk2;
          if (opt2.pass) {
            nt2 = (turn + 1) % 3;
            var passes2 = (trick.passes || 0) + 1;
            if (passes2 >= 2) { nk2 = null; nt2 = trick.seat; }
            else nk2 = { type: trick.type, rank: trick.rank, len: trick.len, seat: trick.seat, passes: passes2 };
          } else {
            applyCounts(h2[turn], opt2.mv.cards);
            if (totalM(h2[turn]) === 0) { result = false; break; }
            nt2 = (turn + 1) % 3;
            nk2 = { type: opt2.mv.play.type, rank: opt2.mv.play.rank, len: opt2.mv.play.len, seat: turn, passes: 0 };
          }
          if (!rec(h2, nt2, nk2)) { result = false; break; }
        }
      }
      memo.set(key, result);
      return result;
    }
    return rec(hands, turn, trick);
  }

  /* ---------- 暂停 ---------- */
  function togglePause() {
    var inGame = (screen === "classic" && C) || (screen === "puzzle" && P);
    if (!inGame || paused) return;
    var resultVisible = !$("result-modal").classList.contains("hidden");
    if (resultVisible) return;
    paused = true;
    clearTimeout(aiTimer);
    SFX.play("pause");
    SFX.pauseBGM();
    $("pause-modal").classList.remove("hidden");
  }
  function resumeGame() {
    if (!paused) return;
    paused = false;
    $("pause-modal").classList.add("hidden");
    SFX.play("click");
    SFX.resumeBGM();
    if (screen === "classic") { if (C && C.phase === "bid") scheduleBidAI(); else scheduleAI(); }
    else if (screen === "puzzle") schedulePzAI();
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) togglePause();
  });

  /* ---------- 时长体系 ---------- */
  function applyTimeLock() {
    locked = true;
    clearTimeout(aiTimer);
    $("time-lock").classList.remove("hidden");
  }
  window.addEventListener("daobox:timeexceeded", applyTimeLock);

  /* ---------- 事件绑定 / 启动 ---------- */
  function updateSoundBtn() {
    var m = SFX.getMode();
    $("sound-btn").textContent = m === 2 ? "🔊" : (m === 1 ? "🎵" : "🔇");
    $("sound-btn").title = m === 2 ? "声音：全开（点一下→仅音效）" : (m === 1 ? "声音：仅音效（点一下→静音）" : "声音：静音（点一下→全开）");
  }
  function boot() {
    $("app-version").textContent = APP_VERSION;
    SFX.init();
    updateSoundBtn();
    setTimeout(function () {
      if (SFX.getMode() === 2 && screen === "menu") flashMsg("🎵 音乐已就绪 · 点击屏幕任意处开始播放");
    }, 1500);
    $("sound-btn").addEventListener("click", function () { SFX.toggle(); updateSoundBtn(); SFX.play("click"); });
    $("refresh-btn").addEventListener("click", function () {
      if ("caches" in window) {
        caches.keys().then(function (keys) {
          return Promise.all(keys.map(function (k) { return caches.delete(k); }));
        }).finally(function () { location.reload(); });
      } else location.reload();
    });
    $("btn-mode-classic").addEventListener("click", function () {
      // 有进行中的对局则恢复，否则新开
      var restored = null;
      try { restored = JSON.parse(localStorage.getItem(SAVE_CLASSIC)); } catch (e) {}
      if (restored && restored.v === 1 && restored.phase === "play" && restored.hands[0].length > 0) {
        C = restored;
        show("classic");
        log("已恢复上局进度。");
        renderClassic();
        scheduleAI();
      } else {
        show("classic");
        freshClassic();
      }
    });
    $("btn-mode-puzzle").addEventListener("click", function () {
      show("puzzle");
      startPuzzle(Math.min(loadUnlock(), window.DDPuzzles.length));
    });
    $("btn-exit-classic").addEventListener("click", function () { C = null; try { localStorage.removeItem(SAVE_CLASSIC); } catch (e) {} show("menu"); });
    $("btn-exit-puzzle").addEventListener("click", function () { P = null; show("menu"); });
    $("btn-pz-prev").addEventListener("click", function () { if (P && P.lv > 1) startPuzzle(P.lv - 1); });
    $("btn-pz-next").addEventListener("click", function () { if (P && P.lv < loadUnlock()) startPuzzle(P.lv + 1); });

    $("bid-controls").querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!C || C.phase !== "bid" || C.bidTurn !== 0 || locked || paused) return;
        $("bid-controls").classList.add("hidden");
        applyBid(0, parseInt(b.dataset.bid, 10));
      });
    });
    $("btn-play").addEventListener("click", function () { if (C && C.turn === 0) humanPlay("classic"); });
    $("btn-pass").addEventListener("click", function () { if (C && C.turn === 0) humanPass("classic"); });
    $("btn-hint").addEventListener("click", function () { if (C && C.turn === 0) humanHint("classic"); });
    $("pz-play").addEventListener("click", function () { if (P && P.turn === 0) humanPlay("puzzle"); });
    $("pz-pass").addEventListener("click", function () { if (P && P.turn === 0) humanPass("puzzle"); });
    $("pz-hint").addEventListener("click", pzHint);
    ["my-hand", "pz-my-hand"].forEach(function (id) {
      var box = $(id);
      box.addEventListener("pointerdown", handPointerDown);
      box.addEventListener("pointermove", handPointerMove);
      box.addEventListener("pointerup", handPointerUp);
      box.addEventListener("pointercancel", handPointerUp);
    });
    $("btn-pause").addEventListener("click", togglePause);
    $("pz-pause").addEventListener("click", togglePause);
    $("btn-resume").addEventListener("click", resumeGame);

    $("btn-result-ok").addEventListener("click", function () {
      $("result-modal").classList.add("hidden");
      var action = $("btn-result-ok").dataset.action;
      if (action === "classic") { C = null; try { localStorage.removeItem(SAVE_CLASSIC); } catch (e) {} show("classic"); freshClassic(); }
      else if (action === "puzzle-next") { var nl = Math.min(P.lv + 1, window.DDPuzzles.length); P = null; show("puzzle"); startPuzzle(nl); }
      else if (action === "puzzle-retry") { var lv = P.lv; P = null; startPuzzle(lv); }
    });
    $("lock-close").addEventListener("click", function () { $("time-lock").classList.add("hidden"); });

    show("menu");
    setTimeout(function () {
      try { if (window.DaoBox && window.DaoBox.timeExceeded) applyTimeLock(); } catch (e) {}
    }, 1200);
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
