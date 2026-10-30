// 斗地主残局求解器 v2（干净重写）：玩家(seat 0)必胜判定
// hands: [counts0, counts1, counts2]，counts = {rank: n}
// trick: {type, rank, len, seat, passes} | null（seat=当前赢墩者 leader）
// 玩家最优走法能赢 → true；对手最优防守下必败 → false
import R from "../public/rules.js";

function total(m) { var t = 0; for (var k in m) t += m[k]; return t; }
function clone(m) { var o = {}; for (var k in m) o[k] = m[k]; return o; }
function countsToCards(m) {
  var out = [];
  for (var k in m) for (var i = 0; i < m[k]; i++) out.push({ s: "S", r: +k });
  return out;
}
function applyMove(m, mv) { for (var c of mv.cards) { m[c.r]--; if (!m[c.r]) delete m[c.r]; } }
function undoMove(m, mv) { for (var c of mv.cards) m[c.r] = (m[c.r] || 0) + 1; }

function movesFor(m, trick) {
  var cards = countsToCards(m);
  return trick ? R.responses(cards, trick) : R.allPlays(cards);
}

export function solve(hands0, trick0, player = 0, cap = 400000) {
  var nodes = 0;
  var memo = new Map();

  function rec(hands, turn, trick) {
    nodes++;
    if (nodes > cap) throw new Error("cap");
    // 终局：谁空手
    if (total(hands[player]) === 0) return true;
    if (total(hands[1]) === 0 || total(hands[2]) === 0) return false;

    var me = turn === player;
    var key = JSON.stringify([hands[0], hands[1], hands[2], me ? "P" : "A", trick ? [trick.type, trick.rank, trick.len, trick.seat, trick.passes] : null]);
    if (memo.has(key)) return memo.get(key);

    var m = hands[turn];
    var moves = movesFor(m, trick);
    var result;

    if (me) {
      result = false;
      var myOpts = [];
      for (var mv of moves) myOpts.push({ mv, pass: false });
      if (trick) myOpts.push({ mv: null, pass: true });
      for (var opt of myOpts) {
        var won = false;
        if (opt.pass) {
          var passes = (trick.passes || 0) + 1;
          var nt0, nk0;
          if (passes >= 2) { nk0 = null; nt0 = trick.seat; }
          else { nk0 = { type: trick.type, rank: trick.rank, len: trick.len, seat: trick.seat, passes }; nt0 = (turn + 1) % 3; }
          won = rec(hands, nt0, nk0);
        } else {
          applyMove(m, opt.mv);
          if (total(m) === 0) {
            won = true;
          } else {
            var nt = (turn + 1) % 3;
            var nk = { type: opt.mv.play.type, rank: opt.mv.play.rank, len: opt.mv.play.len, seat: turn, passes: 0 };
            won = rec(hands, nt, nk);
          }
          undoMove(m, opt.mv);
        }
        if (won) { result = true; break; }
      }
    } else {
      // 对手：trick 存在时可跟可 pass；先出必须出
      result = true;
      var options = [];
      if (trick) {
        for (var mv2 of moves) options.push({ mv: mv2, pass: false });
        options.push({ mv: null, pass: true });
      } else {
        for (var mv3 of moves) options.push({ mv: mv3, pass: false });
      }
      if (!options.length) result = false;
      for (var opt of options) {
        var h2 = [clone(hands[0]), clone(hands[1]), clone(hands[2])];
        var nt2, nk2;
        if (opt.pass) {
          nt2 = (turn + 1) % 3;
          var passes = (trick.passes || 0) + 1;
          if (passes >= 2) { nk2 = null; nt2 = trick.seat; } // 两家都过，赢墩者重新领出
          else nk2 = { type: trick.type, rank: trick.rank, len: trick.len, seat: trick.seat, passes };
        } else {
          applyMove(h2[turn], opt.mv);
          if (total(h2[turn]) === 0) { result = false; break; } // 对手打完，玩家输
          nt2 = (turn + 1) % 3;
          nk2 = { type: opt.mv.play.type, rank: opt.mv.play.rank, len: opt.mv.play.len, seat: turn, passes: 0 };
        }
        if (!rec(h2, nt2, nk2)) { result = false; break; }
      }
    }
    memo.set(key, result);
    return result;
  }

  var win = rec(hands0.map(clone), player, trick0);
  return { win, nodes };
}

export { countsToCards };
