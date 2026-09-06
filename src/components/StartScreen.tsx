import { useRef } from "react";
import { useApp } from "@/lib/store";
import { Button, Panel } from "./ui";

export function StartScreen() {
  const { newGame, loadLocal, importPackJson, importSaveJson, pack, packIssues, lastError } = useApp();
  const packRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<HTMLInputElement>(null);

  function readFile(file: File, cb: (text: string) => void) {
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result ?? ""));
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 py-6">
      <div className="space-y-3">
        <p className="text-[11px] tracking-[0.28em] text-subtle">SEAL ROOM / D100</p>
        <h1 className="font-display text-4xl leading-none tracking-tight">隔绝室</h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted">
          灵异规律优先于骰子。强度不是危害。信息是真正的奖励。这不是打怪升级，而是在复苏、身体和失控度之间把源头关回去。
        </p>
      </div>

      <Panel className="space-y-4 p-5">
        <div className="text-sm text-muted">
          当前内容包：<span className="text-fg">{pack.pack_name}</span>
          <span className="text-subtle"> · {pack.version}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => newGame()}>新的现场</Button>
          <Button variant="line" onClick={() => loadLocal()}>
            读取本地存档
          </Button>
          <Button variant="ghost" onClick={() => packRef.current?.click()}>
            导入内容包 JSON
          </Button>
          <Button variant="ghost" onClick={() => saveRef.current?.click()}>
            导入存档 JSON
          </Button>
        </div>
        <input
          ref={packRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f, importPackJson);
          }}
        />
        <input
          ref={saveRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f, importSaveJson);
          }}
        />
        {packIssues.length ? (
          <ul className="space-y-1 text-xs text-danger">
            {packIssues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}
        {lastError ? <p className="text-xs text-danger">{lastError}</p> : null}
      </Panel>

      <div className="grid gap-3 text-xs text-muted sm:grid-cols-3">
        <div className="rounded-lg border border-line p-4">
          <div className="mb-1 text-fg">规律优先</div>
          应门、看见、喊名。先结算规律，再看你有没有对得上的机制。
        </div>
        <div className="rounded-lg border border-line p-4">
          <div className="mb-1 text-fg">强度 ≠ 危害</div>
          金棺可以很强却很低危。敲门可以不强，却能把整栋楼变成媒介。
        </div>
        <div className="rounded-lg border border-line p-4">
          <div className="mb-1 text-fg">信息分层</div>
          玩家只看见自己该知道的。GM 面板另开。
        </div>
      </div>
    </div>
  );
}
