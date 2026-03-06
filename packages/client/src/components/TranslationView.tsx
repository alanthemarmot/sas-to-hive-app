import Editor from '@monaco-editor/react';
import { AlertTriangle } from 'lucide-react';
import { registerSasLanguage } from '../lib/sas-language.js';
import type { ViewMode } from './ViewModeBar';
import './TranslationView.css';

interface TranslationViewProps {
  sasCode: string;
  onSasCodeChange: (value: string) => void;
  hiveSQL: string;
  isTranslating: boolean;
  error: string | null;
  viewMode: ViewMode;
}

export default function TranslationView({
  sasCode,
  onSasCodeChange,
  hiveSQL,
  isTranslating,
  error,
  viewMode,
}: TranslationViewProps) {
  const sasClass = viewMode === 'sas' ? ' editor-panel--dominant' : viewMode === 'hive' ? ' editor-panel--recessive' : '';
  const hiveClass = viewMode === 'hive' ? ' editor-panel--dominant' : viewMode === 'sas' ? ' editor-panel--recessive' : '';

  return (
    <div className="translation-view">
      {/* SAS Input Panel */}
      <div className={`editor-panel${sasClass}`}>
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

      {/* Hive Output Panel */}
      <div className={`editor-panel${hiveClass}${isTranslating && hiveSQL ? ' editor-panel--streaming' : ''}`}>
        <div className="editor-panel-header">Hive Output</div>
        {error && (
          <div className="error-banner" role="alert">
            <AlertTriangle size={13} aria-hidden="true" />
            {error}
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
              options={{
                readOnly: true,
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
