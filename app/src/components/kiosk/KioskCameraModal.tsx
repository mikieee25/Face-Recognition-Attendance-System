"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { CaptureResultData } from "@/app/kiosk/page";

interface Props {
  open: boolean;
  type: "time_in" | "time_out";
  onClose: () => void;
  onResult: (data: CaptureResultData) => void;
}

const AUTO_CLOSE_SEC = 5;
const BLINK_TARGET = 2;
const EYE_CLOSED_THRESHOLD = 0.45;
const EYE_OPEN_THRESHOLD = 0.2;
const EYE_CLOSED_EAR_THRESHOLD = 0.18;
const EYE_OPEN_EAR_THRESHOLD = 0.24;
const MIN_BLINK_CLOSED_MS = 80;
const MAX_BLINK_CLOSED_MS = 1200;
const MAX_RECOVERY_RETRIES = 3;
const RECOVERY_RETRY_DELAY_MS = 450;
const MEDIAPIPE_WASM_ROOT =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm";
const FACELANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const TFLITE_XNNPACK_INFO = "Created TensorFlow Lite XNNPACK delegate for CPU.";

type Phase = "init" | "detecting" | "processing" | "result";
type LandmarkerState = "idle" | "loading" | "ready" | "error";

type BlendshapeCategory = {
  categoryName: string;
  score: number;
};

type FaceBlendshape = {
  categories?: BlendshapeCategory[];
};

type FaceLandmarkerResult = {
  faceBlendshapes?: FaceBlendshape[];
  faceLandmarks?: NormalizedLandmark[][];
};

type FaceLandmarkerInstance = {
  detectForVideo(
    video: HTMLVideoElement,
    timestampMs: number,
  ): FaceLandmarkerResult;
  close?: () => void;
};

type NormalizedLandmark = {
  x: number;
  y: number;
  z?: number;
};

type BlinkMetrics = {
  blinkScore: number | null;
  ear: number | null;
  hasFace: boolean;
};

const LEFT_EYE_INDICES = {
  horizontal: [33, 133] as const,
  verticalA: [159, 145] as const,
  verticalB: [158, 153] as const,
};

const RIGHT_EYE_INDICES = {
  horizontal: [362, 263] as const,
  verticalA: [386, 374] as const,
  verticalB: [385, 380] as const,
};

function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getEyeAspectRatio(
  landmarks: NormalizedLandmark[],
  indices: {
    horizontal: readonly [number, number];
    verticalA: readonly [number, number];
    verticalB: readonly [number, number];
  },
): number | null {
  const horizontalStart = landmarks[indices.horizontal[0]];
  const horizontalEnd = landmarks[indices.horizontal[1]];
  const verticalAStart = landmarks[indices.verticalA[0]];
  const verticalAEnd = landmarks[indices.verticalA[1]];
  const verticalBStart = landmarks[indices.verticalB[0]];
  const verticalBEnd = landmarks[indices.verticalB[1]];

  if (
    !horizontalStart ||
    !horizontalEnd ||
    !verticalAStart ||
    !verticalAEnd ||
    !verticalBStart ||
    !verticalBEnd
  ) {
    return null;
  }

  const horizontalDistance = distance(horizontalStart, horizontalEnd);
  if (horizontalDistance <= 0) return null;

  const verticalDistanceA = distance(verticalAStart, verticalAEnd);
  const verticalDistanceB = distance(verticalBStart, verticalBEnd);

  return (verticalDistanceA + verticalDistanceB) / (2 * horizontalDistance);
}

function getBlinkMetrics(result: FaceLandmarkerResult): BlinkMetrics {
  const hasFace =
    Boolean(result.faceLandmarks?.[0]?.length) ||
    Boolean(result.faceBlendshapes?.[0]);

  const categories = result.faceBlendshapes?.[0]?.categories;
  const blinkScore = categories?.length
    ? ((categories.find((item) => item.categoryName === "eyeBlinkLeft")
        ?.score ?? 0) +
        (categories.find((item) => item.categoryName === "eyeBlinkRight")
          ?.score ?? 0)) /
      2
    : null;

  const landmarks = result.faceLandmarks?.[0];
  if (!landmarks?.length) {
    return { blinkScore, ear: null, hasFace };
  }

  const leftEar = getEyeAspectRatio(landmarks, LEFT_EYE_INDICES);
  const rightEar = getEyeAspectRatio(landmarks, RIGHT_EYE_INDICES);
  const ear =
    leftEar !== null && rightEar !== null ? (leftEar + rightEar) / 2 : null;

  return { blinkScore, ear, hasFace };
}

function getEyeStatusText(
  blinkScore: number | null,
  ear: number | null,
  eyesClosedRef: { current: boolean },
): string {
  if (blinkScore === null && ear === null) {
    return "Waiting for eyes…";
  }

  const eyesClosed =
    (blinkScore !== null && blinkScore >= EYE_CLOSED_THRESHOLD) ||
    (ear !== null && ear <= EYE_CLOSED_EAR_THRESHOLD);

  if (eyesClosed) {
    return "Eyes Closed — Blink detected";
  }

  return "Eyes Open — Ready to blink";
}

function getCameraAccessErrorMessage(err: unknown): string {
  const name =
    err instanceof DOMException
      ? err.name
      : typeof err === "object" &&
          err !== null &&
          "name" in err &&
          typeof (err as { name?: unknown }).name === "string"
        ? ((err as { name: string }).name as string)
        : "";

  if (!window.isSecureContext) {
    return "Camera needs HTTPS on iPhone Safari. If you opened the site via a local IP like http://192.168.x.x, switch to HTTPS or a secure tunnel.";
  }

  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission was blocked. In Safari, allow camera access for this site, then try again.";
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is busy or unavailable right now. Close other apps using the camera, then try again.";
  }

  return "Camera access failed. Please allow camera access and try again.";
}

function withSuppressedTfliteInfoLog<T>(
  operation: () => Promise<T>,
): Promise<T>;
function withSuppressedTfliteInfoLog<T>(operation: () => T): T;
function withSuppressedTfliteInfoLog<T>(operation: () => T): T {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const firstArg = args[0];
    if (
      typeof firstArg === "string" &&
      firstArg.includes(TFLITE_XNNPACK_INFO)
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  try {
    const result = operation();
    if (result instanceof Promise) {
      return result.finally(() => {
        console.error = originalConsoleError;
      }) as T;
    }

    console.error = originalConsoleError;
    return result;
  } catch (error) {
    console.error = originalConsoleError;
    throw error;
  }
}

export default function KioskCameraModal({
  open,
  type,
  onClose,
  onResult,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarkerInstance | null>(null);
  const landmarkerLoadPromiseRef =
    useRef<Promise<FaceLandmarkerInstance | null> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const blinkLoopTokenRef = useRef(0);
  const recoveryTimerRef = useRef<number | null>(null);
  const recoveryAttemptsRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const blinkCountRef = useRef(0);
  const faceDetectedRef = useRef(false);
  const eyesClosedRef = useRef(false);
  const eyesClosedAtRef = useRef<number | null>(null);
  const captureTriggeredRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("init");
  const [autoClose, setAutoClose] = useState(AUTO_CLOSE_SEC);
  const [resultData, setResultData] = useState<CaptureResultData | null>(null);
  const [landmarkerState, setLandmarkerState] =
    useState<LandmarkerState>("idle");
  const [blinkCount, setBlinkCount] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [blinkDebug, setBlinkDebug] = useState<{
    blinkScore: number | null;
    ear: number | null;
  }>({ blinkScore: null, ear: null });
  const [guidanceText, setGuidanceText] = useState("Loading blink detection…");

  const stopBlinkLoop = useCallback(() => {
    blinkLoopTokenRef.current += 1;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const resetBlinkState = useCallback(() => {
    stopBlinkLoop();
    lastVideoTimeRef.current = -1;
    blinkCountRef.current = 0;
    faceDetectedRef.current = false;
    eyesClosedRef.current = false;
    eyesClosedAtRef.current = null;
    captureTriggeredRef.current = false;
    setBlinkCount(0);
    setFaceDetected(false);
    setBlinkDebug({ blinkScore: null, ear: null });
    setGuidanceText("Center your face, then blink twice to capture.");
  }, [stopBlinkLoop]);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cleanup = useCallback(() => {
    stopBlinkLoop();
    clearRecoveryTimer();
    recoveryAttemptsRef.current = 0;
    stopStream();
    setPhase("init");
    setAutoClose(AUTO_CLOSE_SEC);
    setResultData(null);
    resetBlinkState();
  }, [clearRecoveryTimer, resetBlinkState, stopBlinkLoop, stopStream]);

  const loadLandmarker = useCallback(async () => {
    if (landmarkerRef.current) {
      setLandmarkerState("ready");
      return landmarkerRef.current;
    }

    if (landmarkerLoadPromiseRef.current) {
      return landmarkerLoadPromiseRef.current;
    }

    setLandmarkerState("loading");
    setGuidanceText("Loading blink detection…");

    const loadPromise = (async () => {
      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset =
          await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_ROOT);
        const landmarker = await withSuppressedTfliteInfoLog(() =>
          vision.FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: FACELANDMARKER_MODEL_URL,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces: 1,
            minFaceDetectionConfidence: 0.35,
            minFacePresenceConfidence: 0.35,
            minTrackingConfidence: 0.35,
            outputFaceBlendshapes: true,
          }),
        );

        recoveryAttemptsRef.current = 0;
        landmarkerRef.current = landmarker as FaceLandmarkerInstance;
        setLandmarkerState("ready");
        setGuidanceText("Center your face, then blink twice to capture.");
        return landmarkerRef.current;
      } catch {
        setLandmarkerState("error");
        setGuidanceText(
          "Blink detection failed to load. You can still use Capture Now.",
        );
        return null;
      } finally {
        landmarkerLoadPromiseRef.current = null;
      }
    })();

    landmarkerLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, []);

  // Start camera when modal opens
  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        resetBlinkState();
        setPhase("detecting");
        void loadLandmarker();
      } catch (err: unknown) {
        if (!cancelled) {
          setPhase("init");
          setGuidanceText(getCameraAccessErrorMessage(err));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cleanup, loadLandmarker, resetBlinkState]);

  useEffect(() => {
    return () => {
      stopBlinkLoop();
      clearRecoveryTimer();
      void withSuppressedTfliteInfoLog(() => {
        landmarkerRef.current?.close?.();
      });
      landmarkerRef.current = null;
    };
  }, [clearRecoveryTimer, stopBlinkLoop]);

  // Auto-close timer
  useEffect(() => {
    if (phase !== "result") return;
    if (autoClose <= 0) {
      handleClose();
      return;
    }
    const id = setTimeout(() => setAutoClose((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, autoClose]);

  const captureFrame = useCallback(async () => {
    if (captureTriggeredRef.current && phase === "processing") return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    captureTriggeredRef.current = true;
    setPhase("processing");
    setGuidanceText("Capturing and processing face recognition…");
    stopBlinkLoop();

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 640, 480);
    const imageData = canvas.toDataURL("image/jpeg", 0.9);
    stopStream();

    try {
      const res = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
        "/api/v1/attendance/capture",
        { image: imageData, type },
      );
      const raw = res.data.data ?? {};

      // The API returns an AttendanceRecord or PendingApproval object.
      // Map it to CaptureResultData for the UI.
      const isConfirmed = raw.status === "confirmed";
      const isPending =
        raw.reviewStatus === "pending" || raw.status === "pending";
      const recordType = (raw.type as string) ?? type;

      const data: CaptureResultData = {
        success: true,
        action: isConfirmed
          ? recordType === "time_in"
            ? "Time In Recorded"
            : "Time Out Recorded"
          : isPending
            ? "Sent for Admin Review"
            : "Attendance Recorded",
        type: recordType as "time_in" | "time_out",
        confidence: raw.confidence as number | undefined,
        status: isConfirmed ? "confirmed" : isPending ? "pending" : undefined,
      };
      setResultData(data);
      onResult(data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Network error";
      const data: CaptureResultData = { success: false, error: msg };
      setResultData(data);
      onResult(data);
    }
    setPhase("result");
    setAutoClose(AUTO_CLOSE_SEC);
  }, [type, stopBlinkLoop, stopStream, onResult, phase]);

  useEffect(() => {
    if (
      !open ||
      phase !== "detecting" ||
      landmarkerState !== "ready" ||
      !landmarkerRef.current
    ) {
      stopBlinkLoop();
      return;
    }

    let cancelled = false;
    const loopToken = blinkLoopTokenRef.current;

    const detectBlink = () => {
      if (cancelled || loopToken !== blinkLoopTokenRef.current) return;

      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      if (!video || !landmarker) {
        animationFrameRef.current = requestAnimationFrame(detectBlink);
        return;
      }

      if (video.readyState < 2) {
        animationFrameRef.current = requestAnimationFrame(detectBlink);
        return;
      }

      if (video.currentTime === lastVideoTimeRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectBlink);
        return;
      }
      lastVideoTimeRef.current = video.currentTime;

      let result: FaceLandmarkerResult;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch {
        if (loopToken !== blinkLoopTokenRef.current) return;
        stopBlinkLoop();
        landmarkerRef.current?.close?.();
        landmarkerRef.current = null;
        if (recoveryTimerRef.current !== null) return;

        recoveryAttemptsRef.current += 1;
        if (recoveryAttemptsRef.current > MAX_RECOVERY_RETRIES) {
          setLandmarkerState("error");
          setGuidanceText(
            "Blink detection is unstable right now. You can continue with Capture Now.",
          );
          return;
        }

        setLandmarkerState("loading");
        setGuidanceText(
          `Reconnecting blink detection (${recoveryAttemptsRef.current}/${MAX_RECOVERY_RETRIES})…`,
        );
        recoveryTimerRef.current = window.setTimeout(() => {
          recoveryTimerRef.current = null;
          if (!open || phase !== "detecting") return;
          void loadLandmarker();
        }, RECOVERY_RETRY_DELAY_MS);
        return;
      }
      const { blinkScore, ear, hasFace } = getBlinkMetrics(result);
      setBlinkDebug({ blinkScore, ear });

      if (!hasFace) {
        if (faceDetectedRef.current) {
          faceDetectedRef.current = false;
          setFaceDetected(false);
        }
        setGuidanceText("No face detected yet. Look straight at the camera.");
        eyesClosedRef.current = false;
        eyesClosedAtRef.current = null;
        animationFrameRef.current = requestAnimationFrame(detectBlink);
        return;
      }

      if (!faceDetectedRef.current) {
        faceDetectedRef.current = true;
        setFaceDetected(true);
      }

      const eyesClosed =
        (blinkScore !== null && blinkScore >= EYE_CLOSED_THRESHOLD) ||
        (ear !== null && ear <= EYE_CLOSED_EAR_THRESHOLD);
      const eyesOpen =
        (blinkScore !== null && blinkScore <= EYE_OPEN_THRESHOLD) ||
        (ear !== null && ear >= EYE_OPEN_EAR_THRESHOLD);

      if (eyesClosed && !eyesClosedRef.current) {
        eyesClosedRef.current = true;
        eyesClosedAtRef.current = performance.now();
        setGuidanceText("Blink detected. Open your eyes to confirm it.");
      } else if (eyesOpen && eyesClosedRef.current) {
        const closedDuration =
          performance.now() - (eyesClosedAtRef.current ?? 0);
        eyesClosedRef.current = false;
        eyesClosedAtRef.current = null;

        if (
          closedDuration >= MIN_BLINK_CLOSED_MS &&
          closedDuration <= MAX_BLINK_CLOSED_MS
        ) {
          const nextBlinkCount = blinkCountRef.current + 1;
          blinkCountRef.current = nextBlinkCount;
          setBlinkCount(nextBlinkCount);

          if (nextBlinkCount >= BLINK_TARGET) {
            setGuidanceText("Two blinks confirmed. Capturing now…");
            void captureFrame();
            return;
          }

          const remaining = BLINK_TARGET - nextBlinkCount;
          setGuidanceText(
            `Great. Blink ${remaining} more time${
              remaining === 1 ? "" : "s"
            } to capture.`,
          );
        } else {
          setGuidanceText("Blink a bit more naturally, then try again.");
        }
      } else if (!eyesClosedRef.current) {
        const remaining = BLINK_TARGET - blinkCountRef.current;
        setGuidanceText(
          remaining > 0
            ? `Face detected. Blink ${remaining} more time${
                remaining === 1 ? "" : "s"
              } to capture.`
            : "Capturing now…",
        );
      }

      animationFrameRef.current = requestAnimationFrame(detectBlink);
    };

    animationFrameRef.current = requestAnimationFrame(detectBlink);

    return () => {
      cancelled = true;
      stopBlinkLoop();
    };
  }, [
    captureFrame,
    landmarkerState,
    loadLandmarker,
    open,
    phase,
    stopBlinkLoop,
  ]);

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  const isTimeIn = type === "time_in";
  const headerBg = isTimeIn
    ? "linear-gradient(135deg, #1a7a4a, #25a961)"
    : "linear-gradient(135deg, #1a5a99, #2577cc)";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { bgcolor: "#243447", color: "#e8f4fd", borderRadius: 3 },
        },
      }}
    >
      <DialogTitle
        sx={{ background: headerBg, color: "#fff", fontWeight: 800 }}
      >
        {isTimeIn
          ? "Time In — Face Recognition"
          : "Time Out — Face Recognition"}
      </DialogTitle>
      <DialogContent sx={{ textAlign: "center", py: 4 }}>
        {/* Camera feed */}
        {phase !== "result" && (
          <Stack spacing={2.5} alignItems="center">
            <Box
              sx={{
                position: "relative",
                display: "inline-block",
                width: "100%",
                maxWidth: 520,
              }}
            >
              <Box
                component="video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                sx={{
                  width: "100%",
                  borderRadius: 3,
                  border: faceDetected
                    ? "3px solid #25a961"
                    : "3px solid #2e4460",
                  transform: "scaleX(-1)",
                  bgcolor: "#000",
                  display: "block",
                  transition: "border-color 160ms ease",
                }}
              />
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{ display: "none" }}
              />

              {phase === "detecting" && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    p: 2,
                    pointerEvents: "none",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "rgba(8, 15, 26, 0.72)",
                      border: "1px solid rgba(122, 156, 192, 0.45)",
                      borderRadius: 999,
                      px: 2,
                      py: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        color: "#e8f4fd",
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        letterSpacing: "0.02em",
                      }}
                    >
                      Blink Progress: {blinkCount}/{BLINK_TARGET}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            <Stack spacing={1} alignItems="center" sx={{ maxWidth: 520 }}>
              <Typography variant="h6" fontWeight={800}>
                Blink Twice to Capture
              </Typography>
              <Typography color="text.secondary">{guidanceText}</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: faceDetected ? "#7dd3a6" : "#9fb3c8",
                  fontWeight: 700,
                }}
              >
                {faceDetected ? "Face locked in" : "Waiting for a face"}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: faceDetected ? "#a8d5ba" : "rgba(232,244,253,0.55)",
                  fontWeight: 600,
                  transition: "color 200ms ease",
                }}
              >
                {getEyeStatusText(
                  blinkDebug.blinkScore,
                  blinkDebug.ear,
                  eyesClosedRef,
                )}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => void captureFrame()}
                disabled={phase === "processing"}
                sx={{ mt: 1, color: "#e8f4fd", borderColor: "#2e4460" }}
              >
                Capture Now
              </Button>
              {landmarkerState === "loading" && (
                <Typography variant="body2" color="text.secondary">
                  Preparing blink detection model…
                </Typography>
              )}
              {landmarkerState === "error" && (
                <Typography variant="body2" color="#ffb4b4">
                  Blink detection is unavailable on this device right now. You
                  can still continue with Capture Now.
                </Typography>
              )}
            </Stack>
          </Stack>
        )}

        {/* Processing spinner */}
        {phase === "processing" && (
          <Stack alignItems="center" spacing={2} sx={{ mt: 3 }}>
            <CircularProgress sx={{ color: "#7a9cc0" }} />
            <Typography color="text.secondary">
              Processing face recognition…
            </Typography>
          </Stack>
        )}

        {/* Result */}
        {phase === "result" && resultData && (
          <Box sx={{ py: 3 }}>
            <Box
              sx={{
                fontSize: 64,
                color: resultData.success ? "#25a961" : "#dc3545",
                mb: 1,
              }}
            >
              {resultData.success ? "✓" : "✗"}
            </Box>
            <Typography
              variant="h5"
              fontWeight={800}
              color={resultData.success ? "#25a961" : "#dc3545"}
            >
              {resultData.success
                ? (resultData.action ?? "Attendance Recorded")
                : "Recognition Failed"}
            </Typography>
            {resultData.success && resultData.personnelName && (
              <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
                {resultData.personnelName}
              </Typography>
            )}
            {!resultData.success && (
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                {resultData.error ?? "Please try again."}
              </Typography>
            )}

            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Closing in {autoClose}s…
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(autoClose / AUTO_CLOSE_SEC) * 100}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "rgba(255,255,255,0.15)",
                }}
              />
              <Button
                variant="outlined"
                onClick={handleClose}
                sx={{ mt: 2, color: "#e8f4fd", borderColor: "#2e4460" }}
              >
                Close Now
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

