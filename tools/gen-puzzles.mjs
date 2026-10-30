// 残局关卡生成器：随机发牌 → 求解器验证（玩家必胜 && 非一手秒解）→ 输出 public/puzzles.js
import DD from "../public/rules.js";
const { makeDeck, shuffle, allPlays } = DD;
import { solve } from "./solver.mjs";
import fs from "node:fs";

const RANK_CH = { 3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"T",11:"J",12:"Q",13:"K",14:"A",15:"2",16:"x",17:"X" };
function enc(counts) {
  var parts = [];
  for (var k in counts) for (var i = 0; i < counts[k]; i++) parts.push(RANK_CH[k]);
  return parts.join(" ");
}
function cardsToCounts(cards) {
  var m = {};
  for (var c of cards) m[c.r] = (m[c.r] || 0) + 1;
  return m;
}

// 难度档：[玩家张数, AI1, AI2]
const TIERS = [
  [5, 4, 4], [5, 4, 5], [6, 4, 5],
  [7, 5, 5], [7, 5, 6], [8, 5, 6],
  [9, 6, 7], [9, 7, 7], [10, 7, 8],
  [11, 8, 8], [12, 8, 9], [13, 9, 9],
];

const puzzles = [];
for (var lv = 0; lv < 12; lv++) {
  var [p, a1, a2] = TIERS[lv];
  var found = null, tries = 0;
  while (!found && tries < 400) {
    tries++;
    var deck = shuffle(makeDeck());
    var h0 = deck.slice(0, p), h1 = deck.slice(p, p + a1), h2 = deck.slice(p + a1, p + a1 + a2);
    var c = [cardsToCounts(h0), cardsToCounts(h1), cardsToCounts(h2)];
    // 拒收一手秒解
    var cards0 = [];
    for (var k in c[0]) for (var i = 0; i < c[0][k]; i++) cards0.push({ s: "S", r: +k });
    var instant = false;
    for (var mv of allPlays(cards0)) if (mv.cards.length === cards0.length) { instant = true; break; }
    if (instant) continue;
    try {
      var r = solve([JSON.parse(JSON.stringify(c[0])), JSON.parse(JSON.stringify(c[1])), JSON.parse(JSON.stringify(c[2]))], null, 0, 400000);
      if (r.win && r.nodes < 150000) found = c;  // 节点少 → 浏览器提示快
    } catch (e) { /* cap，重试 */ }
  }
  if (!found) { console.error("LEVEL " + (lv + 1) + " FAILED"); process.exit(1); }
  puzzles.push({ level: lv + 1, player: enc(found[0]), ai1: enc(found[1]), ai2: enc(found[2]) });
  console.log("L" + (lv + 1) + " ok (tries=" + tries + "): P=" + puzzles[lv].player);
}
var js = "/* 斗地主残局关卡（生成器验证：玩家按最优走法必胜，且非一手秒解） */\nwindow.DDPuzzles = " + JSON.stringify(puzzles, null, 2) + ";\n";
fs.writeFileSync("public/puzzles.js", js);
console.log("written public/puzzles.js");
