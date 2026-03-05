import './HiveResults.css';

interface HiveResultsProps {
  results: {
    columns: string[];
    rows: any[][];
    message: string;
  };
  onClose: () => void;
}

export default function HiveResults({ results, onClose }: HiveResultsProps) {
  return (
    <div className="hive-results">
      <div className="hive-results-header">
        <span>Query Results</span>
        <button className="hive-results-close" onClick={onClose}>
          ×
        </button>
      </div>
      {results.message && (
        <div className="hive-results-message">{results.message}</div>
      )}
      <div className="results-table-container">
        <table className="results-table">
          <thead>
            <tr>
              {results.columns.map((col, i) => (
                <th key={i}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{String(cell ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
