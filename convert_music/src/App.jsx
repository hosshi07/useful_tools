import { useState, useEffect, useRef } from 'react';
import { DropZone } from './components/DropZone';
import { FileList } from './components/FileList';
import { convertToMp3 } from './utils/ffmpeg';
import { Music } from 'lucide-react';
import './App.css';

function App() {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const queueRef = useRef([]);

  useEffect(() => {
    queueRef.current = files;
  }, [files]);

  const handleFilesAdded = (newFiles) => {
    const newItems = newFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'pending', // pending, converting, done, error
      progress: 0,
      url: null
    }));
    setFiles(prev => [...prev, ...newItems]);
  };

  useEffect(() => {
    if (!isProcessing) {
      processQueue();
    }
  }, [files, isProcessing]);

  const processQueue = async () => {
    const pendingFiles = queueRef.current.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);
    const targetFile = pendingFiles[0];

    updateFile(targetFile.id, { status: 'converting', progress: 0 });

    try {
      const blob = await convertToMp3(targetFile.file, (progress) => {
        updateFile(targetFile.id, { progress });
      });
      
      const url = URL.createObjectURL(blob);
      updateFile(targetFile.id, { status: 'done', progress: 1, url });
    } catch (error) {
      updateFile(targetFile.id, { status: 'error' });
    }

    setIsProcessing(false);
  };

  const updateFile = (id, updates) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  return (
    <div className="app-container">
      <div className="background-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon-wrapper">
            <Music className="logo-icon" size={28} />
          </div>
          <h1>Audioify</h1>
        </div>
        <p className="subtitle">高性能ブラウザ内蔵 MP4 → MP3 コンバーター</p>
      </header>

      <main className="main-content">
        <DropZone onFilesAdded={handleFilesAdded} />
        <FileList files={files} />
      </main>

      <footer className="footer">
        <p>変換処理はすべてお使いのブラウザ上で行われます。データが外部サーバーに送信されることはありません。</p>
      </footer>
    </div>
  );
}

export default App;
