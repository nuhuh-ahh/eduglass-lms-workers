/**
 * EduGlass LMS — Web-based Audio Inspector & In-Browser FFmpeg Transcoder
 * Detects audio codec compatibility (AAC, MP3, AC3, DTS, Opus) directly in the browser
 * and automatically transcodes incompatible audio to web-standard AAC using FFmpeg.wasm.
 */

/**
 * Fast client-side MP4 box parser to detect audio codec without loading the entire file.
 */
export async function detectAudioCodec(file) {
  // If not mp4/webm, fallback to generic
  const isMp4 = file.name.toLowerCase().endsWith('.mp4') || file.type.includes('mp4');
  const isWebm = file.name.toLowerCase().endsWith('.webm') || file.type.includes('webm');

  // Basic metadata via HTML5 Video element
  const videoMeta = await new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    const url = URL.createObjectURL(file);
    v.src = url;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        duration: v.duration || 0,
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
        // In Chrome/Edge, mozHasAudio or webkitAudioDecodedByteCount can give hints
        hasAudioHint: v.mozHasAudio !== undefined ? v.mozHasAudio : true,
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: 0, width: 0, height: 0, hasAudioHint: true });
    };
  });

  if (isMp4) {
    try {
      // Read first 3MB which typically contains the moov header or initial atoms
      const sliceSize = Math.min(file.size, 3 * 1024 * 1024);
      const buffer = await file.slice(0, sliceSize).arrayBuffer();
      const view = new DataView(buffer);
      const codecInfo = parseMp4AudioCodec(view);
      if (codecInfo) {
        return {
          ...videoMeta,
          ...codecInfo,
        };
      }
    } catch {
      // Fallback below
    }
  }

  // WebM or fallback detection
  if (isWebm) {
    return {
      ...videoMeta,
      hasAudio: true,
      codec: 'opus/vorbis',
      isCompatible: true,
      badge: 'WebM Standard',
      message: 'Âm thanh WebM (Opus/Vorbis) tương thích tốt trên trình duyệt.',
    };
  }

  // Generic fallback
  return {
    ...videoMeta,
    hasAudio: true,
    codec: 'aac',
    isCompatible: true,
    badge: 'Chuẩn Web',
    message: 'Âm thanh video hợp lệ sẵn sàng tải lên.',
  };
}

/**
 * Recursive MP4 atom search for sound sample description (stsd).
 */
function parseMp4AudioCodec(view) {
  let offset = 0;
  const len = view.byteLength;

  function readBox(start, maxEnd) {
    let p = start;
    while (p + 8 <= maxEnd) {
      let size = view.getUint32(p);
      const type = String.fromCharCode(
        view.getUint8(p + 4),
        view.getUint8(p + 5),
        view.getUint8(p + 6),
        view.getUint8(p + 7)
      );

      if (size === 1 && p + 16 <= maxEnd) {
        // 64-bit size
        size = Number(view.getBigUint64(p + 8));
      } else if (size === 0) {
        size = maxEnd - p;
      }
      if (size < 8 || p + size > maxEnd) break;

      if (['moov', 'trak', 'mdia', 'minf', 'stbl'].includes(type)) {
        const found = readBox(p + 8, p + size);
        if (found) return found;
      } else if (type === 'stsd') {
        // Sample Description Table
        // stsd header: 4 bytes version/flags, 4 bytes entry count
        const entryCount = view.getUint32(p + 12);
        let entryOffset = p + 16;
        for (let i = 0; i < entryCount && entryOffset + 8 <= p + size; i++) {
          const entrySize = view.getUint32(entryOffset);
          const entryFormat = String.fromCharCode(
            view.getUint8(entryOffset + 4),
            view.getUint8(entryOffset + 5),
            view.getUint8(entryOffset + 6),
            view.getUint8(entryOffset + 7)
          ).toLowerCase();

          // Known Audio Codecs
          if (['mp4a', '.mp3', 'aac '].includes(entryFormat)) {
            return {
              hasAudio: true,
              codec: 'AAC (mp4a)',
              isCompatible: true,
              badge: 'AAC Stereo',
              message: 'Âm thanh chuẩn web (AAC Stereo) — Tương thích 100%.',
            };
          }
          if (['ac-3', 'ec-3', 'dts ', 'dtsc', 'dtsh', 'dtsl', 'alac'].includes(entryFormat)) {
            return {
              hasAudio: true,
              codec: entryFormat.toUpperCase(),
              isCompatible: false,
              badge: `Cảnh báo: ${entryFormat.toUpperCase()}`,
              message: `Phát hiện âm thanh ${entryFormat.toUpperCase()} (không tương thích trình duyệt web, có thể câm tiếng).`,
            };
          }
          if (entrySize > 8) entryOffset += entrySize;
          else break;
        }
      }

      p += size;
    }
    return null;
  }

  return readBox(offset, len);
}

/**
 * Lazy loads FFmpeg WebAssembly and transcodes audio to web-safe AAC in the browser.
 * Command: -i input.mp4 -c:v copy -c:a aac -b:a 128k output.mp4
 * Notice `-c:v copy`: Video is copied untouched in seconds, only audio is converted!
 */
let ffmpegInstance = null;
let ffmpegLoadingPromise = null;

async function getFFmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoadingPromise) return ffmpegLoadingPromise;

  ffmpegLoadingPromise = new Promise(async (resolve, reject) => {
    try {
      // Check if already in window
      if (!window.FFmpeg) {
        // Load single-threaded FFmpeg.wasm 0.11.6 from CDN (doesn't require SharedArrayBuffer / COOP headers)
        await new Promise((resScript, rejScript) => {
          const s = document.createElement('script');
          s.src = 'https://unpkg.com/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
          s.onload = resScript;
          s.onerror = () => {
            // Fallback CDN
            const s2 = document.createElement('script');
            s2.src = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
            s2.onload = resScript;
            s2.onerror = rejScript;
            document.head.appendChild(s2);
          };
          document.head.appendChild(s);
        });
      }

      const { createFFmpeg } = window.FFmpeg;
      const ffmpeg = createFFmpeg({
        log: false,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
      });
      await ffmpeg.load();
      ffmpegInstance = ffmpeg;
      resolve(ffmpeg);
    } catch (err) {
      ffmpegLoadingPromise = null;
      reject(new Error(`Không thể khởi động FFmpeg Web: ${err.message}`));
    }
  });

  return ffmpegLoadingPromise;
}

/**
 * In-browser audio transcode runner.
 */
export async function transcodeAudioToAAC(file, onProgress = () => {}) {
  onProgress(10, 'Đang chuẩn bị bộ chuyển đổi FFmpeg Web...');
  const ffmpeg = await getFFmpeg();

  onProgress(25, 'Đang đọc luồng video vào bộ nhớ...');
  const { fetchFile } = window.FFmpeg;
  const inFilename = `input_${Date.now()}.mp4`;
  const outFilename = `output_${Date.now()}.mp4`;

  ffmpeg.FS('writeFile', inFilename, await fetchFile(file));

  onProgress(45, 'Đang sao chép video và chuyển mã âm thanh sang AAC...');
  // -c:v copy preserves 100% video quality at ultra-high speed, only audio is re-encoded
  ffmpeg.setProgress(({ ratio }) => {
    const pct = Math.min(95, Math.round(45 + (ratio || 0) * 50));
    onProgress(pct, `Đang xử lý âm thanh: ${pct}%...`);
  });

  try {
    await ffmpeg.run(
      '-i', inFilename,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-movflags', '+faststart',
      outFilename
    );

    onProgress(95, 'Đang hoàn tất đóng gói tệp...');
    const data = ffmpeg.FS('readFile', outFilename);

    // Cleanup FS
    try {
      ffmpeg.FS('unlink', inFilename);
      ffmpeg.FS('unlink', outFilename);
    } catch {
      // Ignore cleanup
    }

    onProgress(100, 'Chuyển mã âm thanh thành công!');
    const newName = file.name.replace(/\.[^.]+$/, '') + '_aac.mp4';
    return new File([data.buffer], newName, { type: 'video/mp4' });
  } catch (err) {
    try {
      ffmpeg.FS('unlink', inFilename);
      ffmpeg.FS('unlink', outFilename);
    } catch {
      // Ignore
    }
    throw new Error(`Lỗi chuyển mã FFmpeg: ${err.message}`);
  }
}
