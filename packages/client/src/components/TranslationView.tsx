import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import type { editor, IPosition } from 'monaco-editor';
import { AlertTriangle, Lock, Unlock, X } from 'lucide-react';
import { registerSasLanguage } from '../lib/sas-language.js';
import type { TranslationMappings } from '../api/client';
import MappingNavigator from './MappingNavigator';
import './TranslationView.css';

interface TranslationViewProps {
  sasCode: string;
  onSasCodeChange: (value: string) => void;
  hiveSQL: string;
  onHiveSQLChange?: (value: string) => void;
  isTranslating: boolean;
  error: string | null;
  mappings: TranslationMappings | null;
  activeMappingId: string | null;
  onMappingActivate: (id: string | null) => void;
  onClearError?: () => void;
}

export default function TranslationView({
  sasCode,
  onSasCodeChange,
  hiveSQL,
  onHiveSQLChange,
  isTranslating,
  error,
  mappings,
  activeMappingId,
  onMappingActivate,
  onClearError,
}: TranslationViewProps) {
  const [isLocked, setIsLocked] = useState(true);
  const sasEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const hiveEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const sasDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const hiveDecorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null);
  const sasHoverDisposableRef = useRef<{ dispose(): void } | null>(null);
  const hiveHoverDisposableRef = useRef<{ dispose(): void } | null>(null);

  const handleSasEditorMount = useCallback(
    (ed: editor.IStandaloneCodeEditor, m: Monaco) => {
      sasEditorRef.current = ed;
      monacoRef.current = m;
    },
    [],
  );

  const handleHiveEditorMount = useCallback(
    (ed: editor.IStandaloneCodeEditor) => {
      hiveEditorRef.current = ed;
    },
    [],
  );

  // Apply decorations when mappings or activeMappingId change
  useEffect(() => {
    const sasEditor = sasEditorRef.current;
    const hiveEditor = hiveEditorRef.current;
    const monaco = monacoRef.current;
    if (!sasEditor || !hiveEditor || !monaco) return;

    // Clean up old decorations
    sasDecorationsRef.current?.clear();
    hiveDecorationsRef.current?.clear();

    if (!mappings || mappings.mappings.length === 0) return;

    const sasDecorations: editor.IModelDeltaDecoration[] = [];
    const hiveDecorations: editor.IModelDeltaDecoration[] = [];

    for (const m of mappings.mappings) {
      const isActive = m.id === activeMappingId;
      const sasMin = Math.min(...m.sasLines);
      const sasMax = Math.max(...m.sasLines);
      const hiveMin = Math.min(...m.hiveLines);
      const hiveMax = Math.max(...m.hiveLines);

      if (isActive) {
        sasDecorations.push({
          range: new monaco.Range(sasMin, 1, sasMax, 1),
          options: {
            isWholeLine: true,
            className: 'mapping-active-sas',
            glyphMarginClassName: 'mapping-gutter-marker',
          },
        });
        hiveDecorations.push({
          range: new monaco.Range(hiveMin, 1, hiveMax, 1),
          options: {
            isWholeLine: true,
            className: 'mapping-active-hive',
            glyphMarginClassName: 'mapping-gutter-marker',
          },
        });
      } else {
        // Subtle gutter marker for inactive mappings
        sasDecorations.push({
          range: new monaco.Range(sasMin, 1, sasMax, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: 'mapping-gutter-marker',
          },
        });
        hiveDecorations.push({
          range: new monaco.Range(hiveMin, 1, hiveMax, 1),
          options: {
            isWholeLine: true,
            glyphMarginClassName: 'mapping-gutter-marker',
          },
        });
      }
    }

    sasDecorationsRef.current = sasEditor.createDecorationsCollection(sasDecorations);
    hiveDecorationsRef.current = hiveEditor.createDecorationsCollection(hiveDecorations);
  }, [mappings, activeMappingId]);

  // Scroll both editors when active mapping changes
  useEffect(() => {
    if (!activeMappingId || !mappings) return;
    const mapping = mappings.mappings.find((m) => m.id === activeMappingId);
    if (!mapping) return;

    sasEditorRef.current?.revealLinesInCenter(
      Math.min(...mapping.sasLines),
      Math.max(...mapping.sasLines),
    );
    hiveEditorRef.current?.revealLinesInCenter(
      Math.min(...mapping.hiveLines),
      Math.max(...mapping.hiveLines),
    );
  }, [activeMappingId, mappings]);

  // Register hover providers
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || !mappings || mappings.mappings.length === 0) {
      sasHoverDisposableRef.current?.dispose();
      hiveHoverDisposableRef.current?.dispose();
      sasHoverDisposableRef.current = null;
      hiveHoverDisposableRef.current = null;
      return;
    }

    // SAS hover
    sasHoverDisposableRef.current?.dispose();
    sasHoverDisposableRef.current = monaco.languages.registerHoverProvider('sas', {
      provideHover(model: editor.ITextModel, position: IPosition) {
        const mapping = mappings.mappings.find((m) =>
          m.sasLines.includes(position.lineNumber),
        );
        if (!mapping) return null;
        return {
          range: new monaco.Range(
            Math.min(...mapping.sasLines),
            1,
            Math.max(...mapping.sasLines),
            model.getLineMaxColumn(Math.max(...mapping.sasLines)),
          ),
          contents: [
            { value: '**SAS → Hive**' },
            { value: mapping.explanation },
            { value: `_Hive lines: ${mapping.hiveLines.join(', ')}_` },
          ],
        };
      },
    });

    // Hive hover
    hiveHoverDisposableRef.current?.dispose();
    hiveHoverDisposableRef.current = monaco.languages.registerHoverProvider('sql', {
      provideHover(model: editor.ITextModel, position: IPosition) {
        const mapping = mappings.mappings.find((m) =>
          m.hiveLines.includes(position.lineNumber),
        );
        if (!mapping) return null;
        return {
          range: new monaco.Range(
            Math.min(...mapping.hiveLines),
            1,
            Math.max(...mapping.hiveLines),
            model.getLineMaxColumn(Math.max(...mapping.hiveLines)),
          ),
          contents: [
            { value: '**Hive ← SAS**' },
            { value: mapping.explanation },
            { value: `_SAS lines: ${mapping.sasLines.join(', ')}_` },
          ],
        };
      },
    });

    return () => {
      sasHoverDisposableRef.current?.dispose();
      hiveHoverDisposableRef.current?.dispose();
      sasHoverDisposableRef.current = null;
      hiveHoverDisposableRef.current = null;
    };
  }, [mappings]);

  const hasMappings = !!mappings && mappings.mappings.length > 0;

  return (
    <div className={`translation-view${hasMappings ? '' : ' translation-view--no-mappings'}`}>
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
            onMount={handleSasEditorMount}
            options={{
              minimap: { enabled: false },
              lineNumbers: 'on',
              fontSize: 13,
              fontFamily: "'Fira Code', 'Consolas', 'Courier New', monospace",
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              glyphMargin: hasMappings,
            }}
          />
        </div>
      </div>

      {/* Mapping Navigator (only when mappings present) */}
      {hasMappings && (
        <MappingNavigator
          mappings={mappings}
          activeMappingId={activeMappingId}
          onSelect={(id) =>
            onMappingActivate(activeMappingId === id ? null : id)
          }
        />
      )}

      {/* BigQuery SQL Output Panel */}
      <div className={`editor-panel${isTranslating && hiveSQL ? ' editor-panel--streaming' : ''}`}>
        <div className="editor-panel-header editor-panel-header--with-actions">
          BigQuery SQL Output
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
              onMount={handleHiveEditorMount}
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
                glyphMargin: hasMappings,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
