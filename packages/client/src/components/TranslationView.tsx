import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { AlertTriangle, Lock, Unlock, X } from 'lucide-react';
import { registerSasLanguage } from '../lib/sas-language.js';
import './TranslationView.css';

const OUTPUT_LABELS: Record<string, string> = {
  hive: 'HiveQL Output',
  bigquery: 'BigQuery SQL Output',
  spark: 'Spark SQL Output',
};

interface TranslationViewProps {
  sasCode: string;
  onSasCodeChange: (value: string) => void;
  hiveSQL: string;
  onHiveSQLChange?: (value: string) => void;
  isTranslating: boolean;
  error: string | null;
  dialect: string;
  onClearError?: () => void;
}

export default function TranslationView({
  sasCode,
  onSasCodeChange,
  hiveSQL,
  onHiveSQLChange,
  isTranslating,
  error,
  dialect,
  onClearError,
}: TranslationViewProps) {
  const [isLocked, setIsLocked] = useState(true);

  return (
    <div className="translation-view">
      {/* SAS Input Panel */}
      <div className="editor-panel">
        <div className="editor-panel-header">SAS Input</div>
        <div className="editor-container">
          <Editor
            beforeMount={registerSasLanguage}
            language="sas"
            theme="light"
            value={sasCode}
            onChange={(value) => onSasCodeChange(value ?? '')}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              fontSize: 13,
              fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>

      {/* BigQuery SQL Output Panel */}
      <div className={`editor-panel${isTranslating && hiveSQL ? ' editor-panel--streaming' : ''}`}>
        <div className="editor-panel-header editor-panel-header--with-actions">
          {OUTPUT_LABELS[dialect] ?? 'SQL Output'}
          <button
            className="editor-lock-toggle"
            onClick={() => setIsLocked((v) => !v)}
            aria-label={isLocked ? 'Unlock SQL editor' : 'Lock SQL editor'}
            title={isLocked ? 'Unlock to edit SQL before running' : 'Lock SQL editor'}
          >
            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
          </button>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={13} aria-hidden="true" />
            <span className="error-banner-text">{error}</span>
            <button
              className="error-banner-dismiss"
              onClick={onClearError}
              aria-label="Dismiss error"
              title="Dismiss"
            >
              <X size={13} />
            </button>
          </div>
        )}
        <div className="editor-container">
          {isTranslating && !hiveSQL ? (
            <div className="translating-overlay">Translating…</div>
          ) : (
            <Editor
              language="sql"
              theme="light"
              value={hiveSQL}
              onChange={isLocked ? undefined : (v) => onHiveSQLChange?.(v ?? '')}
              options={{
                readOnly: isLocked,
                minimap: { enabled: false },
                lineNumbers: 'on',
                fontSize: 13,
                fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
