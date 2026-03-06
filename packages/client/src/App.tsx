import { useState, useEffect, useCallback, useRef } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { streamTranslation, executeHiveQuery } from './api/client';
import { type ContextFile } from './lib/context-validation';
import Toolbar from './components/Toolbar';
import TranslationView from './components/TranslationView';
import ExplanationPanel from './components/ExplanationPanel';
import HiveResults from './components/HiveResults';
import FileTree from './components/FileTree';
import FileUpload from './components/FileUpload';
import ContextPanel from './components/ContextPanel';
import Toast, { type ToastMessage } from './components/Toast';
import './App.css';

interface HiveResultData {
  columns: string[];
  rows: any[][];
  message: string;
}

export default function App() {
  const [sasCode, setSasCode] = useState('');
  const [hiveSQL, setHiveSQL] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('openai/gpt-4.1-mini');
  const [hiveResults, setHiveResults] = useState<HiveResultData | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);
  const [showHiveResults, setShowHiveResults] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const isResizing = useRef(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Domain context state — persisted in localStorage
  const [context, setContext] = useState<ContextFile | null>(() => {
    try {
      const saved = localStorage.getItem('sas-hive-context');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  useEffect(() => {
    if (context) {
      localStorage.setItem('sas-hive-context', JSON.stringify(context));
    } else {
      localStorage.removeItem('sas-hive-context');
    }
  }, [context]);

  // Sidebar drag-to-resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.min(Math.max(ev.clientX, 200), 600);
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `${Date.now()}`;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleTranslate = useCallback(async () => {
    if (!sasCode.trim()) return;
    setIsTranslating(true);
    setHiveSQL('');
    setExplanation('');
    setError(null);
    setHiveResults(null);

    try {
      let fullOutput = '';
      for await (const token of streamTranslation(sasCode, selectedModel, context)) {
        fullOutput += token;
        // Parse <!-- EXPLANATION_START --> ... <!-- EXPLANATION_END --> markers
        const startMarker = '<!-- EXPLANATION_START -->';
        const endMarker = '<!-- EXPLANATION_END -->';
        const startIdx = fullOutput.indexOf(startMarker);
        const endIdx = fullOutput.indexOf(endMarker);
        if (startIdx !== -1 && endIdx !== -1) {
          const explanation = fullOutput.substring(startIdx + startMarker.length, endIdx).trim();
          const sql = fullOutput.substring(endIdx + endMarker.length).trim();
          setExplanation(explanation);
          setHiveSQL(sql);
        } else if (startIdx !== -1) {
          // Explanation is still streaming — show what we have, SQL not yet started
          setExplanation(fullOutput.substring(startIdx + startMarker.length).trim());
        } else {
          // No markers yet — treat whole output as SQL
          setHiveSQL(fullOutput);
        }
      }

      // Final extraction after stream completes
      const startMarker = '<!-- EXPLANATION_START -->';
      const endMarker = '<!-- EXPLANATION_END -->';
      const startIdx = fullOutput.indexOf(startMarker);
      const endIdx = fullOutput.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        setExplanation(fullOutput.substring(startIdx + startMarker.length, endIdx).trim());
        // Strip markdown code fences from SQL block
        const rawSQL = fullOutput.substring(endIdx + endMarker.length).trim();
        const sqlMatch = rawSQL.match(/```sql\s*([\s\S]*?)```/);
        setHiveSQL(sqlMatch ? sqlMatch[1].trim() : rawSQL);
        setShowExplanation(true);
      } else {
        setHiveSQL(fullOutput.trim());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  }, [sasCode, selectedModel, context]);

  // Cmd+Enter / Ctrl+Enter keyboard shortcut for translate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !isTranslating && sasCode.trim()) {
        handleTranslate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleTranslate, isTranslating, sasCode]);

  const handleCopy = async () => {
    if (!hiveSQL) return;
    try {
      await navigator.clipboard.writeText(hiveSQL);
      addToast('success', 'Copied to clipboard');
    } catch {
      addToast('error', 'Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (!hiveSQL) return;
    const blob = new Blob([hiveSQL], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translated.hql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('success', 'Downloaded translated.hql');
  };

  const handleExecute = async () => {
    if (!hiveSQL) return;
    try {
      const results = await executeHiveQuery(hiveSQL);
      setHiveResults(results);
      setShowHiveResults(true);
      addToast('success', 'Query executed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hive execution failed');
      addToast('error', err instanceof Error ? err.message : 'Hive execution failed');
    }
  };

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="app-header">
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
        <img
          src="/assets/revenue-harp-placeholder.svg"
          alt="Revenue"
          className="app-logo"
        />
        <h1>SAS → HiveQL Translation Tool</h1>
        <span className="app-subtitle">Revenue Commissioners</span>
      </header>
      <div className="app-body">
        <aside
          className={`sidebar${sidebarOpen ? '' : ' sidebar--collapsed'}`}
          style={sidebarOpen ? { width: sidebarWidth } : undefined}
        >
          <FileTree onFileSelect={(content) => setSasCode(content)} />
          <FileUpload onFileLoaded={(content) => setSasCode(content)} onToast={addToast} />
          <ContextPanel context={context} onContextChange={setContext} onToast={addToast} />
        </aside>
        {sidebarOpen && (
          <div
            className="sidebar-resize-handle"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        )}
        <main id="main-content" className="main-content">
          <Toolbar
            onTranslate={handleTranslate}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onExecute={handleExecute}
            isTranslating={isTranslating}
            hasOutput={!!hiveSQL}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            contextName={context?.name ?? null}
          />
          <TranslationView
            sasCode={sasCode}
            onSasCodeChange={setSasCode}
            hiveSQL={hiveSQL}
            isTranslating={isTranslating}
            error={error}
          />
          {showExplanation && explanation && (
            <ExplanationPanel
              explanation={explanation}
              onClose={() => setShowExplanation(false)}
            />
          )}
          {showHiveResults && hiveResults && (
            <HiveResults
              results={hiveResults}
              onClose={() => setShowHiveResults(false)}
            />
          )}
        </main>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
