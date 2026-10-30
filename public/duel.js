/* 斗地主 1v1 残局求解器 v1 · doudizhu-pwa
 * 参考 naturalleo/doudizhu_endgame（Negamax + 置换表 + 首个必胜孩子即剪枝）
 * 点数空间：3..15（3..A,2），16=小王，17=大王；斗地主无同花顺，花色不影响求解
 * API（依赖 DDRules）：
 *   DoudizhuDuel.solve(me, opp, trick, cap) -> +1 轮到方必胜 / -1 必败
 *   DoudizhuDuel.bestMove(me, opp, trick, cap) -> {cards, play} | {pass:true} | null
 */
(function (global) {
  "use strict";

  function R() { return global.DDRules; }

  function countsToCards(m) {
    var out = [];
    for (var k in m) {
      var r = +k;
      for (var i = 0; i < m[k]; i++) out.push(r >= 16 ? { s: "J", r: r } : { s: "S", r: r });
    }
    return out;
  }
  function total(m) { var t = 0; for (var k in m) t += m[k]; return t; }
  // 点数压缩打包：15 个点数槽（3..15,16,17），每槽 3bit（0..4 张）→ 45bit 数字
  var RANK_IDS = [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];
  function packCounts(m) {
    var v = 0;
    for (var i = 0; i < 15; i++) v = v * 8 + (m[RANK_IDS[i]] || 0);
    return v;
  }
  function ckey(m) { return packCounts(m); }
  function applyCounts(m, cards) {
    for (var i = 0; i < cards.length; i++) { var r = cards[i].r; m[r]--; if (!m[r]) delete m[r]; }
  }
  function undoCounts(m, cards) {
    for (var i = 0; i < cards.length; i++) { var r = cards[i].r; m[r] = (m[r] || 0) + 1; }
  }

  var TCODE = { single: 1, pair: 2, trio: 3, trio1: 4, trio2: 5, straight: 6, pairseq: 7, plane: 8, plane1: 9, plane2: 10, bomb: 11, rocket: 12 };

  /* 1v1 状态：(mover, other, trick)。trick 非 null 时必为 other 所出（mover 压不过可过）。
   * 返回值相对 mover：+1 必胜 / -1 必败。 */
  var lastNodes = 0;
  function solve(me0, opp0, trick0, cap) {
    var nodes = 0;
    var CAP = cap || 500000;
    var memo = new Map();
    function rec(mover, other, trick) {
      nodes++;
      if (nodes > CAP) throw new Error("cap");
      if (total(mover) === 0) return 1;
      if (total(other) === 0) return -1;
      var key = ckey(mover) + "|" + ckey(other) + "|" + (trick ? TCODE[trick.type] * 100000 + trick.rank * 100 + trick.len : 0);
      var hit = memo.get(key);
      if (hit !== undefined) return hit;
      var cards = countsToCards(mover);
      var result = -1;
      if (trick) {
        // 跟牌：压 or 过
        var resps = R().responses(cards, trick);
        for (var i = 0; i < resps.length; i++) {
          var mv = resps[i];
          applyCounts(mover, mv.cards);
          var v;
          if (total(mover) === 0) v = 1;
          else v = -rec(other, mover, mv.play);
          undoCounts(mover, mv.cards);
          if (v > 0) { result = 1; break; }
        }
        if (result !== 1) {
          // 过：对方重新领出
          if (-rec(other, mover, null) > 0) result = 1;
        }
      } else {
        // 领出：必须出
        var leads = R().allPlays(cards);
        for (var j = 0; j < leads.length; j++) {
          var mv2 = leads[j];
          applyCounts(mover, mv2.cards);
          var v2;
          if (total(mover) === 0) v2 = 1;
          else v2 = -rec(other, mover, mv2.play);
          undoCounts(mover, mv2.cards);
          if (v2 > 0) { result = 1; break; }
        }
      }
      memo.set(key, result);
      return result;
    }
    var v = rec(me0, opp0, trick0);
    lastNodes = nodes;
    DoudizhuDuel.lastNodes = nodes;
    return v;
  }

  /* 当前方的必胜着法（含过牌选项）；没有返回 null */
  function bestMove(me0, opp0, trick0, cap) {
    var cards = countsToCards(me0);
    var moves = trick0 ? R().responses(cards, trick0) : R().allPlays(cards);
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i];
      var m2 = {}; for (var k in me0) m2[k] = me0[k];
      applyCounts(m2, mv.cards);
      if (total(m2) === 0) return mv;   // 直接出完
      if (solve(opp0, m2, mv.play, cap) === -1) return mv;
    }
    if (trick0) {
      var m3 = {}; for (var k2 in me0) m3[k2] = me0[k2];
      if (solve(opp0, m3, null, cap) === -1) return { pass: true };
    }
    return null;
  }

  global.DoudizhuDuel = { solve: solve, bestMove: bestMove, countsToCards: countsToCards, lastNodes: 0 };
  if (typeof module !== "undefined" && module.exports) module.exports = global.DoudizhuDuel;
})(typeof window !== "undefined" ? window : globalThis);
