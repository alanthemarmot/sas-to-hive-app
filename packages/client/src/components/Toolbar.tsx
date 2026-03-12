import { ArrowRightLeft, Copy, Download, Play, MessageCircle } from 'lucide-react';
import './Toolbar.css';

interface ToolbarProps {
  onTranslate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onExecute: () => void;
  onToggleChat: () => void;
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
  onToggleChat,
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
        aria-label="Translate SAS to BigQuery SQL"
      >
        {isTranslating ? <span className="spinner" aria-hidden="true" /> : <ArrowRightLeft size={14} aria-hidden="true" />}
        {isTranslating ? 'Translating…' : 'Translate'}
      </button>

      <div className="toolbar-separator" />

      <button
        className="toolbar-btn btn-secondary"
        onClick={onCopy}
        disabled={!hasOutput}
        aria-label="Copy BigQuery SQL to clipboard"
        title="Copy to clipboard"
      >
        <Copy size={14} aria-hidden="true" />
        Copy
      </button>

      <button
        className="toolbar-btn btn-secondary"
        onClick={onDownload}
        disabled={!hasOutput}
        aria-label="Download as .sql file"
        title="Download .sql"
      >
        <Download size={14} aria-hidden="true" />
        Download .sql
      </button>

      <button
        className="toolbar-btn btn-secondary"
        onClick={onExecute}
        disabled={!hasOutput}
        aria-label="Run translated SQL on BigQuery"
        title="Run on BigQuery"
      >
        <Play size={14} aria-hidden="true" />
        Run on BigQuery
      </button>

      <button
        className="toolbar-btn btn-secondary"
        onClick={onToggleChat}
        disabled={!hasOutput}
        aria-label="Ask a question about this translation"
        title="Ask a question about this translation"
      >
        <MessageCircle size={14} aria-hidden="true" />
        Ask
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
