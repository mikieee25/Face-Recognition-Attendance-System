"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { AttendanceRecord, Personnel } from "@/types/models";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AttendanceFilters {
  dateFrom: string;
  dateTo: string;
  personnelId: string;
  type: string; // '' | 'time_in' | 'time_out'
}

interface EditPayload {
  type?: "time_in" | "time_out";
  status?: "confirmed" | "pending" | "rejected";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(
  status: string,
): "success" | "warning" | "error" | "default" {
  if (status === "confirmed") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "error";
  return "default";
}

function typeLabel(type: string): string {
  if (type === "time_in") return "Time In";
  if (type === "time_out") return "Time Out";
  return type;
}

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchAttendance(
  page: number,
  limit: number,
  filters: AttendanceFilters,
): Promise<PaginatedResponse<AttendanceRecord>> {
  const params: Record<string, string | number> = { page: page + 1, limit };
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.personnelId) params.personnelId = filters.personnelId;
  if (filters.type) params.type = filters.type;

  const res = await apiClient.get<
    ApiEnvelope<PaginatedResponse<AttendanceRecord>>
  >("/api/v1/attendance", { params });
  return res.data.data!;
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res =
    await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
  return res.data.data ?? [];
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

interface EditDialogProps {
  record: AttendanceRecord | null;
  open: boolean;
  onClose: () => void;
  onSave: (id: number, payload: EditPayload) => void;
  saving: boolean;
}

function EditDialog({
  record,
  open,
  onClose,
  onSave,
  saving,
}: EditDialogProps) {
  const [type, setType] = useState<"time_in" | "time_out">(
    record?.type ?? "time_in",
  );
  const [status, setStatus] = useState<"confirmed" | "pending" | "rejected">(
    record?.status ?? "confirmed",
  );

  // Sync local state when record changes
  if (record && record.type !== type && !saving) {
    setType(record.type);
  }
  if (record && record.status !== status && !saving) {
    setStatus(record.status);
  }

  const handleSave = () => {
    if (!record) return;
    onSave(record.id, { type, status });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Attendance Record</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth>
            <InputLabel id="edit-type-label">Type</InputLabel>
            <Select
              labelId="edit-type-label"
              value={type}
              label="Type"
              onChange={(e) =>
                setType(e.target.value as "time_in" | "time_out")
              }
            >
              <MenuItem value="time_in">Time In</MenuItem>
              <MenuItem value="time_out">Time Out</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="edit-status-label">Status</InputLabel>
            <Select
              labelId="edit-status-label"
              value={status}
              label="Status"
              onChange={(e) =>
                setStatus(
                  e.target.value as "confirmed" | "pending" | "rejected",
                )
              }
            >
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Delete Confirmation Dialog ───────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  deleting,
}: DeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Attendance Record</DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          Are you sure you want to delete this attendance record? This action
          cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={deleting}
        >
          {deleting ? <CircularProgress size={18} color="inherit" /> : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AttendanceHistoryGrid() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Filters
  const [filters, setFilters] = useState<AttendanceFilters>({
    dateFrom: "",
    dateTo: "",
    personnelId: "",
    type: "",
  });

  // Edit dialog
  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  // Delete dialog
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Data queries ────────────────────────────────────────────────────────────

  const {
    data: attendanceData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["attendance", { page, limit: rowsPerPage, ...filters }],
    queryFn: () => fetchAttendance(page, rowsPerPage, filters),
  });

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "list"],
    queryFn: fetchPersonnel,
  });

  const rows = attendanceData?.items ?? [];
  const total = attendanceData?.total ?? 0;

  // Build personnel lookup map for displaying names
  const personnelMap = new Map(
    personnelList.map((p) => [p.id, `${p.rank} ${p.firstName} ${p.lastName}`]),
  );

  // ── Mutations ───────────────────────────────────────────────────────────────

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: EditPayload;
    }) => {
      const res = await apiClient.patch<ApiEnvelope<AttendanceRecord>>(
        `/api/v1/attendance/${id}`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setEditOpen(false);
      setEditRecord(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/api/v1/attendance/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setDeleteOpen(false);
      setDeleteId(null);
    },
  });

  // ── Role-based permissions ──────────────────────────────────────────────────

  const canEdit = user?.role === "admin" || user?.role === "station_user";
  const canDelete = user?.role === "admin";

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFilterChange =
    (field: keyof AttendanceFilters) =>
    (e: React.ChangeEvent<HTMLInputElement | { value: unknown }>) => {
      setFilters((prev) => ({
        ...prev,
        [field]: e.target.value as string,
      }));
      setPage(0);
    };

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleEditOpen = (record: AttendanceRecord) => {
    setEditRecord(record);
    setEditOpen(true);
  };

  const handleEditClose = () => {
    setEditOpen(false);
    setEditRecord(null);
  };

  const handleEditSave = (id: number, payload: EditPayload) => {
    editMutation.mutate({ id, payload });
  };

  const handleDeleteOpen = (id: number) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteOpen(false);
    setDeleteId(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteId !== null) {
      deleteMutation.mutate(deleteId);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="h5">Attendance History</Typography>

      {/* Filters */}
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.dateFrom}
            onChange={handleFilterChange("dateFrom")}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.dateTo}
            onChange={handleFilterChange("dateTo")}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ minWidth: 160 }}
          />

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="filter-personnel-label">Personnel</InputLabel>
            <Select
              labelId="filter-personnel-label"
              value={filters.personnelId}
              label="Personnel"
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  personnelId: e.target.value as string,
                }))
              }
            >
              <MenuItem value="">All</MenuItem>
              {personnelList.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.rank} {p.firstName} {p.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="filter-type-label">Type</InputLabel>
            <Select
              labelId="filter-type-label"
              value={filters.type}
              label="Type"
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  type: e.target.value as string,
                }))
              }
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="time_in">Time In</MenuItem>
              <MenuItem value="time_out">Time Out</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <Paper>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress aria-label="Loading attendance records" />
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 2 }}>
            <Alert severity="error">
              {(error as { message?: string })?.message ??
                "Failed to load attendance records. Please try again."}
            </Alert>
          </Box>
        )}

        {!isLoading && !isError && (
          <>
            <TableContainer sx={{ overflowX: "auto" }}>
              <Table
                aria-label="Attendance history table"
                sx={{ minWidth: 500 }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Personnel</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Status</TableCell>
                    {(canEdit || canDelete) && (
                      <TableCell align="center">Actions</TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={canEdit || canDelete ? 6 : 5}
                        align="center"
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No attendance records found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((record) => (
                      <TableRow key={record.id} hover>
                        <TableCell>
                          {personnelMap.get(record.personnelId) ?? "—"}
                        </TableCell>
                        <TableCell>{formatDate(record.createdAt)}</TableCell>
                        <TableCell>{formatTime(record.createdAt)}</TableCell>
                        <TableCell>{typeLabel(record.type)}</TableCell>
                        <TableCell>
                          <Chip
                            label={record.status}
                            color={statusColor(record.status)}
                            size="small"
                            sx={{ textTransform: "capitalize" }}
                          />
                        </TableCell>
                        {(canEdit || canDelete) && (
                          <TableCell align="center">
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="center"
                            >
                              {canEdit && (
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    aria-label={`Edit record ${record.id}`}
                                    onClick={() => handleEditOpen(record)}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              {canDelete && (
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label={`Delete record ${record.id}`}
                                    onClick={() => handleDeleteOpen(record.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[10, 20, 50]}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
      </Paper>

      {/* Edit Dialog */}
      <EditDialog
        record={editRecord}
        open={editOpen}
        onClose={handleEditClose}
        onSave={handleEditSave}
        saving={editMutation.isPending}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteDialog
        open={deleteOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        deleting={deleteMutation.isPending}
      />
    </Box>
  );
}
