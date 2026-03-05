import { ArrowRightLeft, Copy, Download, Play } from 'lucide-react';
import './Toolbar.css';

interface ToolbarProps {
  onTranslate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onExecute: () => void;
  isTranslating: boolean;
  hasOutput: boolean;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

const MODELS = [
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
];

export default function Toolbar({
  onTranslate,
  onCopy,
  onDownload,
  onExecute,
  isTranslating,
  hasOutput,
  selectedModel,
  onModelChange,
}: ToolbarProps) {
  return (
    <div className="toolbar">
      <button
        className="toolbar-btn btn-primary"
        onClick={onTranslate}
        disabled={isTranslating}
        title="Translate (⌘Enter)"
        aria-label="Translate SAS to Hive SQL"
      >
        {isTranslating ? <span className="spinner" aria-hidden="true" /> : <ArrowRightLeft size={14} aria-hidden="true" />}
        {isTranslating ? 'Translating…' : 'Translate'}
      </button>

      <div className="toolbar-separator" />

      <button
        className="toolbar-btn btn-secondary"
        onClick={onCopy}
        disabled={!hasOutput}
        aria-label="Copy Hive SQL to clipboard"
        title="Copy to clipboard"
      >
        <Copy size={14} aria-hidden="true" />
        Copy
      </button>

      <button
        className="toolbar-btn btn-secondary"
        onClick={onDownload}
        disabled={!hasOutput}
        aria-label="Download as .hql file"
        title="Download .hql"
      >
        <Download size={14} aria-hidden="true" />
        Download .hql
      </button>

      <button
        className="toolbar-btn btn-secondary"
        onClick={onExecute}
        disabled={!hasOutput}
        aria-label="Execute translated SQL on Hive"
        title="Execute on Hive"
      >
        <Play size={14} aria-hidden="true" />
        Execute on Hive
      </button>

      <div className="toolbar-spacer" />

      <label htmlFor="model-select" className="model-label">Model</label>
      <select
        id="model-select"
        className="model-select"
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        aria-label="Select AI model for translation"
      >
        {MODELS.map((model) => (
          <option key={model.id} value={model.id}>
            {model.label}
          </option>
        ))}
      </select>
    </div>
  );
}
