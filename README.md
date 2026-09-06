# 隔绝室 / Seal Room

《神秘复苏》风格灵异跑团规则引擎原型。当前基线：`0.1.2-P3-B2.4-fix2-restart-trust-boundary`。

接手请先读 [HANDOFF.md](HANDOFF.md) 与 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 运行

需要 Node 22 与 npm。

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

规范在 `docs/specs/`，审查记录在 `docs/audits/`。
