import { PanelRight, Columns2, PanelLeft } from 'lucide-react';
import './ViewModeBar.css';

export type ViewMode = 'sas' | 'dual' | 'hive';

interface ViewModeBarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

const tabs: { mode: ViewMode; label: string; Icon: typeof PanelRight }[] = [
  { mode: 'sas', label: 'SAS View', Icon: PanelRight },
  { mode: 'dual', label: 'Dual View', Icon: Columns2 },
  { mode: 'hive', label: 'Hive/SQL View', Icon: PanelLeft },
];

export default function ViewModeBar({ viewMode, onViewModeChange }: ViewModeBarProps) {
  return (
    <div className="view-mode-bar" role="tablist" aria-label="Editor view mode">
      {tabs.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          role="tab"
          className={`view-mode-tab${viewMode === mode ? ' view-mode-tab--active' : ''}`}
          aria-selected={viewMode === mode}
          onClick={() => onViewModeChange(mode)}
        >
          <Icon size={14} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
