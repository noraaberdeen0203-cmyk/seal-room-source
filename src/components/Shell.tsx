import { useApp, type AppView } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV: { id: AppView; label: string }[] = [
  { id: "play", label: "现场" },
  { id: "sheet", label: "角色" },
  { id: "npcs", label: "人物" },
  { id: "clues", label: "线索" },
  { id: "event", label: "事件" },
  { id: "dice", label: "骰子" },
  { id: "archive", label: "档案" },
  { id: "gm", label: "GM" },
  { id: "pack", label: "内容包" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { view, setView, save } = useApp();
  const ev = save?.events.find((e) => e.status === "active");
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" className="text-left" onClick={() => setView(save ? "play" : "start")}>
            <div className="text-[11px] tracking-[0.22em] text-subtle">RULE FIRST</div>
            <div className="font-display text-lg leading-tight">隔绝室</div>
          </button>
          {save ? (
            <div className="hidden items-center gap-3 text-xs text-muted sm:flex">
              <span className="tabular">T{save.turn}</span>
              <span>{save.visible_context.location_name}</span>
              {ev ? (
                <span>
                  {ev.name} · 危害 {ev.hazard_grade} · 失控 {ev.instability}
                </span>
              ) : null}
            </div>
          ) : null}
          <button type="button" className="text-xs text-muted hover:text-fg" onClick={() => setView("start")}>
            存档
          </button>
        </div>
        {save ? (
          <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setView(n.id)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-2 text-xs tracking-wide",
                  view === n.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
                )}
              >
                {n.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
