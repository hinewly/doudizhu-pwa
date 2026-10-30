# 斗地主首版搭建 交接

- last_updated: 2026-10-30 23:40
- status: done（国内已上线，剩手机实测）
- version: v0.2.1（经典模式 v0.1.7）

## 任务目标

家族第 14 个应用「斗地主 PWA」：经典三人斗地主（叫分+AI）+ 残局闯关（明牌解谜，求解器验证），免费 + 时长配额，国内站上线。四川长牌三变体列入二期开发计划（docs/roadmap-changpai.md）。

## 当前状态

✅ 国内站已上线：https://doudizhu.daobox.net.cn（HTTPS 200）。v0.1.5 划选牌型感知线上 E2E 通过（拖选 10→9→8→8→7→6 自动跳过多余 8 → selected=[10,9,8,7,6] → 出牌"顺子 5张"）。缓存已修复：app.js?v=7 + SW CACHE v9 已部署上线（2026-10-30 14:30 验证）。剩：手机实测 + 用户确认新版 BGM 是否满意。

## 最近完成

- 2026-10-30 v0.1.7 用户反馈"手牌 J 跑到末尾乱序"：根因是 becomeLandlord() 把 3 张底牌 push 进了三家手牌且只给地主重排——农民手牌 20 张（多发 3 张底牌）+ 末尾 3 张不排序。修复：底牌只归地主并重排；老存档恢复时对 20 张农民手牌裁掉末尾 3 张（追加有序可安全裁）；app.js?v=10 + SW dbdoudizhu-v12；国内已 rsync 验证
- 2026-10-30 v0.2.0 残局改版方案 A（用户拍板 1v1 大残局）：
  - 调研：抖音/微信残局挑战、CSDN minimax、naturalleo/doudizhu_endgame（Negamax+置换表+首个必胜孩子剪枝）均为 1v1；已通读其 C++ 源码再动手（新 AGENTS 规则）
  - duel.js 新增 1v1 求解器：点数空间（无同花顺）+ 压缩打包 key（15 槽×3bit），solve/bestMove API
  - tools/gen-duel-puzzles.mjs 生成 24 关：随机发牌筛选（玩家必胜+非秒解+最短胜利≥5手+根节点求解量可控），难度 6-8张 → 15-17张 递进
  - app.js 残局 1v1 化：对手明牌、AI=求解器最优防守（500k cap 超时兜底启发式）、提示=必胜着（3M cap，L14 根局面 114万节点/2.8s 实测可算）、1v1 收墩（一家过即收墩）
  - ⚠️ 修复真实 bug：求解器占位牌 s:"S" 与真实手牌花色不匹配 → realCards 按点数映射（AI 出牌手牌不减/提示选不中，两处）
  - E2E：Node DOM-stub 全流程 4/4，24 关全部自动通关（玩家=求解器 vs AI=最优防守）
  - 缓存：app.js?v=9 duel.js?v=1 puzzles.js?v=2 + SW dbdoudizhu-v11；解锁进度 key 升 dbdoudizhu-puzzle-v2（老进度重置）
  - commit 70701e3（春天反春）+ 84cfdb0（残局改版）；国内已 rsync，线上版本标记已验证

- 2026-10-30 v0.1.6 春天/反春（开源参考规划第 2 项，规则参照 DouZero/RLCard 官方规则文档）：springType 纯函数（春天=地主赢且两农民各剩17张；反春=农民赢且地主只出过一手），命中倍数×2，结算弹窗展示 🌸/🍃 文案；C.landlordPlays 计数地主出牌手数；Node 单测 5/5；app.js?v=8 + SW dbdoudizhu-v10；commit 70701e3；国内已 rsync
- 2026-10-30 用户反馈：残局形态错误（现 1v2 三人小残局 vs 网上主流 1v1 大残局 10-20 张）+ 复杂度不足——调研结论：抖音/微信残局挑战、CSDN minimax、YunyanDeng/doudizhu_endgame 均为 1v1 双手牌 Negamax 求解；改造方案待用户拍板（见对话记录）

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
- [ ] 用户确认新版 BGM（v0.1.2 重写的欢快风原创旋律）是否满意——用户曾反馈"音乐不好听"，重写后未收到确认
- [ ] 二期候选：四川长牌三变体独立项目 changpai-pwa（见 docs/roadmap-changpai.md，P1 幺地人）

## 重要决策

- 2026-10-30 用户拍板：先做斗地主；长牌写开发计划，三变体（幺地人/贰柒拾/拷拷）都做，P1 幺地人
- 二期候选：春天/反春翻倍、AI 平衡调优（当前地主胜率 67%）、残局加关
- 残局模式设计：明牌 + 玩家当地主先出 + 求解器验证必胜；提示按钮直接给必胜着法
- 计分：底分=叫分，炸弹/王炸翻倍；春天规则 v2 再加

## 注意事项

- ⚠️ 改动 app.js/style.css/sounds.js 必须同步升 index.html 的 ?v=N + service-worker.js 的 CACHE 名 + ASSETS 数组里的对应 ?v=，三处缺一不可——SW 是 cache-first（hit || fetch），SW 文件本身没变就不会重新预缓存，老用户永远拿旧文件（v0.1.5 修正提交 5cd1632 就漏了，966a563 补上）
- ⚠️ beats() 兼容裸 play 和 {play,...} 包装（本次踩过：仿真非法出牌 100% 复现就是这个）
- ⚠️ 牌串解码必须 strip 空白（puzzles.js 存的是空格分隔串，逐字符解码会把空格变 undefined 垃圾牌）
- 残局关卡换规则引擎后必须重新生成+复验（旧关卡在旧 buggy responses 下生成，全部作废过一次）
- 8803 为本项目专用端口；部署前照例 ss 查占用

## 相关文件

- public/rules.js · ai.js · puzzles.js · app.js · index.html · style.css · service-worker.js · manifest.json
- tools/solver.mjs · gen-puzzles.mjs
- docs/roadmap-changpai.md（四川长牌三变体开发计划）
