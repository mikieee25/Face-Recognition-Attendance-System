"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ReplayIcon from "@mui/icons-material/Replay";
import CheckIcon from "@mui/icons-material/Check";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel } from "@/types/models";
import type { CaptureResultData } from "@/app/kiosk/page";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: CaptureResultData) => void;
}

type Phase = "form" | "camera" | "preview";

const COUNTDOWN_SEC = 3;

export default function KioskManualModal({ open, onClose, onSuccess }: Props) {
  // ── Form state ────────────────────────────────────────────────────────────
  const [personnelId, setPersonnelId] = useState("");
  const [type, setType] = useState("time_in");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Phase ─────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("form");

  // ── Camera state ──────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // ── Live clock tick for the date (always current time) ────────────────────
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Personnel list ────────────────────────────────────────────────────────
  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "kiosk"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data ?? [];
    },
    enabled: open,
  });

  // ── Tick the live clock while the modal is open ───────────────────────────
  useEffect(() => {
    if (!open) return;
    tickRef.current = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [open]);

  // ── Reset everything when the modal opens / closes ────────────────────────
  useEffect(() => {
    if (open) {
      setPersonnelId("");
      setType("time_in");
      setError(null);
      setPhase("form");
      setCapturedImage(null);
    } else {
      stopStream();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Camera helpers ────────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Start camera when phase becomes "camera"
  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    setCountdown(COUNTDOWN_SEC);

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
      } catch {
        if (!cancelled) setError("Could not access camera. Please try again.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [phase]);

  // Countdown tick
  useEffect(() => {
    if (phase !== "camera") return;
    if (countdown <= 0) {
      captureFrame();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 640, 480);
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    setCapturedImage(imageData);
    setPhase("preview");
  }, [stopStream]);

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!personnelId) {
      setError("Please select a personnel.");
      setPhase("form");
      return;
    }
    if (!capturedImage) {
      setError("Please capture a photo first.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const selected = personnelList.find((p) => String(p.id) === personnelId);
      const personnelName = selected ? `${selected.rank} ${selected.firstName} ${selected.lastName}`.trim() : undefined;

      // Snapshot the submission time so it doesn't tick forward during the await
      const submittedAt = new Date();

      await apiClient.post("/api/v1/attendance/manual", {
        personnelId: Number(personnelId),
        type,
        date: submittedAt.toISOString(),
        photo: capturedImage,
      });

      onSuccess({
        success: true,
        action: "Pending Approval",
        personnelName,
        type: type as "time_in" | "time_out",
        time: submittedAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        status: "pending",
      });
      onClose();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const raw = errData?.message;
      const msg = Array.isArray(raw) ? raw.join(" • ") : (raw ?? "Submission failed. Please try again.");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Go back to form from camera ───────────────────────────────────────────
  function handleBackToForm() {
    stopStream();
    setPhase("form");
    setError(null);
  }

  // ── Retake ────────────────────────────────────────────────────────────────
  function handleRetake() {
    setCapturedImage(null);
    setPhase("camera");
  }

  // ── Close guard ───────────────────────────────────────────────────────────
  function handleClose() {
    if (submitting) return;
    stopStream();
    onClose();
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const formValid = !!personnelId;
  const liveTimeLabel = currentTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const liveDateLabel = currentTime.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  // ── Title per phase ───────────────────────────────────────────────────────
  const titleMap: Record<Phase, string> = {
    form: "Manual Attendance Entry",
    camera: "Capture Your Photo",
    preview: "Confirm & Submit",
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: { bgcolor: "#243447", color: "#e8f4fd", borderRadius: 3 },
        },
      }}
    >
      <DialogTitle
        sx={{
          background: "linear-gradient(135deg, #5a4a8a, #7c68b5)",
          color: "#fff",
          fontWeight: 800,
        }}
      >
        {titleMap[phase]}
      </DialogTitle>

      <DialogContent sx={{ mt: 2, pb: 1 }}>
        {/* ── Error banner ── */}
        {error && (
          <Typography color="error" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PHASE 1 — FORM
        ══════════════════════════════════════════════════════════════════ */}
        {phase === "form" && (
          <Stack spacing={2.5}>
            {/* Live clock display */}
            <Box
              sx={{
                textAlign: "center",
                py: 1.5,
                px: 2,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Typography variant="h5" fontWeight={800} color="#e8f4fd" sx={{ fontVariantNumeric: "tabular-nums" }}>
                {liveTimeLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {liveDateLabel}
              </Typography>
            </Box>

            <FormControl fullWidth required>
              <InputLabel sx={{ color: "#7a9cc0" }}>Personnel</InputLabel>
              <Select value={personnelId} label="Personnel" onChange={(e) => setPersonnelId(e.target.value)} sx={{ color: "#e8f4fd" }}>
                {personnelList.map((p) => (
                  <MenuItem key={p.id} value={String(p.id)}>
                    {p.rank} {p.firstName} {p.lastName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth required>
              <InputLabel sx={{ color: "#7a9cc0" }}>Type</InputLabel>
              <Select value={type} label="Type" onChange={(e) => setType(e.target.value)} sx={{ color: "#e8f4fd" }}>
                <MenuItem value="time_in">Time In</MenuItem>
                <MenuItem value="time_out">Time Out</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PHASE 2 — CAMERA
        ══════════════════════════════════════════════════════════════════ */}
        {phase === "camera" && (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Look straight at the camera. Photo will be taken automatically.
            </Typography>

            <Box
              sx={{
                position: "relative",
                display: "inline-block",
                width: "100%",
                maxWidth: 480,
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
              <canvas ref={canvasRef} width={640} height={480} style={{ display: "none" }} />

              {/* Countdown overlay */}
              {countdown > 0 && (
                <Typography
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    fontSize: "5rem",
                    fontWeight: 900,
                    color: "#fff",
                    textShadow: "0 4px 20px rgba(0,0,0,0.8)",
                    pointerEvents: "none",
                  }}
                >
                  {countdown}
                </Typography>
              )}
            </Box>

            {/* Manual capture button */}
            <Button
              variant="contained"
              size="large"
              startIcon={<CameraAltIcon />}
              onClick={captureFrame}
              sx={{ mt: 2, bgcolor: "#7c68b5", "&:hover": { bgcolor: "#5a4a8a" } }}
            >
              Capture Now
            </Button>
          </Box>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PHASE 3 — PREVIEW
        ══════════════════════════════════════════════════════════════════ */}
        {phase === "preview" && capturedImage && (
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Review your photo before submitting.
            </Typography>

            {/* Photo preview */}
            <Box
              component="img"
              src={capturedImage}
              alt="Captured photo"
              sx={{
                width: "100%",
                maxWidth: 480,
                borderRadius: 3,
                border: "3px solid #2e4460",
                transform: "scaleX(-1)",
                display: "block",
                mx: "auto",
              }}
            />

            {/* Summary */}
            <Box
              sx={{
                mt: 2,
                py: 1.5,
                px: 2,
                borderRadius: 2,
                bgcolor: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                textAlign: "left",
              }}
            >
              {(() => {
                const selected = personnelList.find((p) => String(p.id) === personnelId);
                const name = selected ? `${selected.rank} ${selected.firstName} ${selected.lastName}`.trim() : "—";
                return (
                  <Stack spacing={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      <Box component="span" fontWeight={700} color="#e8f4fd">
                        Personnel:
                      </Box>{" "}
                      {name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <Box component="span" fontWeight={700} color="#e8f4fd">
                        Type:
                      </Box>{" "}
                      {type === "time_in" ? "Time In" : "Time Out"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      <Box component="span" fontWeight={700} color="#e8f4fd">
                        Time:
                      </Box>{" "}
                      {liveTimeLabel} — {liveDateLabel}
                    </Typography>
                  </Stack>
                );
              })()}
            </Box>
          </Box>
        )}
      </DialogContent>

      {/* ── Actions per phase ── */}
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 1 }}>
        {phase === "form" && (
          <>
            <Button onClick={handleClose} sx={{ color: "#7a9cc0" }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={!formValid}
              startIcon={<CameraAltIcon />}
              onClick={() => setPhase("camera")}
              sx={{ bgcolor: "#7c68b5", "&:hover": { bgcolor: "#5a4a8a" } }}
            >
              Open Camera
            </Button>
          </>
        )}

        {phase === "camera" && (
          <Button onClick={handleBackToForm} sx={{ color: "#7a9cc0" }}>
            ← Back
          </Button>
        )}

        {phase === "preview" && (
          <>
            <Button onClick={handleRetake} disabled={submitting} startIcon={<ReplayIcon />} sx={{ color: "#7a9cc0" }}>
              Retake
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={16} /> : <CheckIcon />}
              sx={{ bgcolor: "#25a961", "&:hover": { bgcolor: "#1a7a4a" } }}
            >
              Submit for Approval
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
