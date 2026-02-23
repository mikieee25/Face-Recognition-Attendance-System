"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { PendingApproval } from "@/types/models";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function confidenceColor(confidence: number): "success" | "warning" | "error" {
  if (confidence >= 0.7) return "success";
  if (confidence >= 0.5) return "warning";
  return "error";
}

function buildImageUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  // If imagePath is already a full URL, use it directly
  if (imagePath.startsWith("http")) return imagePath;
  return `${base}/${imagePath.replace(/^\//, "")}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PendingApprovalCardProps {
  record: PendingApproval;
  personnelName?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PendingApprovalCard({
  record,
  personnelName,
}: PendingApprovalCardProps) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showToast = (message: string, severity: "success" | "error") => {
    setToast({ open: true, message, severity });
  };

  const handleToastClose = () => {
    setToast((prev) => ({ ...prev, open: false }));
  };

  // ── Approve mutation ────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        `/api/v1/pending/${record.id}/approve`,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending"] });
      showToast("Record approved successfully.", "success");
    },
    onError: () => {
      showToast("Failed to approve record. Please try again.", "error");
    },
  });

  // ── Reject mutation ─────────────────────────────────────────────────────────

  const rejectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        `/api/v1/pending/${record.id}/reject`,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending"] });
      showToast("Record rejected.", "success");
    },
    onError: () => {
      showToast("Failed to reject record. Please try again.", "error");
    },
  });

  const isActing = approveMutation.isPending || rejectMutation.isPending;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Card
        sx={{ maxWidth: 320, display: "flex", flexDirection: "column" }}
        aria-label={`Pending approval for ${personnelName ?? `Personnel #${record.personnelId}`}`}
      >
        {/* Captured face image */}
        <CardMedia
          component="img"
          height="200"
          image={buildImageUrl(record.imagePath)}
          alt={`Captured face for ${personnelName ?? `Personnel #${record.personnelId}`}`}
          sx={{ objectFit: "cover", bgcolor: "grey.200" }}
        />

        <CardContent sx={{ flexGrow: 1 }}>
          <Stack spacing={1}>
            {/* Personnel name */}
            <Typography variant="h6" component="div" noWrap>
              {personnelName ?? `Personnel #${record.personnelId}`}
            </Typography>

            {/* Confidence score */}
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                Confidence:
              </Typography>
              <Chip
                label={`${(record.confidence * 100).toFixed(1)}%`}
                color={confidenceColor(record.confidence)}
                size="small"
                aria-label={`Confidence score: ${(record.confidence * 100).toFixed(1)}%`}
              />
            </Stack>

            {/* Timestamp */}
            <Typography variant="body2" color="text.secondary">
              {formatDateTime(record.createdAt)}
            </Typography>
          </Stack>
        </CardContent>

        <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={
              approveMutation.isPending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CheckCircleIcon />
              )
            }
            onClick={() => approveMutation.mutate()}
            disabled={isActing}
            aria-label={`Approve pending record ${record.id}`}
            fullWidth
          >
            Approve
          </Button>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={
              rejectMutation.isPending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CancelIcon />
              )
            }
            onClick={() => rejectMutation.mutate()}
            disabled={isActing}
            aria-label={`Reject pending record ${record.id}`}
            fullWidth
          >
            Reject
          </Button>
        </CardActions>
      </Card>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </>
  );
}
