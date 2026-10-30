// 1v1 残局题库生成器（参考 naturalleo/doudizhu_endgame 的求解思路）
// 产出：public/puzzles.js（window.DDPuzzles，1v1 格式 {player, ai}）
// 筛选条件：玩家必胜 && 非一手秒解 && 最短胜利 ≥5 手（玩家≥3手） && 根节点求解 < 250k（保证线上提示可算）
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = require('../public/rules.js');
global.DDRules = R;
const D = require('../public/duel.js');

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261030);

const RANKS = [];
for (let r = 3; r <= 15; r++) for (let s = 0; s < 4; s++) RANKS.push(r);
RANKS.push(16, 17);   // 双王
const ENC = { 10: "T", 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "x", 17: "X" };
const enc = r => (ENC[r] || String(r));
const cnt = arr => { const m = {}; arr.forEach(r => (m[r] = (m[r] || 0) + 1)); return m; };
const key = m => Object.keys(m).map(Number).sort((a, b) => a - b).map(r => r + ":" + m[r]).join(",");

function shuffledDeck() {
  const d = RANKS.slice();
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// 最短胜利手数（玩家视角，玩家最优 + AI 随机合法防守的近似下界）
function minPlayerPlies(player, ai, cap = 1500000) {
  let plies = 0, trick = null;
  const me = cnt(player), opp = cnt(ai);
  for (let guard = 0; guard < 60; guard++) {
    const bm = D.bestMove(me, opp, trick, cap);
    if (!bm) return Infinity;   // 走偏（不应发生，bestMove 即必胜着）
    if (bm.pass) { trick = null; continue; }
    D.applyCounts2 && D.applyCounts2();
    for (const c of bm.cards) { me[c.r]--; if (!me[c.r]) delete me[c.r]; }
    plies++;
    if (Object.keys(me).length === 0) return plies;
    trick = bm.play;
    // AI 防守：有必胜就打，否则出最小可压牌，压不过就过
    const aiCards = D.countsToCards(opp);
    const resps = trick ? R.responses(aiCards, trick) : R.allPlays(aiCards);
    if (resps.length) {
      let pick = null;
      for (const mv of resps) {
        const m2 = cnt(Object.entries(opp).flatMap(([r, n]) => Array(+n).fill(+r)));
        for (const c of mv.cards) { m2[c.r]--; if (!m2[c.r]) delete m2[c.r]; }
        if (D.solve(cnt(Object.entries(me).flatMap(([r, n]) => Array(+n).fill(+r))), m2, null, cap) === 1) { pick = mv; break; }
      }
      if (!pick) pick = resps.reduce((a, b) => (b.cards.length < a.cards.length ? b : a));
      for (const c of pick.cards) { opp[c.r]--; if (!opp[c.r]) delete opp[c.r]; }
      if (Object.keys(opp).length === 0) return Infinity;  // AI 先出完，题废
      trick = pick.play;
    } else trick = null;
  }
  return Infinity;
}

const TIERS = [
  { levels: [1, 6],   p: [6, 8],   a: [8, 10] },
  { levels: [7, 12],  p: [9, 11],  a: [11, 13] },
  { levels: [13, 18], p: [12, 14], a: [14, 16] },
  { levels: [19, 24], p: [15, 17], a: [17, 19] }
];
const seen = new Set();
const puzzles = [];

for (const tier of TIERS) {
  let made = 0, tries = 0;
  while (made < tier.levels[1] - tier.levels[0] + 1 && tries < 60000) {
    tries++;
    const deck = shuffledDeck();
    const np = tier.p[0] + Math.floor(rnd() * (tier.p[1] - tier.p[0] + 1));
    const na = tier.a[0] + Math.floor(rnd() * (tier.a[1] - tier.a[0] + 1));
    const player = deck.slice(0, np), ai = deck.slice(np, np + na);
    const pk = key(cnt(player)) + "#" + key(cnt(ai));
    if (seen.has(pk)) continue;
    // 1. 玩家必胜
    let win;
    try { win = D.solve(cnt(player), cnt(ai), null, 2000000); } catch (e) { continue; }
    if (win !== 1) continue;
    // 2. 非秒解：没有一手出完的着法
    const cards = D.countsToCards(cnt(player));
    if (R.allPlays(cards).some(mv => mv.cards.length === np)) continue;
    // 3. 最短胜利 ≥5 手（玩家 ≥3 手），且根节点求解量可控
    const plies = minPlayerPlies(player, ai);
    if (plies < 5 || plies === Infinity) continue;
    if (D.lastNodes > 250000) continue;
    seen.add(pk);
    puzzles.push({
      level: tier.levels[0] + made,
      player: player.map(enc).join(" "),
      ai: ai.map(enc).join(" ")
    });
    made++;
    console.log(`L${tier.levels[0] + made - 1}  P${np} A${na}  plies=${plies} nodes=${D.lastNodes}`);
  }
  if (made < tier.levels[1] - tier.levels[0] + 1) {
    console.error(`⚠️ 档位 ${tier.levels[0]}-${tier.levels[1]} 只产出 ${made} 关`);
  }
}

const body = `/* 斗地主 1v1 残局题库（生成器验证：玩家按最优走法必胜，非秒解，难度递进）
 * 生成：tools/gen-duel-puzzles.mjs（2026-10-30，方案 A：1v1 大残局，参考 naturalleo/doudizhu_endgame） */
window.DDPuzzles = [
${puzzles.map(p => `  { "level": ${p.level}, "player": "${p.player}", "ai": "${p.ai}" }`).join(",\n")}
];
`;
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'puzzles.js'), body);
console.log(`\n✅ 共 ${puzzles.length} 关写入 public/puzzles.js`);
