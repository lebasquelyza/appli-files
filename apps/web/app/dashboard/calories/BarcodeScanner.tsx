"use client";
import * as React from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

type Props = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const codeReaderRef = React.useRef<BrowserMultiFormatReader | null>(null);

  React.useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;
    let stop = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Lecture continue jusqu’à détection
        while (!stop) {
          try {
            const result = await codeReader.decodeOnceFromVideoDevice(undefined, videoRef.current);
            if (result?.getText()) {
              stop = true;
              onDetected(result.getText());
              break;
            }
          } catch {
            // ignore et continue
          }
        }
      } catch {
        // permissions refusées ou pas de caméra
      }
    }
    start();

    return () => {
      stop = true;
      codeReader.reset();
      const tracks = (videoRef.current?.srcObject as MediaStream | null)?.getTracks?.() || [];
      tracks.forEach(t => t.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [onDetected]);

  return (
    <div className="card" style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Scanner un code-barres</strong>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>
      <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000" }} muted playsInline />
      <div className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
        Pointez votre appareil sur le code-barres, la détection est automatique.
      </div>
    </div>
  );
}
