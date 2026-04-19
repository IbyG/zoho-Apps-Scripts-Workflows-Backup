import { ExportPanel } from "../components/ExportPanel";
import { SessionPanel } from "../components/SessionPanel";

export function ExportPage() {
  return (
    <div className="split">
      <SessionPanel />
      <ExportPanel />
    </div>
  );
}
