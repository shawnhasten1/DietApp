"use client";

import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

type DetectedBarcode = {
  rawValue?: string;
};

type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;
type BarcodeDetectorStatic = BarcodeDetectorConstructor & {
  getSupportedFormats?: () => Promise<string[]>;
};

type BarcodeScannerProps = {
  on_detect: (upc_code: string) => void;
  disabled?: boolean;
};

const NATIVE_BARCODE_FORMATS = ["upc_a", "upc_e", "ean_13", "ean_8"];
const UPC_PATTERN = /^\d{8,14}$/;

function get_barcode_detector_constructor(): BarcodeDetectorConstructor | null {
  const maybe_detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;

  return maybe_detector ?? null;
}

function normalize_upc(value: string): string | null {
  const digits_only = value.replace(/\D/g, "");
  return UPC_PATTERN.test(digits_only) ? digits_only : null;
}

function has_camera_support(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return Boolean(navigator.mediaDevices?.getUserMedia);
}

async function wait_for_video_element(
  get_video: () => HTMLVideoElement | null,
  timeout_ms = 1800,
): Promise<HTMLVideoElement> {
  const start = Date.now();

  while (Date.now() - start < timeout_ms) {
    const video = get_video();
    if (video) {
      return video;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 35);
    });
  }

  throw new Error("Video element not ready.");
}

function get_camera_constraints_candidates(): MediaStreamConstraints[] {
  return [
    {
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    },
    {
      video: {
        facingMode: "environment",
      },
      audio: false,
    },
    {
      video: true,
      audio: false,
    },
  ];
}

function get_scan_error_message(error: unknown): string {
  if (!(error instanceof DOMException)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return `Camera scan failed: ${error.message}`;
    }
    return "Camera scan failed. Check camera permission and try again.";
  }

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission was denied for this site.";
    case "NotReadableError":
      return "Camera is in use by another app/tab. Close it and try again.";
    case "NotFoundError":
      return "No camera device was found.";
    case "OverconstrainedError":
      return "Camera mode not supported on this device. Retrying with fallback mode failed.";
    default:
      return "Camera scan failed. Check camera permission and try again.";
  }
}

async function get_camera_stream_with_fallback(): Promise<MediaStream> {
  const candidates = get_camera_constraints_candidates();
  let last_error: unknown = null;

  for (const constraints of candidates) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last_error = error;
    }
  }

  throw last_error ?? new Error("No camera constraints succeeded.");
}

export function BarcodeScanner({ on_detect, disabled = false }: BarcodeScannerProps) {
  const video_ref = useRef<HTMLVideoElement | null>(null);
  const stream_ref = useRef<MediaStream | null>(null);
  const detector_ref = useRef<BarcodeDetectorInstance | null>(null);
  const poll_timer_ref = useRef<number | null>(null);
  const detecting_ref = useRef(false);
  const zxing_controls_ref = useRef<IScannerControls | null>(null);
  const zxing_running_ref = useRef(false);

  const [is_scanning, set_is_scanning] = useState(false);
  const [scan_error, set_scan_error] = useState<string | null>(null);
  const [scan_error_debug, set_scan_error_debug] = useState<string | null>(null);
  const [scan_engine, set_scan_engine] = useState<"native" | "zxing" | null>(null);
  const [capabilities_ready, set_capabilities_ready] = useState(false);
  const [native_supported, set_native_supported] = useState(false);
  const [scanner_available, set_scanner_available] = useState(false);

  function cleanup_scanner() {
    if (poll_timer_ref.current !== null) {
      window.clearInterval(poll_timer_ref.current);
      poll_timer_ref.current = null;
    }

    if (zxing_controls_ref.current) {
      zxing_controls_ref.current.stop();
      zxing_controls_ref.current = null;
    }

    if (stream_ref.current) {
      for (const track of stream_ref.current.getTracks()) {
        track.stop();
      }
      stream_ref.current = null;
    }

    if (video_ref.current) {
      video_ref.current.srcObject = null;
    }

    detector_ref.current = null;
    detecting_ref.current = false;
    zxing_running_ref.current = false;
    set_scan_engine(null);
  }

  async function detect_once_native() {
    if (!video_ref.current || !detector_ref.current || detecting_ref.current) {
      return;
    }

    if (video_ref.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    detecting_ref.current = true;

    try {
      const detections = await detector_ref.current.detect(video_ref.current);

      for (const detection of detections) {
        if (!detection.rawValue) {
          continue;
        }

        const upc = normalize_upc(detection.rawValue);
        if (!upc) {
          continue;
        }

        on_detect(upc);
        set_is_scanning(false);
        cleanup_scanner();
        return;
      }
    } catch {
      set_scan_error("Could not read barcode yet. Keep barcode centered and try again.");
    } finally {
      detecting_ref.current = false;
    }
  }

  async function start_native_scan() {
    const detector_constructor = get_barcode_detector_constructor() as BarcodeDetectorStatic | null;
    if (!detector_constructor) {
      throw new Error("Native barcode detector unavailable.");
    }

    const stream = await get_camera_stream_with_fallback();

    stream_ref.current = stream;
    let detector_formats = NATIVE_BARCODE_FORMATS;

    if (typeof detector_constructor.getSupportedFormats === "function") {
      const supported_formats = await detector_constructor.getSupportedFormats();
      detector_formats = NATIVE_BARCODE_FORMATS.filter((format) => supported_formats.includes(format));
    }

    detector_ref.current =
      detector_formats.length > 0
        ? new detector_constructor({ formats: detector_formats })
        : new detector_constructor();

    const video_element = await wait_for_video_element(() => video_ref.current);
    video_element.srcObject = stream;
    await video_element.play();

    poll_timer_ref.current = window.setInterval(() => {
      void detect_once_native();
    }, 320);

    set_scan_engine("native");
  }

  async function start_zxing_scan() {
    const video_element = await wait_for_video_element(() => video_ref.current);

    const [{ BrowserMultiFormatReader, BarcodeFormat }] = await Promise.all([
      import("@zxing/browser"),
    ]);

    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 220,
      delayBetweenScanSuccess: 400,
    });

    reader.possibleFormats = [
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
    ];

    let last_error: unknown = null;

    for (const constraints of get_camera_constraints_candidates()) {
      try {
        zxing_running_ref.current = true;
        zxing_controls_ref.current = await reader.decodeFromConstraints(
          constraints,
          video_element,
          (result) => {
            if (!result || !zxing_running_ref.current) {
              return;
            }

            const upc = normalize_upc(result.getText());
            if (!upc) {
              return;
            }

            on_detect(upc);
            set_is_scanning(false);
            cleanup_scanner();
          },
        );
        break;
      } catch (error) {
        last_error = error;
      }
    }

    if (!zxing_controls_ref.current) {
      throw last_error ?? new Error("ZXing scanner could not start.");
    }

    set_scan_engine("zxing");
  }

  async function start_scanner() {
    if (!scanner_available || disabled) {
      return;
    }

    set_scan_error(null);
    set_scan_error_debug(null);
    set_is_scanning(true);

    let native_error: unknown = null;

    try {
      if (native_supported) {
        try {
          await start_native_scan();
          return;
        } catch (error) {
          native_error = error;
          cleanup_scanner();
        }
      }

      await start_zxing_scan();
    } catch (zxing_error) {
      const final_error = zxing_error ?? native_error;
      set_scan_error(get_scan_error_message(final_error));
      set_scan_error_debug(
        final_error instanceof Error
          ? `${final_error.name}: ${final_error.message}`
          : final_error instanceof DOMException
            ? `${final_error.name}: ${final_error.message}`
            : "Unknown scanner error",
      );
      cleanup_scanner();
      set_is_scanning(false);
    }
  }

  function stop_scanner() {
    set_is_scanning(false);
    cleanup_scanner();
  }

  useEffect(() => {
    set_native_supported(Boolean(get_barcode_detector_constructor()));
    set_scanner_available(has_camera_support());
    set_capabilities_ready(true);

    return () => {
      cleanup_scanner();
    };
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Camera Scan</p>
        {!is_scanning ? (
          <button
            type="button"
            disabled={!capabilities_ready || !scanner_available || disabled}
            onClick={() => {
              void start_scanner();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            Scan Barcode
          </button>
        ) : (
          <button
            type="button"
            onClick={stop_scanner}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Stop
          </button>
        )}
      </div>

      {capabilities_ready && !scanner_available ? (
        <p className="mt-2 text-xs text-slate-600">
          Camera scan is unavailable on this browser/device. Use manual UPC entry.
        </p>
      ) : null}

      {scan_error ? <p className="mt-2 text-xs text-rose-700">{scan_error}</p> : null}
      {scan_error_debug ? <p className="mt-1 text-[11px] text-slate-500">{scan_error_debug}</p> : null}

      {is_scanning ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-black">
          <video ref={video_ref} className="h-56 w-full object-cover" playsInline muted />
          <p className="bg-slate-900 px-3 py-2 text-xs text-slate-100">
            {scan_engine === "zxing"
              ? "Scanning with compatibility mode. Hold barcode steady."
              : "Point camera at UPC barcode."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
