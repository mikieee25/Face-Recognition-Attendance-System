"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddAPhotoIcon from "@mui/icons-material/AddAPhoto";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import FaceIcon from "@mui/icons-material/Face";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { Personnel, Station, AttendanceRecord } from "@/types/models";

interface FaceRecord {
  id: number;
  source: "legacy" | "embedding";
  createdAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  personnel: Personnel | null;
  onFaceRegister?: (personnel: Personnel) => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PersonnelProfileModal({
  open,
  onClose,
  personnel,
  onFaceRegister,
}: Props) {
  const qc = useQueryClient();
  const personnelId = personnel?.id;

  const [toast, setToast] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  // Fetch station name
  const { data: stations } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
    enabled: open,
  });
  const stationName =
    stations?.find((s) => s.id === personnel?.stationId)?.name ?? "—";

  // Fetch face registrations
  const { data: faces, isLoading: facesLoading } = useQuery({
    queryKey: ["faces", personnelId],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<FaceRecord[]>>(
        `/api/v1/personnel/${personnelId}/faces`,
      );
      return res.data.data ?? [];
    },
    enabled: open && !!personnelId,
  });
  const faceList = faces ?? [];

  // Fetch recent attendance (last 20)
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendance-profile", personnelId],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiEnvelope<PaginatedResponse<AttendanceRecord>>
      >("/api/v1/attendance", {
        params: { personnelId, limit: 20, page: 1 },
      });
      return res.data.data;
    },
    enabled: open && !!personnelId,
  });
  const records = attendanceData?.items ?? [];

  const invalidateFaces = () => {
    qc.invalidateQueries({ queryKey: ["faces", personnelId] });
    qc.invalidateQueries({ queryKey: ["face-count", personnelId] });
  };

  const handleDeleteFace = async (face: FaceRecord) => {
    try {
      await apiClient.delete(
        `/api/v1/personnel/${personnelId}/faces/${face.id}`,
        { params: { source: face.source } },
      );
      invalidateFaces();
      setToast({
        open: true,
        severity: "success",
        message: "Face registration removed.",
      });
    } catch {
      setToast({
        open: true,
        severity: "error",
        message: "Failed to remove face registration.",
      });
    }
  };

  const handleDeleteAllFaces = async () => {
    if (!personnelId) return;
    try {
      await apiClient.delete(`/api/v1/personnel/${personnelId}/faces`);
      invalidateFaces();
      setToast({
        open: true,
        severity: "success",
        message: "All face registrations removed.",
      });
    } catch {
      setToast({
        open: true,
        severity: "error",
        message: "Failed to remove face registrations.",
      });
    }
  };

  if (!personnel) return null;

  const initials =
    `${personnel.firstName[0]}${personnel.lastName[0]}`.toUpperCase();

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          Personnel Profile
          <IconButton
            aria-label="Close"
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {/* Profile header */}
          <Stack alignItems="center" spacing={1.5} sx={{ pb: 2 }}>
            <Avatar
              sx={{
                width: 80,
                height: 80,
                bgcolor: "primary.main",
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {initials}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>
              {personnel.rank} {personnel.firstName} {personnel.lastName}
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              flexWrap="wrap"
              justifyContent="center"
            >
              <Chip label={stationName} size="small" variant="outlined" />
              <Chip
                label={personnel.isActive ? "Active" : "Inactive"}
                size="small"
                color={personnel.isActive ? "success" : "default"}
              />
            </Stack>
            {personnel.shiftStartTime && personnel.shiftEndTime && (
              <Typography variant="body2" color="text.secondary">
                Shift: {personnel.shiftStartTime} — {personnel.shiftEndTime}
              </Typography>
            )}
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Face registrations section */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 1 }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <FaceIcon fontSize="small" color="action" />
              <Typography variant="subtitle2">
                Registered Faces ({faceList.length})
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5}>
              <Tooltip title="Add faces">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onFaceRegister?.(personnel)}
                  aria-label="Add face registration"
                >
                  <AddAPhotoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              {faceList.length > 0 && (
                <Tooltip title="Remove all faces">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={handleDeleteAllFaces}
                    aria-label="Remove all face registrations"
                  >
                    <DeleteSweepIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {facesLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : faceList.length === 0 ? (
            <Box
              sx={{
                py: 2,
                textAlign: "center",
                bgcolor: "action.hover",
                borderRadius: 1,
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No faces registered.
              </Typography>
              <Button
                size="small"
                startIcon={<AddAPhotoIcon />}
                onClick={() => onFaceRegister?.(personnel)}
                sx={{ mt: 1 }}
              >
                Register Faces
              </Button>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 180, mb: 2 }}>
              <Table size="small" stickyHeader aria-label="Face registrations">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Registered</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {faceList.map((face, idx) => (
                    <TableRow key={`${face.source}-${face.id}`} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>
                        <Chip
                          label={
                            face.source === "legacy" ? "Legacy" : "Embedding"
                          }
                          size="small"
                          variant="outlined"
                          color={face.source === "legacy" ? "default" : "info"}
                        />
                      </TableCell>
                      <TableCell>{formatDate(face.createdAt)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteFace(face)}
                            aria-label={`Remove face registration ${idx + 1}`}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Divider sx={{ mb: 2 }} />

          {/* Recent attendance */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Recent Attendance
          </Typography>

          {attendanceLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : records.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ py: 2, textAlign: "center" }}
            >
              No attendance records yet.
            </Typography>
          ) : (
            <TableContainer sx={{ maxHeight: 280 }}>
              <Table size="small" stickyHeader aria-label="Recent attendance">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {records.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{formatDate(r.createdAt)}</TableCell>
                      <TableCell>{formatTime(r.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.type === "time_in" ? "Time In" : "Time Out"}
                          size="small"
                          color={r.type === "time_in" ? "success" : "primary"}
                          variant="outlined"
                          sx={{ fontWeight: 600, minWidth: 72 }}
                        />
                      </TableCell>
                      <TableCell>
                        {r.status === "confirmed" ? (
                          <CheckCircleIcon fontSize="small" color="success" />
                        ) : r.status === "rejected" ? (
                          <CancelIcon fontSize="small" color="error" />
                        ) : (
                          <Chip label="Pending" size="small" color="warning" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
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
