# 隔绝室 / Seal Room — 源码交接

## 1. 当前版本

`0.1.2-P3-B2.4-fix2-restart-trust-boundary`

最新审查：`docs/audits/seal_room_p3b24_fix2_restart_trust_boundary_audit.json`  
最新规范：`docs/specs/seal_room_p3b24_fix2_restart_trust_boundary_spec.json`

## 2. 冻结状态

| 层 | 状态 |
|---|---|
| P2 Base | FROZEN |
| P2 Amendment 01 | FROZEN |
| P3-A/B | FROZEN |
| P3-B2 Deadlock/Heteromorph | FROZEN |
| P3-B2.2 Rare Tags | FROZEN |
| P3-B2.3 Rare Tag Runtime | FROZEN |
| P3-B2.4 Rare Actions | FROZEN |
| P3-B2.4 Restart Semantics | FROZEN |
| P3-B2.4 Restart Trust Boundary | FROZEN |

下一阶段规划：`P3-B3 RevivalEndpointEngine`（未实现）。

## 3. 当前重要硬规则

- 优先级：`rules > mechanism > supernatural strength > D100`
- 普通驾驭：`current_strength` / current-equivalent vs incoming `current_strength`
- 稀有词条门槛：`1500` 必死/压制/诅咒；`2200` 鬼域/意识；`3000` 唯心/重启
- 范围/外部重启：鬼域 + 重启 + current effective `>= 6800`
- 高位鬼域定义：当前有效鬼域强度 `>= 6800`（无第二门槛/tag）
- 自身重启：默认无需鬼域/6800
- 外部目标：无 Power canonical `external_single_target_exception` 时一律 `AreaRestartGate`
- 源自身复苏排除：默认不能用自己的状态/时间重启刷新自身 `revival_state`
- 独立外部重启源：机制允许时可回退目标 `revival_state`
- `memory` / `consciousness` / `causal_history` 重启：当前 `unsupported`
- 即时复苏：统一 `applyRevivalDelta`
- 自然复苏：仅 `long_time_skip`
- 异类：`BALANCE → DEADLOCK → CONSCIOUSNESS_PRESERVED → HETEROMORPH`
- 重启特殊权限只来自 `Power.restart_profile`，Action/AI 声明无效

## 4. 明确未实现

- 完整 RevivalEndpointEngine（仅 `revival_threshold` interrupt / pending hook）
- 完整时间/世界状态回退
- 记忆/因果型重启
- 在线 LLM Plan Interpreter
- Scheduler / Hidden Roll / Event Clock / NPC Autonomy
- 完整鬼域碰撞 / 完整意识战斗
- 正式 UI 对接七类稀有 action（PlayView 仍是观察/关押/驾驭/骰子主路径）
- 关押物交易经济

## 5. 已知技术债

- `applyRevivalDelta` 同时有进程内 ephemeral Set 与 `save.action_transactions` 双轨
- 范围重启硬门通过后尚未真正回退完整 WorldState
- `RareActionPayload` 仍允许携带 forbidden 权限字段以便测试伪造，运行时忽略
- `settleNaturalRevival` 仍直接写 `revival_degree`（规范允许的 long_time_skip 例外）
- 旧 contain/drive 以外的即时路径已迁到 `applyRevivalDelta`，但事务阶段机未拆独立类
- App Builder 脚手架含 auth/db 代码；本原型默认不启用账号

## 6. 如何运行

Node 22，npm。

```
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

`npm test` 覆盖 scripts 单测 + engine RB/RF/RA/RR/RT/DH/P2/P3 回归。

## 7. CI

`.github/workflows/ci.yml`：`npm ci` + typecheck + test + build。

平台相关：`startup.sh` / `scripts/with-app-env.mjs` 属于 App Builder 预览宿主，接手纯仓库开发时仍可用 `npm run dev`。
