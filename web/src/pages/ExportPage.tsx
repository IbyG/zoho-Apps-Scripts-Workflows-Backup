import { SessionPanel } from "../components/SessionPanel";
import { ExportPanel } from "../components/ExportPanel";

export function ExportPage() {
  return (
    <div className="flex w-full flex-col gap-12">
      <SessionPanel />
      <ExportPanel />
    </div>
  );
}
