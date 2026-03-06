import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Search, ChevronRight, ArrowRight, AlertTriangle } from 'lucide-react';
import { PATTERNS, PATTERN_CATEGORIES, type SasPattern } from '../lib/pattern-library';
import './PatternLibrary.css';

interface PatternLibraryProps {
  onLoadPattern: (sasCode: string) => void;
  isVisible: boolean;
  onClose: () => void;
}

export default function PatternLibrary({ onLoadPattern, isVisible, onClose }: PatternLibraryProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus search input when panel opens
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => searchRef.current?.focus(), 100);
    } else {
      setSearch('');
      setActiveCategory(null);
    }
  }, [isVisible]);

  const filteredPatterns = useMemo(() => {
    if (!search.trim()) return PATTERNS;
    const q = search.toLowerCase();
    return PATTERNS.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.includes(q)) ||
        p.sasCode.toLowerCase().includes(q) ||
        p.hiveCode.toLowerCase().includes(q),
    );
  }, [search]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of PATTERN_CATEGORIES) counts[cat] = 0;
    for (const p of filteredPatterns) counts[p.category] = (counts[p.category] || 0) + 1;
    return counts;
  }, [filteredPatterns]);

  const scrollToCategory = useCallback((cat: string) => {
    setActiveCategory(cat);
    const el = contentRef.current?.querySelector(`[data-category="${cat}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const visibleCategories = PATTERN_CATEGORIES.filter((cat) => categoryCounts[cat] > 0);

  return (
    <div className="pattern-overlay" role="dialog" aria-label="SAS Pattern Library" aria-modal="true">
      <div className="pattern-panel">
        <header className="pattern-header">
          <h2 className="pattern-title">SAS Pattern Library</h2>
          <button className="pattern-close" onClick={onClose} aria-label="Close pattern library">
            <X size={18} />
          </button>
        </header>

        <div className="pattern-body">
          <nav className="pattern-sidebar" aria-label="Pattern categories">
            <ul className="pattern-cat-list">
              {PATTERN_CATEGORIES.map((cat) => (
                <li key={cat}>
                  <button
                    className={`pattern-cat-btn${activeCategory === cat ? ' pattern-cat-btn--active' : ''}${categoryCounts[cat] === 0 ? ' pattern-cat-btn--empty' : ''}`}
                    onClick={() => scrollToCategory(cat)}
                    disabled={categoryCounts[cat] === 0}
                  >
                    <ChevronRight size={12} aria-hidden="true" />
                    <span className="pattern-cat-label">{cat}</span>
                    <span className="pattern-cat-count">{categoryCounts[cat]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="pattern-content" ref={contentRef}>
            <div className="pattern-search-wrap">
              <Search size={14} aria-hidden="true" />
              <input
                ref={searchRef}
                type="search"
                className="pattern-search"
                placeholder="Search patterns…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search patterns"
              />
            </div>

            {visibleCategories.length === 0 && (
              <p className="pattern-empty">No patterns match your search.</p>
            )}

            {visibleCategories.map((cat) => (
              <section key={cat} data-category={cat} className="pattern-section">
                <h3 className="pattern-section-title">{cat}</h3>
                {filteredPatterns
                  .filter((p) => p.category === cat)
                  .map((p) => (
                    <PatternCard key={p.id} pattern={p} onLoad={onLoadPattern} />
                  ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PatternCard({ pattern, onLoad }: { pattern: SasPattern; onLoad: (code: string) => void }) {
  return (
    <article className="pattern-card">
      <h4 className="pattern-card-title">{pattern.title}</h4>
      <p className="pattern-card-desc">{pattern.description}</p>

      <div className="pattern-card-code">
        <div className="pattern-code-block">
          <span className="pattern-code-label">SAS</span>
          <pre><code>{pattern.sasCode}</code></pre>
        </div>
        <div className="pattern-code-block">
          <span className="pattern-code-label">HiveQL</span>
          <pre><code>{pattern.hiveCode}</code></pre>
        </div>
      </div>

      {pattern.notes && (
        <div className="pattern-card-notes" role="note">
          <AlertTriangle size={14} aria-hidden="true" />
          <span>{pattern.notes}</span>
        </div>
      )}

      <button className="pattern-card-load" onClick={() => onLoad(pattern.sasCode)}>
        Load into Editor
        <ArrowRight size={14} aria-hidden="true" />
      </button>
    </article>
  );
}
