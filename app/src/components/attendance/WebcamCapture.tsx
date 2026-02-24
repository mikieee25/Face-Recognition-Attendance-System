"use client";

import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { AttendanceType } from "@/types/models";

interface CaptureResult {
  personnelName: string;
  confidence: number;
  type: AttendanceType;
  status: string;
}

export default function WebcamCapture() {
  const webcamRef = useRef<Webcam>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = useCallback(async () => {
    if (!webcamRef.current) return;

    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) {
      setError("Failed to capture image from webcam. Please try again.");
      return;
    }

    setProcessing(true);
    setResult(null);
    setError(null);

    try {
      const response = await apiClient.post<ApiEnvelope<CaptureResult>>(
        "/api/v1/attendance/capture",
        { image: screenshot },
      );

      if (response.data.success && response.data.data) {
        setResult(response.data.data);
      } else {
        setError(response.data.message ?? "Capture failed. Please try again.");
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "An error occurred during capture. Please try again.";
      setError(message);
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  const attendanceTypeLabel = (type: AttendanceType) =>
    type === "time_in" ? "Time In" : "Time Out";

  const attendanceTypeColor = (type: AttendanceType): "success" | "warning" =>
    type === "time_in" ? "success" : "warning";

  return (
    <Stack spacing={3} alignItems="center">
      {/* Webcam feed */}
      <Paper
        elevation={2}
        sx={{
          borderRadius: 2,
          overflow: "hidden",
          width: "100%",
          maxWidth: 480,
          bgcolor: "black",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          width="100%"
          videoConstraints={{ facingMode: "user" }}
          aria-label="Webcam feed for attendance capture"
        />
      </Paper>

      {/* Processing state */}
      {processing && (
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography variant="body1" color="text.secondary">
            Processing...
          </Typography>
        </Stack>
      )}

      {/* Error state */}
      {error && (
        <Alert
          severity="error"
          sx={{ width: "100%", maxWidth: 480 }}
          onClose={handleReset}
        >
          {error}
        </Alert>
      )}

      {/* Result display */}
      {result && (
        <Paper
          elevation={1}
          sx={{
            p: 3,
            width: "100%",
            maxWidth: 480,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "success.light",
          }}
        >
          <Stack spacing={2}>
            <Typography variant="h6" align="center">
              Attendance Recorded
            </Typography>

            <Stack spacing={1}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Personnel
                </Typography>
                <Typography variant="body1" fontWeight={600}>
                  {result.personnelName}
                </Typography>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Type
                </Typography>
                <Chip
                  label={attendanceTypeLabel(result.type)}
                  color={attendanceTypeColor(result.type)}
                  size="small"
                />
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Confidence
                </Typography>
                <Typography variant="body1">
                  {(result.confidence * 100).toFixed(1)}%
                </Typography>
              </Stack>

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Status
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ textTransform: "capitalize" }}
                >
                  {result.status}
                </Typography>
              </Stack>
            </Stack>

            <Button variant="outlined" onClick={handleReset} fullWidth>
              Capture Again
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Capture button — only shown when not processing and no result */}
      {!processing && !result && (
        <Button
          variant="contained"
          size="large"
          startIcon={<CameraAltIcon />}
          onClick={handleCapture}
          aria-label="Capture attendance"
          sx={{ minWidth: 200 }}
        >
          Capture
        </Button>
      )}
    </Stack>
  );
}
