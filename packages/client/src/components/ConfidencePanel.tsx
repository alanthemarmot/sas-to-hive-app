import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import type { TranslationConfidence, TranslationWarning } from '../lib/sas-static-checks';
import './ConfidencePanel.css';

interface ConfidencePanelProps {
  confidence: TranslationConfidence | null;
  isTranslating: boolean;
  onWarningLineClick?: (line: number) => void;
}

const LEVEL_CONFIG = {
  high: {
    icon: <CheckCircle size={16} aria-hidden="true" />,
    label: 'High Confidence',
    subtitle: 'Translation follows standard patterns',
  },
  moderate: {
    icon: <AlertTriangle size={16} aria-hidden="true" />,
    label: 'Moderate Confidence',
    subtitle: 'Review recommended',
  },
  low: {
    icon: <XCircle size={16} aria-hidden="true" />,
    label: 'Low Confidence',
    subtitle: 'Manual review required',
  },
} as const;

const SEVERITY_ICONS = {
  error: <XCircle size={14} aria-hidden="true" />,
  warning: <AlertTriangle size={14} aria-hidden="true" />,
  info: <Info size={14} aria-hidden="true" />,
} as const;

function WarningItem({
  warning,
  onLineClick,
}: {
  warning: TranslationWarning;
  onLineClick?: (line: number) => void;
}) {
  return (
    <li className={`confidence-warning confidence-warning--${warning.severity}`}>
      <span className={`confidence-warning-icon confidence-warning-icon--${warning.severity}`}>
        {SEVERITY_ICONS[warning.severity]}
      </span>
      <span className="confidence-warning-body">
        <span className="confidence-warning-construct">{warning.sasConstruct}</span>
        <span className="confidence-warning-message"> — {warning.message}</span>
      </span>
      {warning.hiveLine != null && onLineClick && (
        <button
          className="confidence-line-badge"
          onClick={() => onLineClick(warning.hiveLine!)}
          title={`Go to line ${warning.hiveLine}`}
        >
          Line {warning.hiveLine}
        </button>
      )}
    </li>
  );
}

export default function ConfidencePanel({
  confidence,
  isTranslating,
  onWarningLineClick,
}: ConfidencePanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  // Skeleton while translating and no confidence yet
  if (isTranslating && !confidence) {
    return (
      <div className="confidence-panel" role="status" aria-label="Analysing confidence">
        <div className="confidence-skeleton">
          <div className="confidence-skeleton-bar" style={{ width: '16px', height: '16px', borderRadius: '50%' }} />
          <div className="confidence-skeleton-bar" style={{ width: '200px' }} />
        </div>
      </div>
    );
  }

  if (!confidence) return null;

  const config = LEVEL_CONFIG[confidence.confidence];
  const hasWarnings = confidence.warnings.length > 0;
  // Force red if any error-severity warning exists, regardless of LLM assessment
  const effectiveLevel =
    confidence.warnings.some((w) => w.severity === 'error') ? 'low' : confidence.confidence;
  const effectiveConfig = LEVEL_CONFIG[effectiveLevel];
  // Low confidence always shows warnings expanded
  const isExpanded = effectiveLevel === 'low' || !collapsed;

  return (
    <div className="confidence-panel" role="region" aria-label="Translation confidence">
      <div className={`confidence-banner confidence-banner--${effectiveLevel}`}>
        <span className="confidence-icon">{effectiveConfig.icon}</span>
        <span className="confidence-label">
          {effectiveConfig.label} — {effectiveConfig.subtitle}
        </span>
        {hasWarnings && effectiveLevel !== 'low' && (
          <button
            className="confidence-toggle"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={isExpanded}
            aria-controls="confidence-warnings-list"
          >
            {collapsed ? `Show warnings (${confidence.warnings.length})` : 'Hide'}
          </button>
        )}
      </div>
      {hasWarnings && isExpanded && (
        <ul id="confidence-warnings-list" className="confidence-warnings">
          {confidence.warnings.map((w) => (
            <WarningItem key={w.id} warning={w} onLineClick={onWarningLineClick} />
          ))}
        </ul>
      )}
    </div>
  );
}
