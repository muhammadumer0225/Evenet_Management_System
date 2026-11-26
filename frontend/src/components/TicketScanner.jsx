import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import jsQR from 'jsqr';
import { Modal } from './ui';

export default function TicketScanner({ open, onClose, onDetected }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('Starting camera…');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { onDetectedRef.current = onDetected; }, [onDetected]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let stream = null;
    let frame = 0;
    let stopped = false;
    const stop = () => {
      stopped = true;
      if (frame) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const start = async () => {
      if (!window.isSecureContext) {
        setStatus('Chrome allows camera access only on HTTPS or localhost. Open EventSphere at https:// or http://localhost, then try again.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('Camera access is unavailable in this browser context. Use manual ticket-code entry instead.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        let detector = null;
        if ('BarcodeDetector' in window) {
          try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); }
          catch { detector = null; }
        }
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
          stop();
          setStatus('QR scanning is unavailable in this browser. Use manual ticket-code entry instead.');
          return;
        }
        setStatus(detector
          ? 'Point the camera at the attendee ticket QR code.'
          : 'Using the compatibility QR scanner. Hold the ticket steady in the camera view.');
        let lastScanAt = 0;
        const scan = async (timestamp = 0) => {
          if (stopped) return;
          if (timestamp - lastScanAt >= 180 && video.videoWidth && video.videoHeight) {
            lastScanAt = timestamp;
            try {
              let value = '';
              if (detector) {
                try {
                  const results = await detector.detect(video);
                  value = results.find((item) => item.rawValue)?.rawValue || '';
                } catch {
                  detector = null;
                  setStatus('Switching to the compatibility QR scanner. Hold the ticket steady in the camera view.');
                }
              }
              if (!value) {
                const width = Math.min(video.videoWidth, 720);
                const height = Math.max(1, Math.round(video.videoHeight * width / video.videoWidth));
                if (canvas.width !== width || canvas.height !== height) {
                  canvas.width = width;
                  canvas.height = height;
                }
                context.drawImage(video, 0, 0, width, height);
                const pixels = context.getImageData(0, 0, width, height);
                value = jsQR(pixels.data, width, height, { inversionAttempts: 'dontInvert' })?.data || '';
              }
              if (value) {
                stop();
                onDetectedRef.current?.(value.trim());
                onCloseRef.current?.();
                return;
              }
            } catch {
              setStatus('Unable to read the QR yet. Keep it in frame with good lighting, or enter the code manually.');
            }
          }
          if (!stopped) frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch (error) {
        stop();
        if (error.name === 'NotAllowedError') {
          setStatus('Camera permission was denied. In Chrome, open the site controls beside the address bar, set Camera to Allow, close other apps using the camera, then try again.');
        } else if (error.name === 'NotFoundError') {
          setStatus('No camera was found on this device. Use manual ticket-code entry.');
        } else {
          setStatus('Camera could not start. Check Chrome camera permission and make sure another app is not using the camera.');
        }
      }
    };
    start();
    return stop;
  }, [open, attempt]);

  return (
    <Modal open={open} onClose={onClose} title="Scan attendee ticket" subtitle="Camera scanning requires HTTPS (or localhost) and browser permission." size="md">
      <div className="ticket-scanner">
        <video ref={videoRef} className="ticket-scanner-video" muted playsInline aria-label="Live QR scanner preview" />
        <p className="small muted" role="status" aria-live="polite">{status}</p>
        <div className="row gap-sm" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setAttempt((value) => value + 1)}>Try camera again</button>
          <Camera size={16} aria-hidden="true" /><span className="small">Only the QR value is read; no photo or video is uploaded.</span>
        </div>
      </div>
    </Modal>
  );
}
