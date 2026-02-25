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

const COUNTDOWN_SEC = 3;
const AUTO_CLOSE_SEC = 5;

type Phase = "init" | "countdown" | "processing" | "result";

export default function KioskCameraModal({
  open,
  type,
  onClose,
  onResult,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("init");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [autoClose, setAutoClose] = useState(AUTO_CLOSE_SEC);
  const [resultData, setResultData] = useState<CaptureResultData | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const cleanup = useCallback(() => {
    stopStream();
    setPhase("init");
    setCountdown(COUNTDOWN_SEC);
    setAutoClose(AUTO_CLOSE_SEC);
    setResultData(null);
  }, [stopStream]);

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
        setPhase("countdown");
        setCountdown(COUNTDOWN_SEC);
      } catch {
        if (!cancelled) setPhase("init");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cleanup]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      captureFrame();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

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
    setPhase("processing");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

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
  }, [type, stopStream, onResult]);

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
                border: "3px solid #2e4460",
                transform: "scaleX(-1)",
                bgcolor: "#000",
                display: "block",
              }}
            />
            <canvas
              ref={canvasRef}
              width={640}
              height={480}
              style={{ display: "none" }}
            />

            {/* Countdown overlay */}
            {phase === "countdown" && countdown > 0 && (
              <Typography
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  fontSize: "5rem",
                  fontWeight: 900,
                  color: "#fff",
                  textShadow: "0 4px 20px rgba(0,0,0,0.7)",
                  pointerEvents: "none",
                }}
              >
                {countdown}
              </Typography>
            )}
          </Box>
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
