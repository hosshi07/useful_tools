import { UploadCloud } from 'lucide-react';
import { useCallback, useState } from 'react';
import './DropZone.css';

export const DropZone = ({ onFilesAdded }) => {
    const [isDragActive, setIsDragActive] = useState(false);

    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(file => file.type.includes('video/') || file.name.toLowerCase().endsWith('.mp4'));
            if (files.length > 0) {
                onFilesAdded(files);
            }
        }
    }, [onFilesAdded]);

    const handleChange = useCallback((e) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            onFilesAdded(files);
        }
    }, [onFilesAdded]);

    return (
        <div 
            className={`dropzone ${isDragActive ? 'active' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            <input 
                type="file" 
                multiple 
                accept="video/mp4,video/*" 
                onChange={handleChange} 
                className="file-input"
                id="fileInput"
            />
            <label htmlFor="fileInput" className="dropzone-content">
                <div className="icon-container">
                    <UploadCloud size={48} className="upload-icon" />
                </div>
                <h3>動画ファイルをドロップして追加</h3>
                <p>またはクリックしてファイルを選択 (複数選択可)</p>
            </label>
        </div>
    );
};
