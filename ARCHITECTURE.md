# 隔绝室架构（真实调用链）

## 主管道

```
Player input (PlayView / store)
  → inferActionType(action_text)          src/lib/engine/resolution.ts
  → resolveAction(save, input)            src/lib/engine/resolution.ts
      → hard rules / rule trigger         src/lib/engine/rules.ts + ghost.ts
      → mechanism validation              matchMechanism / rare gates
      → strength / StackingEngine         stacking.ts / ghost-relations.ts
      → rare actions (if typed)           rare-actions.ts
      → D100                              dice.ts resolveDice
      → cost commit                       revival-delta.ts applyRevivalDelta
      → WorldState mutation               SaveData in store.ts
      → Knowledge / Visibility            knowledge.ts / visibility.ts
      → narration                         gm/narrate.ts + narrate-local.ts
```

AI 叙述不得改写规则结果。hidden 不得进入玩家可见导出。

## 核心模块（现存文件）

| 职责 | 文件 | 主要 symbol |
|---|---|---|
| 主管道 | `src/lib/engine/resolution.ts` | `resolveAction`, `inferActionType` |
| 驾驭 | `src/lib/engine/driving.ts` | `evaluateDrivingP2` |
| 关押 | `src/lib/engine/containment.ts` | `evaluateContainmentP2` |
| 自然复苏 | `src/lib/engine/natural-revival.ts` | `settleNaturalRevival` |
| 即时复苏 | `src/lib/engine/revival-delta.ts` | `applyRevivalDelta` |
| 叠加 | `src/lib/engine/stacking.ts` | `stackingEngineComposite`, `cooperativeOpposition` |
| 死机门 | `src/lib/engine/deadlock-gate.ts` | `evaluateDeadlockLogic` |
| 异类门 | `src/lib/engine/heteromorph-gate.ts` | `evaluateHeteromorphLogic` |
| 稀有词条 | `src/lib/engine/rare-tags.ts` | `rareTagEligible` |
| 范围重启 | `src/lib/engine/area-restart.ts` | `evaluateAreaRestartGate` |
| 重启路由 | `src/lib/engine/restart-engine.ts` | `evaluateRestartRequest`, `readCanonicalRestartProfile` |
| 唯心接触 | `src/lib/engine/source-contact.ts` | `establishSourceContact`, `idealisticBlocksContainment` |
| 压制 | `src/lib/engine/suppression.ts` | `createSuppressionLock`, `powerBlocked` |
| 诅咒 | `src/lib/engine/curse-link.ts` | `createCurseLink`, `applyBorrowedEffects` |
| 方案解析 | `src/lib/engine/plan-evaluator.ts` | `parseSupernaturalPlan`, `parseRestartIntent` |
| 稀有动作接线 | `src/lib/engine/rare-actions.ts` | `runRareAction` |
| 状态 | `src/lib/store.ts` | persist / migrateSave |
| 设定包 | `src/lib/packs/default-pack.ts` | `DEFAULT_PACK` |
| 类型 | `src/lib/engine/types.ts` | `SaveData`, `GhostEntity`, `Power.restart_profile` |

## UI

- 入口：`src/routes/index.tsx`
- 对局：`src/components/PlayView.tsx`
- 面板：`src/components/Panels.tsx`

## 测试位置

全部在 `src/lib/engine/*.test.ts` 与 `scripts/**/*.test.mjs`。没有独立 `tests/` 目录。
