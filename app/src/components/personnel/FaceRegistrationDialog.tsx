"use client";

import { useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import CloseIcon from "@mui/icons-material/Close";
import apiClient from "@/lib/api-client";
import type { Personnel } from "@/types/models";

const MIN_IMAGES = 3;
const MAX_IMAGES = 10;

interface FaceRegistrationDialogProps {
  open: boolean;
  onClose: () => void;
  personnel: Personnel | null;
}

export default function FaceRegistrationDialog({
  open,
  onClose,
  personnel,
}: FaceRegistrationDialogProps) {
  const webcamRef = useRef<Webcam>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const handleCapture = useCallback(() => {
    if (!webcamRef.current || capturedImages.length >= MAX_IMAGES) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (screenshot) {
      setCapturedImages((prev) => [...prev, screenshot]);
    }
  }, [capturedImages.length]);

  const handleRemove = (index: number) => {
    setCapturedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClose = () => {
    setCapturedImages([]);
    onClose();
  };

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleSubmit = async () => {
    if (!personnel || capturedImages.length < MIN_IMAGES) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/v1/personnel/${personnel.id}/face`, {
        images: capturedImages,
      });
      setSnackbar({
        open: true,
        message: "Face images registered successfully.",
        severity: "success",
      });
      setCapturedImages([]);
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to register face images. Please try again.";
      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canCapture = capturedImages.length < MAX_IMAGES;
  const canSubmit = capturedImages.length >= MIN_IMAGES && !submitting;

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          Face Registration
          {personnel && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {personnel.firstName} {personnel.lastName} — {personnel.rank}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2}>
            {/* Live webcam feed */}
            <Box
              sx={{
                borderRadius: 1,
                overflow: "hidden",
                bgcolor: "black",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                width="100%"
                mirrored
                videoConstraints={{ facingMode: "user" }}
                aria-label="Webcam feed for face capture"
              />
            </Box>

            {/* Image count indicator */}
            <Typography variant="body2" color="text.secondary" align="center">
              {capturedImages.length} / {MAX_IMAGES} images captured
              {capturedImages.length < MIN_IMAGES && (
                <> &mdash; minimum {MIN_IMAGES} required</>
              )}
            </Typography>

            {/* Thumbnail previews */}
            {capturedImages.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {capturedImages.map((src, index) => (
                  <Box
                    key={index}
                    sx={{ position: "relative", width: 72, height: 72 }}
                  >
                    <Box
                      component="img"
                      src={src}
                      alt={`Captured face ${index + 1}`}
                      sx={{
                        width: 72,
                        height: 72,
                        objectFit: "cover",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                    <IconButton
                      size="small"
                      aria-label={`Remove image ${index + 1}`}
                      onClick={() => handleRemove(index)}
                      sx={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        bgcolor: "error.main",
                        color: "white",
                        width: 20,
                        height: 20,
                        "&:hover": { bgcolor: "error.dark" },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="outlined"
            startIcon={<CameraAltIcon />}
            onClick={handleCapture}
            disabled={!canCapture || submitting}
            aria-label="Capture face image"
          >
            Capture
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!canSubmit}
            startIcon={
              submitting ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
            aria-label="Submit face images"
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
