"use client";

import { useState, useEffect } from "react";
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
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel } from "@/types/models";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function KioskManualModal({ open, onClose, onSuccess }: Props) {
  const [personnelId, setPersonnelId] = useState("");
  const [type, setType] = useState("time_in");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "kiosk"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      setPersonnelId("");
      setType("time_in");
      setDate(new Date().toISOString().slice(0, 16));
      setError(null);
    }
  }, [open]);

  async function handleSubmit() {
    if (!personnelId || !date) {
      setError("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/api/v1/attendance/manual", {
        personnelId: Number(personnelId),
        type,
        date: new Date(date).toISOString(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Submission failed.";
      setError(typeof msg === "string" ? msg : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
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
        Manual Attendance Entry
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={2.5}>
          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <FormControl fullWidth required>
            <InputLabel>Personnel</InputLabel>
            <Select
              value={personnelId}
              label="Personnel"
              onChange={(e) => setPersonnelId(e.target.value)}
            >
              {personnelList.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.rank} {p.firstName} {p.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Type</InputLabel>
            <Select
              value={type}
              label="Type"
              onChange={(e) => setType(e.target.value)}
            >
              <MenuItem value="time_in">Time In</MenuItem>
              <MenuItem value="time_out">Time Out</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Date & Time"
            type="datetime-local"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            fullWidth
            required
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{ color: "#7a9cc0" }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          Submit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
