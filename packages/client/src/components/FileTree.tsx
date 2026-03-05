import { useState, useEffect, useCallback } from 'react';
import { Folder, FolderOpen, FileText, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { fetchFileTree, fetchFileContent, type FileNode } from '../api/client';
import './FileTree.css';

interface FileTreeProps {
  onFileSelect: (content: string) => void;
}

interface TreeNodeProps {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: FileNode) => void;
}

function TreeNode({ node, depth, selectedPath, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const isDirectory = node.type === 'directory';
  const isSelected = node.path === selectedPath;

  const handleClick = () => {
    if (isDirectory) {
      setExpanded((prev) => !prev);
    } else {
      onSelect(node);
    }
  };

  return (
    <>
      <div
        className={`tree-node${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        role={isDirectory ? 'button' : 'option'}
        tabIndex={0}
        aria-expanded={isDirectory ? expanded : undefined}
        aria-selected={isSelected}
      >
        <span className="tree-node-icon" aria-hidden="true">
          {isDirectory
            ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />)
            : <FileText size={14} />}
        </span>
        <span className="tree-node-name">{node.name}</span>
        {isDirectory && (
          <span className="tree-node-chevron" aria-hidden="true">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
      </div>
      {isDirectory && expanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  );
}

export default function FileTree({ onFileSelect }: FileTreeProps) {
  const [tree, setTree] = useState<FileNode[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchFileTree();
      setTree(data);
    } catch {
      // Tree loading failed — leave empty
      setTree([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleSelect = async (node: FileNode) => {
    setSelectedPath(node.path);
    try {
      const content = await fetchFileContent(node.path);
      onFileSelect(content);
    } catch {
      // Ignore fetch errors
    }
  };

  return (
    <div className="file-tree">
      <div className="file-tree-header">
        <span>File Browser</span>
        <button
          className="btn-secondary"
          style={{ padding: '2px 6px', fontSize: '11px' }}
          onClick={loadTree}
          disabled={loading}
          aria-label="Refresh file tree"
          title="Refresh"
        >
          <RefreshCw size={11} aria-hidden="true" />
        </button>
      </div>
      {loading && (
        <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Loading…
        </div>
      )}
      {tree && tree.length === 0 && !loading && (
        <div style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          No files found
        </div>
      )}
      {tree &&
        tree.map((node) => (
          <TreeNode
            key={node.path}
            node={node}
            depth={0}
            selectedPath={selectedPath}
            onSelect={handleSelect}
          />
        ))}
    </div>
  );
}
