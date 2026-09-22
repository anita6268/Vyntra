import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CameraIcon, CheckIcon, Loader2Icon, XIcon } from "lucide-react";

function CameraCaptureModal({ isOpen, onClose, onCapture, onFallback }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return undefined;
    }

    let cancelled = false;
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera access isn't available. You can choose a photo from Gallery.");
        setCameraUnavailable(true);
        return;
      }

      setStarting(true);
      setError(null);
      setCameraUnavailable(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) {
          stopStream();
          setError("Camera access isn't available. You can choose a photo from Gallery.");
          setCameraUnavailable(true);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isOpen]);

  const close = () => {
    stopStream();
    onClose?.();
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Unable to capture photo. Please try again.");
        return;
      }
      const file = new File([blob], "camera-photo.jpg", { type: "image/jpeg" });
      stopStream();
      onCapture?.(file);
      onClose?.();
    }, "image/jpeg", 0.92);
  };

  return createPortal(
    <>
      {isOpen && (
        <div className="fixed inset-0 z-[var(--z-modal,1600)] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[26px] border border-white/10 bg-[color:var(--panel-strong)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <button type="button" onClick={close} className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-primary)] hover:bg-white/10" aria-label="Close camera">
                <XIcon className="size-4" />
              </button>
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Take profile photo</h3>
              <span className="size-9" />
            </div>
            <div className="p-4">
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                {starting && <div className="flex size-full items-center justify-center"><Loader2Icon className="size-8 animate-spin text-[color:var(--accent-3)]" /></div>}
                <video ref={videoRef} autoPlay muted playsInline className={`size-full object-cover ${starting ? "hidden" : "block"}`} />
              </div>
              {error && <p className="mt-3 text-center text-xs text-rose-400">{error}</p>}
              <button type="button" onClick={capturePhoto} disabled={starting || cameraUnavailable} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                <CheckIcon className="size-4" />
                Take Photo
              </button>
              {cameraUnavailable && (
                <button type="button" onClick={onFallback} className="mt-2 flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-[color:var(--text-primary)] hover:bg-white/10">
                  Choose from Gallery
                </button>
              )}
              <button type="button" onClick={close} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-[color:var(--text-muted)] hover:bg-white/10 hover:text-[color:var(--text-primary)]">
                <CameraIcon className="size-3.5" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

export default CameraCaptureModal;