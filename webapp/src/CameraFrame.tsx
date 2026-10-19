import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { fileToJpeg, frameToJpeg } from './photos';
import { Icon } from './ui';

export function CameraFrame({
  photoUrl,
  enabled,
  onCaptured,
  onCleared,
}: {
  photoUrl: string | null;
  enabled: boolean;
  onCaptured: (blob: Blob) => void;
  onCleared: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'idle' | 'starting' | 'live'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setReady(false);
    setMode('idle');
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (photoUrl) stop();
  }, [photoUrl, stop]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'visible') stop();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  useEffect(() => {
    const video = videoRef.current;
    if (mode !== 'live' || !video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    void video.play().catch(() => {
      setError('カメラを起動できませんでした');
      stop();
    });
  }, [mode, stop]);

  async function start() {
    if (!enabled || mode !== 'idle') return;
    setError(null);
    setMode('starting');
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('idle');
      setError('カメラを起動できませんでした');
      return;
    }
    try {
      const stream = await openCamera();
      if (!enabled) {
        stream.getTracks().forEach((track) => track.stop());
        setMode('idle');
        return;
      }
      streamRef.current = stream;
      setMode('live');
    } catch {
      setMode('idle');
      setError('カメラを起動できませんでした');
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || capturing || !ready) return;
    setCapturing(true);
    try {
      const blob = await frameToJpeg(video);
      stop();
      onCaptured(blob);
    } catch {
      setError('撮影に失敗しました');
    } finally {
      setCapturing(false);
    }
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      onCaptured(await fileToJpeg(file));
    } catch {
      setError('写真を読み込めませんでした');
    }
  }

  return (
    <div className="camera">
      {photoUrl ? (
        <>
          <img className="camera-fill" src={photoUrl} alt="撮影した薬の写真" />
          <button type="button" className="retake" onClick={onCleared} disabled={!enabled}>
            <Icon name="refresh" size={18} />
            撮り直す
          </button>
        </>
      ) : mode === 'live' ? (
        <>
          <video
            ref={videoRef}
            className="camera-fill"
            playsInline
            muted
            autoPlay
            onLoadedMetadata={() => setReady(true)}
          />
          <div className="camera-controls">
            <button type="button" className="cam-side" onClick={stop} aria-label="カメラを閉じる">
              <Icon name="close" />
            </button>
            <button
              type="button"
              className="shutter"
              onClick={() => void capture()}
              disabled={!ready || capturing}
              aria-label="撮影する"
            >
              {capturing ? <span className="spinner white" /> : <Icon name="photo_camera" size={28} />}
            </button>
            <span className="cam-spacer" />
          </div>
        </>
      ) : mode === 'starting' ? (
        <div className="spinner" />
      ) : (
        <div className="camera-idle">
          <button type="button" className="camera-open" onClick={() => void start()} disabled={!enabled}>
            <span className="camera-badge">
              <Icon name="add_a_photo" size={40} />
            </span>
            <span className={error ? 'camera-error' : 'camera-label'}>
              {error ?? 'タップして薬の写真を撮る'}
            </span>
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => fileRef.current?.click()}
            disabled={!enabled}
          >
            アルバムから選ぶ
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="image/*"
            tabIndex={-1}
            onChange={(event) => void onFile(event)}
          />
        </div>
      )}
    </div>
  );
}

async function openCamera(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
  }
}
