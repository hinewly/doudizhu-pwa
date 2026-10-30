/* 斗地主启发式 AI v1 · doudizhu-pwa
 * decide(hand, trick, ctx) → {cards, play} 或 null
 * ctx: {mySeat, landlordSeat, landlordLeft, oppMin, springRisk}
 */
(function (global) {
  "use strict";
  var R = (typeof module !== "undefined" && module.exports) ? require("./rules.js") : global.DDRules;

  function isLandlord(seat, ctx) { return seat === ctx.landlordSeat; }
  function isPartner(seat, ctx) { return !isLandlord(seat, ctx) && !isLandlord(ctx.mySeat, ctx); }

  /* 手牌整体估值：王/2/炸弹越多越强 */
  function handPower(hand) {
    var counts = R.countsOf(hand);
    var p = 0;
    if (counts[17]) p += 6;
    if (counts[16]) p += 3;
    if (counts[15]) p += 2 * counts[15];
    for (var r in counts) if (counts[r] === 4) p += 6;
    if (counts[16] && counts[17]) p += 3;
    return p;
  }

  /* 叫分：0 不叫 / 1 / 2 / 3 */
  function bid(hand) {
    var p = handPower(hand);
    if (p >= 14) return 3;
    if (p >= 9) return 2;
    if (p >= 5) return 1;
    return 0;
  }

  /* 出牌代价：越小越优先 */
  function costOf(mv, hand, ctx) {
    var p = mv.play;
    if (p.type === "rocket") return 1000;
    if (p.type === "bomb") return 500 + p.rank;
    var c = p.rank * 10 + p.len;
    // 拆好牌型惩罚：出的单张若手上有对/三（拆牌）
    if (p.type === "single") {
      var counts = R.countsOf(hand);
      var r = p.rank;
      if (counts[r] >= 2) c += 15;      // 拆对
      if (counts[r] === 3) c += 25;     // 拆三
    }
    if (p.type === "pair") {
      var counts2 = R.countsOf(hand);
      if (counts2[p.rank] === 3) c += 20; // 拆三出对
    }
    return c;
  }

  function decide(hand, trick, ctx) {
    if (trick) {
      var play = trick.play || trick;
      var leader = trick.seat;
      var resp = R.responses(hand, trick);
      if (!resp.length) return null;
      // 能一手出完 → 直接出
      for (var i = 0; i < resp.length; i++)
        if (resp[i].cards.length === hand.length) return resp[i];
      // 农民不压农民队友（除非能出完，上面已判）
      if (isPartner(leader, ctx)) return null;
      // 炸弹慎用：仅当地主（或对手）快走完时才放
      var nonBomb = resp.filter(function (mv) { return !R.isBomb(mv.play); });
      if (nonBomb.length) {
        nonBomb.sort(function (a, b) { return costOf(a, hand, ctx) - costOf(b, hand, ctx); });
        return nonBomb[0];
      }
      // 只剩炸弹
      var targetLeft = isLandlord(leader, ctx) ? ctx.landlordLeft : Math.min(ctx.landlordLeft, ctx.peasantMinLeft);
      var lastEnemy = isLandlord(ctx.mySeat, ctx) ? ctx.peasantMinLeft : ctx.landlordLeft;
      if (lastEnemy != null && lastEnemy <= 6) {
        resp.sort(function (a, b) { return costOf(a, hand, ctx) - costOf(b, hand, ctx); });
        return resp[0];
      }
      return null;
    }
    // 先出
    var leads = R.allLeads(hand);
    if (!leads.length) {
      var any = R.allPlays(hand);
      return any.length ? any[0] : null;
    }
    // 一手走完 → 出
    for (var j = 0; j < leads.length; j++)
      if (leads[j].cards.length === hand.length) return leads[j];
    // 对手只剩 1-2 张：避免出单张（若对手 1 张则单张全pass？至少出对/大单）
    var oppOne = ctx.oppMin === 1;
    // 领出策略：拆解手牌取"最小组件"先出
    leads.sort(function (a, b) {
      var ca = costOf(a, hand, ctx), cb = costOf(b, hand, ctx);
      // 带翼的优先于裸三张（多走牌）
      if (a.play.type === "trio1" && b.play.type === "trio") return -1;
      if (a.play.type === "trio" && b.play.type === "trio1") return 1;
      // 对手剩1张时不领小单
      if (oppOne) {
        var sa = a.play.type === "single" ? 100 : 0;
        var sb = b.play.type === "single" ? 100 : 0;
        if (sa !== sb) return sa - sb;
      }
      return ca - cb;
    });
    return leads[0];
  }

  var api = { decide: decide, bid: bid, handPower: handPower, costOf: costOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  global.DDAI = api;
})(typeof window !== "undefined" ? window : globalThis);
