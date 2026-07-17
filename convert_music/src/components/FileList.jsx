import { FileVideo, CheckCircle, Clock, Loader2, Download, AlertCircle } from 'lucide-react';
import './FileList.css';

export const FileList = ({ files }) => {
    if (files.length === 0) return null;

    const renderStatus = (file) => {
        switch(file.status) {
            case 'pending':
                return <span className="status pending"><Clock size={16} /> 待機中</span>;
            case 'converting':
                return (
                    <div className="status converting">
                        <Loader2 size={16} className="spin" /> 
                        変換中 {Math.round(file.progress * 100)}%
                    </div>
                );
            case 'done':
                return <span className="status done"><CheckCircle size={16} /> 完了</span>;
            case 'error':
                return <span className="status error"><AlertCircle size={16} /> エラー</span>;
            default:
                return null;
        }
    };

    return (
        <div className="file-list-container">
            <h3 className="list-title">変換キュー ({files.length} ファイル)</h3>
            <div className="file-list">
                {files.map((file) => (
                    <div key={file.id} className={`file-item ${file.status}`}>
                        <div className="file-info">
                            <div className="file-icon-wrapper">
                                <FileVideo className="file-icon" size={24} />
                            </div>
                            <div className="file-details">
                                <span className="file-name" title={file.file.name}>{file.file.name}</span>
                                <span className="file-size">{(file.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                            </div>
                        </div>
                        <div className="file-actions">
                            {renderStatus(file)}
                            {file.status === 'done' && file.url && (
                                <a href={file.url} download={file.file.name.replace(/\.[^/.]+$/, "") + ".mp3"} className="download-btn">
                                    <Download size={16} /> MP3を保存
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
