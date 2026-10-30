/* 斗地主规则引擎 v1 · doudizhu-pwa
 * 牌表示：{s:'S|H|D|C|J', r:3..15}，r: 3-10=3..10, J=11, Q=12, K=13, A=14, 2=15；joker s='J' r=16(小)/17(大)
 * 牌型 play = {type, rank, len}；type: single/pair/trio/trio1/trio2/straight/pairseq/plane/plane1/plane2/bomb/rocket
 */
(function (global) {
  "use strict";

  function makeDeck() {
    var deck = [], suits = ["S", "H", "D", "C"];
    for (var i = 0; i < suits.length; i++)
      for (var r = 3; r <= 15; r++) deck.push({ s: suits[i], r: r });
    deck.push({ s: "J", r: 16 });
    deck.push({ s: "J", r: 17 });
    return deck;
  }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function countsOf(cards) {
    var m = {};
    for (var i = 0; i < cards.length; i++) m[cards[i].r] = (m[cards[i].r] || 0) + 1;
    return m;
  }

  /* 识别牌型。返回 play 或 null */
  function classify(cards) {
    var n = cards.length;
    if (n === 0) return null;
    var m = countsOf(cards);
    var ranks = Object.keys(m).map(Number).sort(function (a, b) { return a - b; });
    var four = ranks.filter(function (r) { return m[r] === 4; });
    var trio = ranks.filter(function (r) { return m[r] === 3; });
    var pair = ranks.filter(function (r) { return m[r] === 2; });
    var single = ranks.filter(function (r) { return m[r] === 1; });

    if (n === 2 && m[16] === 1 && m[17] === 1) return { type: "rocket", rank: 100, len: 2 };
    if (n === 1) return { type: "single", rank: ranks[0], len: 1 };
    if (n === 2 && pair.length === 1) return { type: "pair", rank: pair[0], len: 2 };
    if (n === 3 && trio.length === 1) return { type: "trio", rank: trio[0], len: 3 };
    if (n === 4 && four.length === 1) return { type: "bomb", rank: four[0], len: 4 };
    if (n === 4 && trio.length === 1 && single.length === 1) return { type: "trio1", rank: trio[0], len: 4 };
    if (n === 5 && trio.length === 1 && pair.length === 1) return { type: "trio2", rank: trio[0], len: 5 };
    // 顺子 ≥5 连张，3..A（不含 2、王）
    if (n >= 5 && ranks.length === n && ranks[n - 1] <= 14 && ranks[n - 1] - ranks[0] === n - 1)
      return { type: "straight", rank: ranks[0], len: n };
    // 连对 ≥3 对
    if (n >= 6 && n % 2 === 0 && pair.length === n / 2 && pair[pair.length - 1] <= 14 && pair[pair.length - 1] - pair[0] === pair.length - 1)
      return { type: "pairseq", rank: pair[0], len: n };
    // 飞机（无翼/带单/带对）：连续三张 ≥2 组
    if (trio.length >= 2) {
      var seq = consecutiveRun(trio);   // 最长连续段（≤14）
      if (seq.length >= 2 && n === seq.length * 3)
        return { type: "plane", rank: seq[0], len: n };
      if (seq.length >= 2 && n === seq.length * 4 && single.length === seq.length && four.length === 0)
        return { type: "plane1", rank: seq[0], len: n };
      if (seq.length >= 2 && n === seq.length * 5 && pair.length === seq.length && single.length === 0)
        return { type: "plane2", rank: seq[0], len: n };
    }
    return null;
  }

  /* 从三张 rank 列表里找最长连续段（rank ≤14），取包含最小的那段（近似：连续即可，无需最长） */
  function consecutiveRun(sortedTrioRanks) {
    var best = [], cur = [sortedTrioRanks[0]];
    for (var i = 1; i < sortedTrioRanks.length; i++) {
      if (sortedTrioRanks[i] === sortedTrioRanks[i - 1] + 1 && sortedTrioRanks[i] <= 14) cur.push(sortedTrioRanks[i]);
      else { if (cur.length > best.length) best = cur; cur = [sortedTrioRanks[i]]; }
    }
    if (cur.length > best.length) best = cur;
    return best;
  }

  function isBomb(play) { return play.type === "bomb" || play.type === "rocket"; }

  /* a 能否压过 b */
  function beats(a, b) {
    if (!b) return true;
    if (b.play) b = b.play;   // 兼容 trick 包装 {play,...}
    if (a && a.play) a = a.play;
    if (a.type === "rocket") return true;
    if (b.type === "rocket") return false;
    if (a.type === "bomb") return b.type !== "bomb" || a.rank > b.rank;
    if (b.type === "bomb") return false;
    if (a.type !== b.type || a.len !== b.len) return false;
    return a.rank > b.rank;
  }

  function consecSeqs(counts, size, minLen, maxLen) {
    var ranks = Object.keys(counts).map(Number).filter(function (r) { return counts[r] >= size && r >= 3 && r <= 14; }).sort(function (a, b) { return a - b; });
    var out = [];
    for (var i = 0; i < ranks.length; i++) {
      var j = i;
      while (j + 1 < ranks.length && ranks[j + 1] === ranks[j] + 1) j++;
      for (var L = minLen; L <= j - i + 1 && (maxLen ? L <= maxLen : true); L++)
        out.push(ranks.slice(i, i + L));
      i = j;
    }
    return out;
  }

  function countsToCards(cards, ranks, size) {
    var used = {}, out = [];
    for (var i = 0; i < ranks.length; i++) {
      var r = ranks[i], k = 0;
      for (var j = 0; j < cards.length && k < size; j++) {
        if (cards[j].r === r && !used[j]) { used[j] = 1; out.push(cards[j]); k++; }
      }
    }
    return out;
  }

  /* 生成能压过 trick 的所有出法 */
  function responses(hand, trick) {
    if (!trick) return [];
    var play = trick.play || trick;
    var t = play.type, tr = play.rank, tl = play.len;
    var counts = countsOf(hand);
    var out = [];

    function assemble(mainRanks, mainSize, wingSingles, wingPairs) {
      var used = new Array(hand.length).fill(false);
      var cards = [];
      for (var i = 0; i < mainRanks.length; i++) {
        var need = mainSize, r = mainRanks[i];
        for (var j = 0; j < hand.length && need > 0; j++) {
          if (!used[j] && hand[j].r === r) { used[j] = true; cards.push(hand[j]); need--; }
        }
        if (need > 0) return null;
      }
      var rest = {};
      for (var k2 = 0; k2 < hand.length; k2++) if (!used[k2]) rest[hand[k2].r] = (rest[hand[k2].r] || 0) + 1;
      function takeWings(size, count) {
        var ranks = Object.keys(rest).map(Number).sort(function (a, b) { return a - b; });
        var taken = [];
        for (var i3 = 0; i3 < ranks.length && taken.length < count; i3++) {
          var r3 = ranks[i3];
          if (rest[r3] < size) continue;
          if (size === 1 && rest[r3] === 1 && rest[16] && rest[17]) continue; // 不拆火箭当翼
          taken.push(r3);
        }
        if (taken.length < count) return false;
        for (var i4 = 0; i4 < taken.length; i4++) {
          var need4 = size;
          for (var j4 = 0; j4 < hand.length && need4 > 0; j4++) {
            if (!used[j4] && hand[j4].r === taken[i4]) { used[j4] = true; cards.push(hand[j4]); rest[taken[i4]] -= size; need4--; }
          }
        }
        return true;
      }
      if (wingSingles && !takeWings(1, wingSingles)) return null;
      if (wingPairs && !takeWings(2, wingPairs)) return null;
      return cards;
    }

    function tryPush(cards) {
      var p = classify(cards);
      if (p && beats(p, play)) out.push({ cards: cards, play: p });
    }

    function runs(size, len, minRank) {
      var res = [];
      for (var s0 = Math.max(3, minRank); s0 + len - 1 <= 14; s0++) {
        var ok = true;
        for (var r0 = s0; r0 < s0 + len; r0++) if ((counts[r0] || 0) < size) { ok = false; break; }
        if (ok) {
          var arr = [];
          for (var r1 = s0; r1 < s0 + len; r1++) arr.push(r1);
          res.push(arr);
        }
      }
      return res;
    }

    var r, i;
    if (t === "single") {
      for (r = tr + 1; r <= 17; r++) if (counts[r]) { var c1 = assemble([r], 1, 0, 0); if (c1) tryPush(c1); }
    } else if (t === "pair") {
      for (r = tr + 1; r <= 15; r++) if ((counts[r] || 0) >= 2) { var c2 = assemble([r], 2, 0, 0); if (c2) tryPush(c2); }
    } else if (t === "trio") {
      for (r = tr + 1; r <= 15; r++) if ((counts[r] || 0) >= 3) { var c3 = assemble([r], 3, 0, 0); if (c3) tryPush(c3); }
    } else if (t === "trio1") {
      for (r = tr + 1; r <= 15; r++) if ((counts[r] || 0) >= 3) { var c4 = assemble([r], 3, 1, 0); if (c4) tryPush(c4); }
    } else if (t === "trio2") {
      for (r = tr + 1; r <= 15; r++) if ((counts[r] || 0) >= 3) { var c5 = assemble([r], 3, 0, 1); if (c5) tryPush(c5); }
    } else if (t === "straight") {
      runs(1, tl, tr + 1).forEach(function (seq) { var c = assemble(seq, 1, 0, 0); if (c) tryPush(c); });
    } else if (t === "pairseq") {
      runs(2, tl / 2, tr + 1).forEach(function (seq) { var c = assemble(seq, 2, 0, 0); if (c) tryPush(c); });
    } else if (t === "plane") {
      runs(3, tl / 3, tr + 1).forEach(function (seq) { var c = assemble(seq, 3, 0, 0); if (c) tryPush(c); });
    } else if (t === "plane1") {
      runs(3, tl / 4, tr + 1).forEach(function (seq) { var c = assemble(seq, 3, tl / 4, 0); if (c) tryPush(c); });
    } else if (t === "plane2") {
      runs(3, tl / 5, tr + 1).forEach(function (seq) { var c = assemble(seq, 3, 0, tl / 5); if (c) tryPush(c); });
    }
    // 炸弹兜底
    if (t !== "rocket") {
      for (r = 3; r <= 15; r++) {
        if ((counts[r] || 0) === 4 && (t !== "bomb" || r > tr)) { var cb = assemble([r], 4, 0, 0); if (cb) tryPush(cb); }
      }
      if (counts[16] && counts[17]) { var cr = assemble([16, 17], 1, 0, 0); if (cr) tryPush(cr); }
    }
    return out;
  }

  /* 先出：所有合法出法（不含炸弹，供 AI 主导出用；单带出的组合另算） */
  function allLeads(hand) {
    var counts = countsOf(hand);
    var out = [];
    function add(cards) { var p = classify(cards); if (p && p.type !== "bomb" && p.type !== "rocket") out.push({ cards: cards, play: p }); }
    var singles = Object.keys(counts).map(Number).sort(function (a, b) { return a - b; });
    singles.forEach(function (r) { if (counts[r] >= 1) { var c = countsToCards(hand, [r], 1); add(c); } });
    singles.forEach(function (r) { if (counts[r] >= 2) { var c = countsToCards(hand, [r], 2); add(c); } });
    singles.forEach(function (r) { if (counts[r] >= 3) add(countsToCards(hand, [r], 3)); });
    // 三带一/带二
    singles.forEach(function (r) {
      if (counts[r] < 3) return;
      var main = countsToCards(hand, [r], 3);
      var rest = {};
      for (var k in counts) rest[k] = counts[k];
      rest[r] -= 3; if (!rest[r]) delete rest[r];
      var others = Object.keys(rest).map(Number).sort(function (a, b) { return a - b; });
      if (others.length) {
        // 带最小单张（不拆火箭）
        var w = others.find(function (o) { return !(rest[o] === 1 && rest[16] && rest[17]); });
        if (w != null) { var c1 = main.concat(countsToCards(hand, [w], 1)); add(c1); }
      }
      var pairs = others.filter(function (o) { return rest[o] >= 2; });
      if (pairs.length) { var c2 = main.concat(countsToCards(hand, [pairs[0]], 2)); add(c2); }
    });
    // 顺子 / 连对 / 飞机
    consecSeqs(counts, 1, 5).forEach(function (seq) { add(countsToCards(hand, seq, 1)); });
    consecSeqs(counts, 2, 3).forEach(function (seq) { add(countsToCards(hand, seq, 2)); });
    consecSeqs(counts, 3, 2).forEach(function (seq) { add(countsToCards(hand, seq, 3)); });
    return out;
  }

  /* 全部可出（含炸弹）——给提示/求解器用 */
  function allPlays(hand) {
    var counts = countsOf(hand);
    var out = allLeads(hand);
    Object.keys(counts).map(Number).forEach(function (r) {
      if (counts[r] === 4) { var c = countsToCards(hand, [r], 4); var p = classify(c); if (p) out.push({ cards: c, play: p }); }
    });
    if (counts[16] && counts[17]) { var c = countsToCards(hand, [16, 17], 1); out.push({ cards: c, play: classify(c) }); }
    return out;
  }

  var api = { makeDeck: makeDeck, shuffle: shuffle, countsOf: countsOf, classify: classify, beats: beats, isBomb: isBomb, responses: responses, allLeads: allLeads, allPlays: allPlays };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DDRules = api;
})(typeof window !== "undefined" ? window : globalThis);
