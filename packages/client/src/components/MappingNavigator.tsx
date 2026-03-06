import { ArrowLeftRight } from 'lucide-react';
import type { TranslationMappings } from '../api/client';
import './MappingNavigator.css';

interface MappingNavigatorProps {
  mappings: TranslationMappings | null;
  activeMappingId: string | null;
  onSelect: (id: string) => void;
}

function formatId(id: string): string {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MappingNavigator({
  mappings,
  activeMappingId,
  onSelect,
}: MappingNavigatorProps) {
  if (!mappings || mappings.mappings.length === 0) return null;

  return (
    <div className="mapping-navigator" role="navigation" aria-label="Line mapping guide">
      <div className="mapping-navigator__header">
        <ArrowLeftRight size={12} aria-hidden="true" />
        Mapping Guide
      </div>
      <div className="mapping-navigator__list" role="list">
        {mappings.mappings.map((m) => (
          <button
            key={m.id}
            role="listitem"
            className={`mapping-navigator__item${
              activeMappingId === m.id ? ' mapping-navigator__item--active' : ''
            }`}
            onClick={() => onSelect(m.id)}
            title={m.explanation}
          >
            <span className="mapping-navigator__item-label">{formatId(m.id)}</span>
            <span className="mapping-navigator__item-desc">{m.explanation}</span>
            <span className="mapping-navigator__item-lines">
              SAS {m.sasLines.join(',')} → Hive {m.hiveLines.join(',')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
