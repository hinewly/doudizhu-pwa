# 斗地主首版搭建 交接

- last_updated: 2026-10-30 14:10
- status: done（国内已上线，剩手机实测）
- version: v0.1.5

## 任务目标

家族第 14 个应用「斗地主 PWA」：经典三人斗地主（叫分+AI）+ 残局闯关（明牌解谜，求解器验证），免费 + 时长配额，国内站上线。四川长牌三变体列入二期开发计划（docs/roadmap-changpai.md）。

## 当前状态

✅ 国内站已上线：https://doudizhu.daobox.net.cn（HTTPS 200，线上 E2E 全通过：菜单/经典局叫分当地主/出牌收墩/残局第 1 关求解器提示通关解锁第 2 关/portal 胶囊剩 14 分）。剩手机实测。

## 最近完成

- 2026-10-30 v0.1.5 划选牌型感知：滑动连选不再盲目全选，改为合法牌型子集判定——dragCanAdd() 检查已选+新牌的 counts 是否被手牌中某个可打出牌型包含（rebuildPlaySigs() 用 R.allPlays 缓存签名），67889T 自动跳过多余 8 选成顺子；线上 E2E 通过（注入手牌模拟拖选 10→9→8→8→7→6，结果 selected=[10,9,8,7,6] 跳过第二个 8，点出牌→'你 出 顺子 5张'）；测试注入状态必须含 table:[null,null,null] 和 passFlags:[false,false,false]，否则 renderSeatClassic 报错中断渲染
- 2026-10-30 v0.1.4 用户反馈：手牌滑动连选（参照欢乐斗地主交互）——pointerdown 起手定方向（未选→划过全选 / 已选→划过全取消），elementFromPoint 命中即选，鼠标拖拽+手机滑动通用；.my-hand touch-action:none 防滚动劫持；移除逐卡 click 绑定防双触发；E2E 通过（拖 5 张全选+反选取消）
- 2026-10-30 v0.1.3 用户反馈
- 2026-10-30 v0.1.2 用户反馈改版：①BGM 重写为欢快风（132bpm 原创旋律，C→G→Am→F 四小节循环，跳弓拨弦+贝斯+沙锤，无版权风险）；②暂停功能：经典局/残局各加 ⏸ 按钮，暂停弹窗+AI 全停+BGM 暂停，切后台自动暂停，▶ 继续恢复；E2E 验证暂停冻结/恢复（测试浏览器游客时长耗尽被 portal 锁为预期行为）
- 2026-10-30 v0.1.1 用户反馈改版：①音效+背景音乐（Web Audio 全合成零外部资源：发牌/出牌/过牌/叫分/炸弹/胜负/通关音 + C 宫五声音阶轻柔拨弦 BGM，顶栏 🔊/🎵/🔇 三档开关，localStorage 记忆，首次手势后启动过自动播放限制）；②牌面全面加大（手牌 34×48→46×66，桌面亮牌 24×34→34×48，牌背 13×19→17×25）+ 手牌扇形重叠排布（-11px，20 张全可见，悬停/选中上浮）；SW v3、CSS v3（踩坑：CSS max-age 300 改动必须升 ?v= 否则 HTTP 缓存假上线）
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
