"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface CaptureResult {
  success: boolean;
  action?: string;
  error?: string;
  status?: string;
  confidence?: number;
  type?: "time_in" | "time_out";
}

interface Props {
  onProceedToSurvey: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const COUNTDOWN_SEC = 3;
const AUTO_CLOSE_SEC = 5;
type CameraPhase = "init" | "countdown" | "processing" | "result";
type ModalType = "time_in" | "time_out" | "register" | null;

// ── Sub-component: Face Camera Modal ─────────────────────────────────────────
function FaceCameraModal({
  open,
  modalType,
  onClose,
  onResult,
}: {
  open: boolean;
  modalType: ModalType;
  onClose: () => void;
  onResult: (res: CaptureResult) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<CameraPhase>("init");
  const [countdown, setCountdown] = useState(COUNTDOWN_SEC);
  const [autoClose, setAutoClose] = useState(AUTO_CLOSE_SEC);
  const [resultData, setResultData] = useState<CaptureResult | null>(null);
  const [regName, setRegName] = useState("");
  const [regStep, setRegStep] = useState<"form" | "camera" | "result">("form");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [capturedImg, setCapturedImg] = useState<string | null>(null);

  const isAttendance = modalType === "time_in" || modalType === "time_out";
  const isRegister = modalType === "register";

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
    setRegStep("form");
    setRegName("");
    setRegError(null);
    setCapturedImg(null);
    setRegLoading(false);
  }, [stopStream]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      if (isAttendance) {
        setPhase("countdown");
        setCountdown(COUNTDOWN_SEC);
      }
      // for register, camera just starts; user manually captures
    } catch {
      setRegError("Could not access camera. Please check permissions.");
    }
  }, [isAttendance]);

  useEffect(() => {
    if (!open) {
      cleanup();
      return;
    }
    if (isAttendance) {
      startCamera();
    }
  }, [open, isAttendance, startCamera, cleanup]);

  // Registration: start camera when step becomes "camera"
  useEffect(() => {
    if (!isRegister || regStep !== "camera") return;
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
      } catch {
        if (!cancelled) setRegError("Camera access denied.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isRegister, regStep]);

  // Attendance countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      captureAttendance();
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown]);

  // Auto-close after result
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

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 640, 480);
    return canvas.toDataURL("image/jpeg", 0.9);
  }, []);

  const captureAttendance = useCallback(async () => {
    setPhase("processing");
    const imageData = captureFrame();
    stopStream();
    if (!imageData) return;

    try {
      const res = await apiClient.post<ApiEnvelope<Record<string, unknown>>>(
        "/api/v1/attendance/capture",
        { image: imageData, type: modalType },
      );
      const raw = res.data.data ?? {};
      const isConfirmed = raw.status === "confirmed";
      const isPending = raw.reviewStatus === "pending" || raw.status === "pending";
      const recordType = (raw.type as string) ?? modalType;
      const data: CaptureResult = {
        success: true,
        action: isConfirmed
          ? recordType === "time_in" ? "Time In Recorded" : "Time Out Recorded"
          : isPending ? "Sent for Admin Review" : "Attendance Recorded",
        type: recordType as "time_in" | "time_out",
        confidence: raw.confidence as number | undefined,
        status: isConfirmed ? "confirmed" : isPending ? "pending" : undefined,
      };
      setResultData(data);
      onResult(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Recognition failed";
      const data: CaptureResult = { success: false, error: msg };
      setResultData(data);
      onResult(data);
    }
    setPhase("result");
    setAutoClose(AUTO_CLOSE_SEC);
  }, [captureFrame, stopStream, modalType, onResult]);

  const captureForRegistration = useCallback(() => {
    const imageData = captureFrame();
    stopStream();
    if (imageData) {
      setCapturedImg(imageData);
      setRegStep("result");
    }
  }, [captureFrame, stopStream]);

  const handleRegisterSubmit = useCallback(async () => {
    if (!capturedImg || !regName.trim()) return;
    setRegLoading(true);
    setRegError(null);
    try {
      // We use a demo/eval registration endpoint
      await apiClient.post("/api/v1/personnel/register-face", {
        name: regName.trim(),
        photo: capturedImg,
      });
      onResult({ success: true, action: "Face Registered Successfully" });
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Registration failed";
      setRegError(msg);
    } finally {
      setRegLoading(false);
    }
  }, [capturedImg, regName, onResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  // Header gradient
  const headerBg =
    isRegister
      ? "linear-gradient(135deg, #5a4a8a, #7c68b5)"
      : modalType === "time_in"
      ? "linear-gradient(135deg, #1a7a4a, #25a961)"
      : "linear-gradient(135deg, #1a5a99, #2577cc)";

  const headerTitle =
    isRegister
      ? "Face Registration"
      : modalType === "time_in"
      ? "Time In — Face Recognition"
      : "Time Out — Face Recognition";

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { bgcolor: "#243447", color: "#e8f4fd", borderRadius: 3 } },
      }}
    >
      <DialogTitle sx={{ background: headerBg, color: "#fff", fontWeight: 800 }}>
        {headerTitle}
      </DialogTitle>

      <DialogContent sx={{ textAlign: "center", py: 4 }}>
        {/* ── ATTENDANCE FLOW ────────────────────────────────────────────── */}
        {isAttendance && (
          <>
            {/* Camera feed */}
            {phase !== "result" && (
              <Box sx={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 520 }}>
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

            {phase === "processing" && (
              <Stack alignItems="center" spacing={2} sx={{ mt: 3 }}>
                <CircularProgress sx={{ color: "#7a9cc0" }} />
                <Typography color="text.secondary">Processing face recognition…</Typography>
              </Stack>
            )}

            {phase === "result" && resultData && (
              <Box sx={{ py: 3 }}>
                <Box sx={{ fontSize: 64, color: resultData.success ? "#25a961" : "#dc3545", mb: 1 }}>
                  {resultData.success ? "✓" : "✗"}
                </Box>
                <Typography
                  variant="h5"
                  fontWeight={800}
                  color={resultData.success ? "#25a961" : "#dc3545"}
                >
                  {resultData.success ? (resultData.action ?? "Attendance Recorded") : "Recognition Failed"}
                </Typography>
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
                    sx={{ height: 6, borderRadius: 3, bgcolor: "rgba(255,255,255,0.15)" }}
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
          </>
        )}

        {/* ── REGISTRATION FLOW ─────────────────────────────────────────── */}
        {isRegister && (
          <>
            {regStep === "form" && (
              <Stack spacing={3} sx={{ maxWidth: 400, mx: "auto", mt: 2 }}>
                <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ textAlign: "left", bgcolor: "rgba(37,119,204,0.12)" }}>
                  Enter your name, then we&apos;ll capture your face for registration.
                </Alert>
                <Box
                  component="input"
                  type="text"
                  placeholder="Full Name (e.g. SFO1 Juan Dela Cruz)"
                  value={regName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRegName(e.target.value)}
                  sx={{
                    width: "100%",
                    px: 2,
                    py: 1.5,
                    borderRadius: 2,
                    border: "1px solid #2e4460",
                    bgcolor: "#1b2e40",
                    color: "#e8f4fd",
                    fontSize: "1rem",
                    outline: "none",
                    "&:focus": { borderColor: "#7c68b5" },
                    "&::placeholder": { color: "#7a9cc0" },
                  }}
                />
                {regError && <Typography color="error" variant="body2">{regError}</Typography>}
                <Button
                  variant="contained"
                  disabled={!regName.trim()}
                  onClick={() => setRegStep("camera")}
                  sx={{ bgcolor: "#7c68b5", "&:hover": { bgcolor: "#5a4a8a" } }}
                >
                  Open Camera
                </Button>
              </Stack>
            )}

            {regStep === "camera" && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Position your face clearly in the frame, then click Capture.
                </Typography>
                <Box sx={{ position: "relative", display: "inline-block", width: "100%", maxWidth: 480 }}>
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
                </Box>
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button onClick={() => { stopStream(); setRegStep("form"); }} sx={{ color: "#7a9cc0" }}>
                    ← Back
                  </Button>
                  <Button
                    variant="contained"
                    onClick={captureForRegistration}
                    sx={{ bgcolor: "#7c68b5", "&:hover": { bgcolor: "#5a4a8a" } }}
                  >
                    Capture Photo
                  </Button>
                </Stack>
              </Box>
            )}

            {regStep === "result" && capturedImg && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Review your photo before registering.
                </Typography>
                <Box
                  component="img"
                  src={capturedImg}
                  alt="Captured"
                  sx={{
                    width: "100%",
                    maxWidth: 400,
                    borderRadius: 3,
                    border: "3px solid #2e4460",
                    transform: "scaleX(-1)",
                    display: "block",
                    mx: "auto",
                  }}
                />
                <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: "rgba(255,255,255,0.05)", textAlign: "left" }}>
                  <Typography variant="body2" color="text.secondary">
                    <Box component="span" fontWeight={700} color="#e8f4fd">Name: </Box>
                    {regName}
                  </Typography>
                </Box>
                {regError && <Typography color="error" variant="body2" sx={{ mt: 1 }}>{regError}</Typography>}
                <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 2 }}>
                  <Button
                    onClick={() => { setCapturedImg(null); setRegStep("camera"); }}
                    sx={{ color: "#7a9cc0" }}
                    disabled={regLoading}
                  >
                    Retake
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleRegisterSubmit}
                    disabled={regLoading}
                    startIcon={regLoading ? <CircularProgress size={16} /> : undefined}
                    sx={{ bgcolor: "#25a961", "&:hover": { bgcolor: "#1a7a4a" } }}
                  >
                    {regLoading ? "Registering…" : "Register Face"}
                  </Button>
                </Stack>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Kiosk Component ──────────────────────────────────────────────────────
export default function EvaluationKiosk({ onProceedToSurvey }: Props) {
  const [clock, setClock] = useState({ time: "--:--:--", date: "Loading…" });
  const [modalType, setModalType] = useState<ModalType>(null);
  const [lastResult, setLastResult] = useState<CaptureResult | null>(null);
  const [testedFeatures, setTestedFeatures] = useState<Set<string>>(new Set());

  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock({
        time: now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
        date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleResult = useCallback((res: CaptureResult) => {
    setLastResult(res);
    if (modalType) {
      setTestedFeatures((prev) => new Set(prev).add(modalType));
    }
  }, [modalType]);

  const ACTION_BUTTONS = [
    {
      type: "time_in" as const,
      label: "Time In",
      sublabel: "Face Recognition",
      icon: <LoginIcon sx={{ fontSize: 44 }} />,
      gradient: "linear-gradient(135deg, #1a7a4a 0%, #25a961 100%)",
    },
    {
      type: "time_out" as const,
      label: "Time Out",
      sublabel: "Face Recognition",
      icon: <LogoutIcon sx={{ fontSize: 44 }} />,
      gradient: "linear-gradient(135deg, #1a5a99 0%, #2577cc 100%)",
    },
    {
      type: "register" as const,
      label: "Register Face",
      sublabel: "Face Enrollment",
      icon: <HowToRegIcon sx={{ fontSize: 44 }} />,
      gradient: "linear-gradient(135deg, #5a4a8a 0%, #7c68b5 100%)",
    },
  ] as const;

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 900, mx: "auto" }}>
      {/* Instruction Banner */}
      <Paper
        sx={{
          mb: 3,
          p: 2.5,
          bgcolor: "#1b2e40",
          border: "1px solid #2e4460",
          borderLeft: "4px solid #C62828",
        }}
      >
        <Typography variant="body1" fontWeight={700} color="#e8f4fd" sx={{ mb: 0.5 }}>
          👋 Welcome, Evaluator!
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please interact with the features below to get familiar with the system before filling out the survey.
          You can try <strong style={{ color: "#e8f4fd" }}>Time In</strong>,{" "}
          <strong style={{ color: "#e8f4fd" }}>Time Out</strong>, and{" "}
          <strong style={{ color: "#e8f4fd" }}>Face Registration</strong>.
          Once you&apos;re done exploring, click <strong style={{ color: "#C62828" }}>Proceed to Survey</strong>.
        </Typography>
      </Paper>

      {/* Live Clock */}
      <Paper
        sx={{
          mb: 3,
          p: 2,
          bgcolor: "#1b2e40",
          border: "1px solid #2e4460",
          textAlign: "center",
        }}
      >
        <Typography
          fontWeight={800}
          color="#e8f4fd"
          sx={{ fontSize: { xs: "2rem", sm: "2.8rem" }, fontVariantNumeric: "tabular-nums", letterSpacing: "0.04em" }}
        >
          {clock.time}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {clock.date}
        </Typography>
      </Paper>

      {/* Feature Buttons */}
      <Paper sx={{ p: 2.5, mb: 3, bgcolor: "#243447", border: "1px solid #2e4460" }}>
        <Typography
          variant="overline"
          sx={{ color: "#7a9cc0", fontWeight: 700, letterSpacing: "0.06em", mb: 2, display: "block" }}
        >
          System Features — Try Each One
        </Typography>
        <Stack spacing={2} direction="row" flexWrap="wrap">
          {ACTION_BUTTONS.map((btn) => {
            const tested = testedFeatures.has(btn.type);
            return (
              <ButtonBase
                key={btn.type}
                onClick={() => setModalType(btn.type)}
                sx={{
                  flex: { xs: "1 1 100%", sm: "1 1 calc(33.333% - 11px)" },
                  minHeight: { xs: 110, sm: 150 },
                  borderRadius: 2,
                  position: "relative",
                  background: btn.gradient,
                  color: "#fff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 0.5,
                  boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                  transition: "transform 0.12s, box-shadow 0.12s",
                  "&:hover": { transform: "translateY(-3px)", boxShadow: "0 10px 28px rgba(0,0,0,0.45)" },
                  "&:active": { transform: "scale(0.96)" },
                }}
              >
                {tested && (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      bgcolor: "rgba(37,169,97,0.9)",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircleIcon sx={{ fontSize: 16, color: "#fff" }} />
                  </Box>
                )}
                {btn.icon}
                <Typography variant="h6" fontWeight={800} textTransform="uppercase" sx={{ fontSize: { xs: "0.85rem", sm: "1.15rem" } }}>
                  {btn.label}
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)" }}>
                  {btn.sublabel}
                </Typography>
              </ButtonBase>
            );
          })}
        </Stack>
      </Paper>

      {/* Last Result */}
      {lastResult && (
        <Paper
          sx={{
            mb: 3,
            p: 2,
            bgcolor: lastResult.success ? "rgba(37,169,97,0.1)" : "rgba(220,53,69,0.1)",
            border: `1px solid ${lastResult.success ? "rgba(37,169,97,0.4)" : "rgba(220,53,69,0.4)"}`,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {lastResult.success
              ? <CheckCircleIcon sx={{ color: "#25a961" }} />
              : <ErrorIcon sx={{ color: "#dc3545" }} />
            }
            <Box>
              <Typography variant="body2" fontWeight={700} color={lastResult.success ? "#25a961" : "#dc3545"}>
                {lastResult.success ? (lastResult.action ?? "Success") : "Failed"}
              </Typography>
              {!lastResult.success && (
                <Typography variant="caption" color="text.secondary">{lastResult.error}</Typography>
              )}
            </Box>
            {lastResult.status && (
              <Chip
                label={lastResult.status}
                size="small"
                sx={{ ml: "auto", bgcolor: "rgba(255,255,255,0.08)", color: "#7a9cc0", textTransform: "capitalize" }}
              />
            )}
          </Stack>
        </Paper>
      )}

      <Divider sx={{ borderColor: "#2e4460", my: 3 }} />

      {/* Proceed to Survey */}
      <Stack alignItems="center" spacing={1.5}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Done exploring the system? Fill out the evaluation survey to share your feedback.
        </Typography>
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={onProceedToSurvey}
          sx={{
            bgcolor: "#C62828",
            "&:hover": { bgcolor: "#8E0000" },
            px: 5,
            py: 1.5,
            fontSize: "1rem",
            fontWeight: 800,
            boxShadow: "0 4px 16px rgba(198,40,40,0.4)",
          }}
        >
          Proceed to Survey
        </Button>
      </Stack>

      {/* Camera Modal */}
      <FaceCameraModal
        open={modalType !== null}
        modalType={modalType}
        onClose={() => setModalType(null)}
        onResult={handleResult}
      />
    </Box>
  );
}
