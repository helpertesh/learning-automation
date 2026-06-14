import { Upload, File } from 'lucide-react';
import { useRef, useState } from 'react';

export default function FileUpload({ onChange, accept }) {
  const inputRef = useRef();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    setFile(f);
    onChange(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
        dragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      {file ? (
        <div className="flex items-center justify-center gap-2 text-indigo-400">
          <File size={20} />
          <span className="text-sm font-medium">{file.name}</span>
        </div>
      ) : (
        <>
          <Upload size={28} className="mx-auto mb-2 text-slate-500" />
          <p className="text-sm text-slate-400">Drop file here or click to browse</p>
          <p className="mt-1 text-xs text-slate-600">Any file type up to 50MB (PDF, Word, Excel, images, etc.)</p>
        </>
      )}
    </div>
  );
}
