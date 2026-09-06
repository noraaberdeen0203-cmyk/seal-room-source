import { createFileRoute } from "@tanstack/react-router";
import { useApp } from "@/lib/store";
import { Shell } from "@/components/Shell";
import { StartScreen } from "@/components/StartScreen";
import { PlayView } from "@/components/PlayView";
import {
  ArchivePanel,
  CluePanel,
  DicePanel,
  EventPanel,
  GmPanel,
  NpcPanel,
  PackPanel,
  SheetPanel,
} from "@/components/Panels";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const view = useApp((s) => s.view);
  return (
    <Shell>
      {view === "start" ? <StartScreen /> : null}
      {view === "play" ? <PlayView /> : null}
      {view === "sheet" ? <SheetPanel /> : null}
      {view === "npcs" ? <NpcPanel /> : null}
      {view === "clues" ? <CluePanel /> : null}
      {view === "event" ? <EventPanel /> : null}
      {view === "dice" ? <DicePanel /> : null}
      {view === "gm" ? <GmPanel /> : null}
      {view === "archive" ? <ArchivePanel /> : null}
      {view === "pack" ? <PackPanel /> : null}
    </Shell>
  );
}
