import { useState } from 'react';
import { Database, Upload, Pencil, Trash2, Download, Save, X } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { validateContextFile, type ContextFile } from '../lib/context-validation';
import './ContextPanel.css';

interface ContextPanelProps {
  context: ContextFile | null;
  onContextChange: (context: ContextFile | null) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

const TEMPLATES = [
  { label: 'Form 11 — Income Tax (template)', url: '/context-templates/form11-template.sasctx.json' },
  { label: 'Corporation Tax (template)', url: '/context-templates/corptax-template.sasctx.json' },
];

export default function ContextPanel({ context, onContextChange, onToast }: ContextPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleLoadFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.sasctx.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const parsed = JSON.parse(text);
        validateContextFile(parsed);
        onContextChange(parsed);
        onToast('success', `Context "${parsed.name}" loaded`);
      } catch (err) {
        onToast('error', `Could not load context file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    input.click();
  };

  const handleLoadTemplate = async (url: string) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch template (${res.status})`);
      const parsed = await res.json();
      validateContextFile(parsed);
      onContextChange(parsed);
      onToast('success', 'Template loaded — edit to match your schema');
    } catch (err) {
      onToast('error', `Could not load template: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleEdit = () => {
    setEditValue(JSON.stringify(context, null, 2));
    setEditMode(true);
  };

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editValue);
      validateContextFile(parsed);
      onContextChange(parsed);
      setEditMode(false);
      onToast('success', 'Context saved');
    } catch (err) {
      onToast('error', `Invalid context: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancelEdit = () => {
    setEditMode(false);
  };

  const handleDownload = () => {
    if (!context) return;
    const blob = new Blob([JSON.stringify(context, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${context.taxArea ?? 'context'}.sasctx.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    onContextChange(null);
    setEditMode(false);
    onToast('success', 'Context cleared');
  };

  return (
    <div className="context-panel">
      <div className="context-panel__header">
        <Database size={12} aria-hidden="true" />
        Translation Context
      </div>

      {!context && !editMode && (
        <>
          <p className="context-panel__empty">
            No context loaded. Load a <code>.sasctx.json</code> file to improve translation accuracy with table mappings and business rules.
          </p>
          <div className="context-panel__actions">
            <button className="context-panel__btn" onClick={handleLoadFile} aria-label="Load context file from disk">
              <Upload size={12} aria-hidden="true" />
              Load file
            </button>
          </div>
          <div className="context-panel__templates">
            <label className="context-panel__template-label" htmlFor="template-select">
              Or start from a template:
            </label>
            <select
              id="template-select"
              className="context-panel__template-select"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) handleLoadTemplate(e.target.value);
                e.target.value = '';
              }}
              aria-label="Select a context template"
            >
              <option value="" disabled>Select a template…</option>
              {TEMPLATES.map((t) => (
                <option key={t.url} value={t.url}>{t.label}</option>
              ))}
            </select>
          </div>
        </>
      )}

      {context && !editMode && (
        <>
          <div className="context-panel__summary">
            <div className="context-panel__name">{context.name}</div>
            <div className="context-panel__stats">
              <span>{context.tableMappings.length} table mappings</span>
              <span>{context.businessRules.length} rules</span>
              {context.schemas.length > 0 && (
                <span>{context.schemas.length} schemas</span>
              )}
            </div>
          </div>
          <div className="context-panel__actions">
            <button className="context-panel__btn" onClick={handleEdit} aria-label="Edit context">
              <Pencil size={12} aria-hidden="true" />
              Edit
            </button>
            <button className="context-panel__btn" onClick={handleDownload} aria-label="Download context file">
              <Download size={12} aria-hidden="true" />
              Save
            </button>
            <button className="context-panel__btn" onClick={handleLoadFile} aria-label="Load different context file">
              <Upload size={12} aria-hidden="true" />
              Load
            </button>
            <button className="context-panel__btn context-panel__btn--danger" onClick={handleClear} aria-label="Clear context">
              <Trash2 size={12} aria-hidden="true" />
              Clear
            </button>
          </div>
        </>
      )}

      {editMode && (
        <div className="context-panel__editor-wrapper">
          <Editor
            height="300px"
            language="json"
            value={editValue}
            onChange={(value) => setEditValue(value ?? '')}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              fontSize: 12,
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
            }}
          />
          <div className="context-panel__editor-actions">
            <button className="context-panel__btn context-panel__btn--primary" onClick={handleSave} aria-label="Save context changes">
              <Save size={12} aria-hidden="true" />
              Save
            </button>
            <button className="context-panel__btn" onClick={handleCancelEdit} aria-label="Cancel editing">
              <X size={12} aria-hidden="true" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
