import './ExplanationPanel.css';

interface ExplanationPanelProps {
  explanation: string;
  onClose: () => void;
}

export default function ExplanationPanel({ explanation, onClose }: ExplanationPanelProps) {
  return (
    <div className="explanation-panel">
      <div className="explanation-header">
        <span>Translation Explanation</span>
        <button className="explanation-close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="explanation-body">{explanation}</div>
    </div>
  );
}
