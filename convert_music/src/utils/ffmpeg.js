import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg = null;

export const getFFmpeg = () => {
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
    }
    return ffmpeg;
};

export const loadFFmpeg = async (onProgress) => {
    const ffmpeg = getFFmpeg();
    if (!ffmpeg.loaded) {
        ffmpeg.on('progress', ({ progress, time }) => {
            if (onProgress) onProgress(progress);
        });

        // Use core for single threaded version which avoids SharedArrayBuffer/CORS requirements
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
    }
    return ffmpeg;
};

export const convertToMp3 = async (file, onProgress) => {
    const ffmpeg = await loadFFmpeg(onProgress);
    
    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `output_${Date.now()}.mp3`;

    try {
        // Write file to memory
        await ffmpeg.writeFile(inputName, await fetchFile(file));

        // Run conversion
        await ffmpeg.exec(['-i', inputName, '-q:a', '0', '-map', 'a', outputName]);

        // Read result
        const data = await ffmpeg.readFile(outputName);

        // Clean up
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);

        // Return as blob
        return new Blob([data.buffer], { type: 'audio/mp3' });
    } catch (error) {
        console.error("Conversion error:", error);
        throw error;
    }
};
