import { useRef, type DragEvent, type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';
import { uploadFile } from '../api/client';
import './FileUpload.css';

interface FileUploadProps {
  onFileLoaded: (content: string) => void;
  onToast: (type: 'success' | 'error', message: string) => void;
}

export default function FileUpload({ onFileLoaded, onToast }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.sas')) {
      onToast('error', 'Only .sas files are accepted');
      return;
    }

    try {
      const text = await file.text();
      onFileLoaded(text);

      // Also upload to server
      try {
        await uploadFile(file);
      } catch {
        // Upload failure is non-critical
      }

      onToast('success', `Loaded ${file.name}`);
    } catch {
      onToast('error', 'Failed to read file');
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="file-upload">
      <div
        className="drop-zone"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload SAS file — click or drag and drop"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <Upload size={20} aria-hidden="true" />
        <div className="drop-zone-text">Drop .sas file here</div>
        <div>
          or{' '}
          <span className="browse-link">browse</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".sas"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
}
