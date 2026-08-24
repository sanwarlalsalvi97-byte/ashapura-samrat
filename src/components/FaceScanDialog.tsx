import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, RefreshCw, Check } from "lucide-react";
import { ensureCameraPermission } from "@/lib/permissions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Returns the captured selfie as a JPEG blob. */
  onCaptured: (blob: Blob) => void;
}

export default function FaceScanDialog({ open, onOpenChange, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; blob: Blob } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setShot(null);
    try {
      await ensureCameraPermission();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "कैमरा नहीं खुला");
    }
  }, []);

  useEffect(() => {
    if (open) void start();
    return () => stop();
  }, [open, start, stop]);

  const capture = () => {
    const v = videoRef.current;
    if (!v) return;
    const size = Math.min(v.videoWidth, v.videoHeight) || 480;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, (v.videoWidth - size) / 2, (v.videoHeight - size) / 2, size, size, 0, 0, size, size);
    canvas.toBlob((blob) => {
      if (!blob) return;
      stop();
      setShot({ url: URL.createObjectURL(blob), blob });
    }, "image/jpeg", 0.82);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stop(); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">फेस स्कैन हाजिरी</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-muted">
            {shot ? (
              <img src={shot.url} alt="कैप्चर की गई फेस स्कैन फोटो" className="h-full w-full object-cover" />
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="h-full w-full object-cover [transform:scaleX(-1)]"
              />
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {shot ? (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={start}>
                <RefreshCw className="mr-2 h-4 w-4" /> दोबारा
              </Button>
              <Button onClick={() => { onCaptured(shot.blob); onOpenChange(false); }}>
                <Check className="mr-2 h-4 w-4" /> उपयोग करें
              </Button>
            </div>
          ) : (
            <Button className="w-full" disabled={!ready} onClick={capture}>
              <Camera className="mr-2 h-4 w-4" /> फोटो लें
            </Button>
          )}
          <p className="text-center text-[11px] text-muted-foreground">
            फोटो के साथ GPS लोकेशन और समय अपने आप सेव होगा।
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
