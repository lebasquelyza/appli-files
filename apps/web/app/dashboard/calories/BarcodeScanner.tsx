// app/dashboard/calories/BarcodeScanner.tsx
"use client";
import * as React from "react";

/** Types min pour les anciens TS si BarcodeDetector n'est pas dans lib.dom.d.ts */
type DetectedBarcode = { rawValue: string; format?: string };
type BarcodeDetectorCtor =
  | (new (opts?: { formats?: string[] }) => {
      detect(source: CanvasImageSource | ImageBitmap | ImageData | HTMLVideoElement | HTMLImageElement): Promise<DetectedBarcode[]>;
    })
  | undefined;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

type Props = {
  onDetected: (barcode: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const [supported, setSupported] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [manual, setManual] = React.useState("");

  React.useEffect(() => {
    const has = typeof window !== "undefined" && !!window.BarcodeDetector;
    setSupported(has);
    if (!has) return;

    let stopped = false;
    const Detector = window.BarcodeDetector!;
    const detector = new Detector({
      formats: [
        "ean_13", "ean_8", "upc_e", "upc_a",
        "code_128", "code_39", "itf", "qr_code",
      ],
    } as any);

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (stopped) return;
          try {
            const el = videoRef.current!;
            if (el.readyState >= 2) {
              const codes = await detector.detect(el as any);
              if (codes && codes.length) {
                const code = (codes[0].rawValue || "").trim();
                if (code) {
                  stopped = true;
                  onDetected(code);
                  return cleanup();
                }
              }
            }
          } catch {
            // ignore et continue
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        setError("Caméra indisponible ou permissions refusées.");
      }
    }

    start();

    function cleanup() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const tracks = streamRef.current?.getTracks?.() || [];
      tracks.forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    }

    return cleanup;
  }, [onDetected]);

  return (
    <div className="card" style={{ padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Scanner un code-barres</strong>
        <button className="btn" onClick={onClose}>Fermer</button>
      </div>

      {supported === false && (
        <div className="text-xs" style={{ color: "#92400e", background: "#fef3c7", border: "1px solid #f59e0b55", padding: 8, borderRadius: 6, marginBottom: 8 }}>
          Le scanner natif n’est pas supporté sur cet appareil/navigateur.
          <br />
          Saisis le code-barres manuellement ou prends une photo de l’étiquette.
        </div>
      )}

      {supported !== false && (
        <video
          ref={videoRef}
          style={{ width: "100%", borderRadius: 8, background: "#000" }}
          muted
          playsInline
        />
      )}

      {error && <div className="text-xs" style={{ color: "#dc2626", marginTop: 6 }}>{error}</div>}

      {/* Fallback manuel (toujours visible au cas où) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginTop: 10 }}>
        <input
          className="input"
          type="text"
          inputMode="numeric"
          placeholder="Saisir le code-barres (ex: 3228857000856)"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\s+/g, ""))}
        />
        <button
          className="btn"
          onClick={() => {
            const s = manual.trim();
            if (/^\d{8,14}$/.test(s)) onDetected(s);
            else setError("Code-barres invalide (8 à 14 chiffres).");
          }}
        >
          Utiliser
        </button>
      </div>

      <div className="text-xs" style={{ color: "#6b7280", marginTop: 6 }}>
        Astuce : approche bien le code et évite les reflets.
      </div>
    </div>
  );
}
