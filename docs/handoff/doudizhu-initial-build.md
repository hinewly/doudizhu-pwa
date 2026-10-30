# 斗地主首版搭建 交接

- last_updated: 2026-10-30 11:20
- status: done（国内已上线，剩手机实测）
- version: v0.1.0

## 任务目标

家族第 14 个应用「斗地主 PWA」：经典三人斗地主（叫分+AI）+ 残局闯关（明牌解谜，求解器验证），免费 + 时长配额，国内站上线。四川长牌三变体列入二期开发计划（docs/roadmap-changpai.md）。

## 当前状态

✅ 国内站已上线：https://doudizhu.daobox.net.cn（HTTPS 200，线上 E2E 全通过：菜单/经典局叫分当地主/出牌收墩/残局第 1 关求解器提示通关解锁第 2 关/portal 胶囊剩 14 分）。剩手机实测。

## 最近完成

- 规则引擎 rules.js：全牌型（单/对/三/三带一/三带二/顺子/连对/飞机带翼/炸弹/王炸）；4000 轮随机压测 + 子集枚举完备性验证 120 局全过
- AI ai.js：叫分估值/最小代价跟牌/农民不压队友/炸弹惜用；200 局全 AI 仿真 0 非法出牌（地主胜率 67%，可后续调平衡）
- 残局求解器 tools/solver.mjs：博弈树+记忆化，与暴力参照 300 局全对拍；关卡生成器产出 12 关（必胜 && 非秒解 && 节点 <15 万），复验全过
- 页面：菜单/经典局（叫分 UI+底牌+倍数）/残局（明牌对手+求解器提示）+ portal 时长接入 + SW/manifest/图标（「斗」字红金主题）
- DNS：doudizhu.daobox.net.cn A 记录已加（aliyun-cli RecordId 2115993736600708096）

## 待办

- [x] GitHub 建仓 hinewly/doudizhu-pwa + push（commit e22673f）
- [x] 部署：rsync /opt/doudizhu-pwa + systemd 8803 + Caddy（证书 2026-10-30 签发）
- [x] DNS：aliyun-cli A 记录 RecordId 2115993736600708096
- [x] portal 登记：portal.js PILL_ANCHORS+CHECKIN_APPS 国内 rsync + 海外 worker 69dfbe86（worker 打卡接口不校验白名单，无需改 worker 代码）
- [x] daobox-home 首页轻松一刻入口（commit 0b49923 portal + app.js 入口，国内 commit cbecb616；海外 worker cbecb616）
- [x] 线上 E2E（Playwright 截图在 _temp-screenshots/2026-10/）
- [ ] 手机实测：加主屏幕、离线、横竖屏、长局稳定性

## 重要决策

- 2026-10-30 用户拍板：先做斗地主；长牌写开发计划，三变体（幺地人/贰柒拾/拷拷）都做，P1 幺地人
- 二期候选：春天/反春翻倍、AI 平衡调优（当前地主胜率 67%）、残局加关
- 残局模式设计：明牌 + 玩家当地主先出 + 求解器验证必胜；提示按钮直接给必胜着法
- 计分：底分=叫分，炸弹/王炸翻倍；春天规则 v2 再加

## 注意事项

- ⚠️ beats() 兼容裸 play 和 {play,...} 包装（本次踩过：仿真非法出牌 100% 复现就是这个）
- ⚠️ 牌串解码必须 strip 空白（puzzles.js 存的是空格分隔串，逐字符解码会把空格变 undefined 垃圾牌）
- 残局关卡换规则引擎后必须重新生成+复验（旧关卡在旧 buggy responses 下生成，全部作废过一次）
- 8803 为本项目专用端口；部署前照例 ss 查占用

## 相关文件

- public/rules.js · ai.js · puzzles.js · app.js · index.html · style.css · service-worker.js · manifest.json
- tools/solver.mjs · gen-puzzles.mjs
- docs/roadmap-changpai.md（四川长牌三变体开发计划）
