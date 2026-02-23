"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { Personnel } from "@/types/models";

interface ManualEntryPayload {
  personnelId: number;
  type: "time_in" | "time_out";
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ManualEntryForm() {
  const qc = useQueryClient();

  // Form state
  const [personnelId, setPersonnelId] = useState<string>("");
  const [type, setType] = useState<"time_in" | "time_out">("time_in");
  const [date, setDate] = useState<string>(getTodayString());
  const [time, setTime] = useState<string>("");

  // Validation
  const [dateError, setDateError] = useState<string>("");

  // Toast state
  const [toast, setToast] = useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  // Fetch personnel list
  const { data: personnelData, isLoading: personnelLoading } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const res =
        await apiClient.get<
          ApiEnvelope<Personnel[] | PaginatedResponse<Personnel>>
        >("/api/v1/personnel");
      const payload = res.data.data;
      if (!payload) return [] as Personnel[];
      // Handle both array and paginated response shapes
      if (Array.isArray(payload)) return payload;
      return (payload as PaginatedResponse<Personnel>).items ?? [];
    },
  });

  const personnel: Personnel[] = personnelData ?? [];

  // Submit mutation
  const mutation = useMutation({
    mutationFn: async (payload: ManualEntryPayload) => {
      const res = await apiClient.post<ApiEnvelope<unknown>>(
        "/api/v1/attendance/manual",
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      // Clear form
      setPersonnelId("");
      setType("time_in");
      setDate(getTodayString());
      setTime("");
      setDateError("");
      // Invalidate attendance queries so history refreshes
      qc.invalidateQueries({ queryKey: ["attendance"] });
      setToast({
        open: true,
        severity: "success",
        message: "Attendance entry recorded successfully.",
      });
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to submit attendance entry. Please try again.";
      setToast({ open: true, severity: "error", message });
    },
  });

  const validateDate = (value: string): boolean => {
    if (!value) {
      setDateError("Date is required.");
      return false;
    }
    const selected = new Date(value);
    const today = new Date(getTodayString());
    if (selected > today) {
      setDateError("Date cannot be in the future.");
      return false;
    }
    setDateError("");
    return true;
  };

  const handleDateChange = (value: string) => {
    setDate(value);
    validateDate(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateDate(date)) return;
    if (!personnelId || !time) return;

    mutation.mutate({
      personnelId: Number(personnelId),
      type,
      date,
      time,
    });
  };

  const isSubmitting = mutation.isPending;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ width: "100%", maxWidth: 480 }}
      aria-label="Manual attendance entry form"
    >
      <Stack spacing={3}>
        {/* Personnel select */}
        <FormControl fullWidth required disabled={personnelLoading}>
          <InputLabel id="personnel-label">Personnel</InputLabel>
          <Select
            labelId="personnel-label"
            id="personnel-select"
            value={personnelId}
            label="Personnel"
            onChange={(e) => setPersonnelId(e.target.value as string)}
            inputProps={{ "aria-label": "Select personnel" }}
          >
            {personnelLoading && (
              <MenuItem disabled value="">
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={16} />
                  <Typography variant="body2">Loading...</Typography>
                </Stack>
              </MenuItem>
            )}
            {personnel.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.rank} {p.firstName} {p.lastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Attendance type select */}
        <FormControl fullWidth required>
          <InputLabel id="type-label">Attendance Type</InputLabel>
          <Select
            labelId="type-label"
            id="type-select"
            value={type}
            label="Attendance Type"
            onChange={(e) => setType(e.target.value as "time_in" | "time_out")}
            inputProps={{ "aria-label": "Select attendance type" }}
          >
            <MenuItem value="time_in">Time In</MenuItem>
            <MenuItem value="time_out">Time Out</MenuItem>
          </Select>
        </FormControl>

        {/* Date picker (native fallback) */}
        <TextField
          id="date-input"
          label="Date"
          type="date"
          required
          fullWidth
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          error={Boolean(dateError)}
          helperText={dateError || " "}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { max: getTodayString(), "aria-label": "Select date" },
          }}
        />

        {/* Time picker (native fallback) */}
        <TextField
          id="time-input"
          label="Time"
          type="time"
          required
          fullWidth
          value={time}
          onChange={(e) => setTime(e.target.value)}
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { "aria-label": "Select time" },
          }}
        />

        {/* Submit button */}
        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={
            isSubmitting || !personnelId || !date || !time || Boolean(dateError)
          }
          aria-label="Submit manual attendance entry"
        >
          {isSubmitting ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={20} color="inherit" />
              <Typography variant="button">Submitting...</Typography>
            </Stack>
          ) : (
            "Submit Entry"
          )}
        </Button>
      </Stack>

      {/* Success / Error Snackbar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
