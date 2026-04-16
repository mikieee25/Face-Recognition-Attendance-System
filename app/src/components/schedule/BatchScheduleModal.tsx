"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

interface Props {
  open: boolean;
  onClose: () => void;
  personnelIds: number[];
  onSuccess: () => void;
}

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function BatchScheduleModal({ open, onClose, personnelIds, onSuccess }: Props) {
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [scheduleType, setScheduleType] = useState<"regular" | "shifting" | "leave">("regular");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");

  const mutation = useMutation({
    mutationFn: async () => {
      if (!startDate || !endDate) return;

      const start = new Date(startDate);
      const end = new Date(endDate);
      const targetDates: string[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (scheduleType === "leave" || selectedDays.includes(d.getDay())) {
          // format YYYY-MM-DD
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          targetDates.push(dateStr);
        }
      }

      if (targetDates.length === 0) {
        throw new Error("No dates match the selected days of the week in the given range.");
      }

      const schedules = targetDates.map((date) => ({
        date,
        type: scheduleType,
        shiftStartTime: startTime,
        shiftEndTime: endTime,
      }));

      // Fire requests for all personnel in parallel
      await Promise.all(personnelIds.map((id) => apiClient.post(`/api/v1/schedule/personnel/${id}`, { schedules })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      alert(error?.message || "Failed to save batch schedules");
    },
  });

  const handleToggleDay = (dayValue: number) => {
    setSelectedDays((prev) => (prev.includes(dayValue) ? prev.filter((d) => d !== dayValue) : [...prev, dayValue]));
  };

  const isFormValid =
    startDate && endDate && new Date(startDate) <= new Date(endDate) && (scheduleType === "leave" || selectedDays.length > 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Batch Assign Schedule</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            Assign a schedule to {personnelIds.length} personnel at once.
          </Typography>

          <Stack direction="row" spacing={2}>
            <TextField
              label="Start Date"
              type="date"
              fullWidth
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Date"
              type="date"
              fullWidth
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          {scheduleType !== "leave" && (
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Apply to Days of Week:
              </Typography>
              <FormGroup row>
                {DAYS_OF_WEEK.map((day) => (
                  <FormControlLabel
                    key={day.value}
                    control={<Checkbox checked={selectedDays.includes(day.value)} onChange={() => handleToggleDay(day.value)} />}
                    label={day.label}
                  />
                ))}
              </FormGroup>
            </Box>
          )}

          <FormControl fullWidth>
            <InputLabel>Schedule Type</InputLabel>
            <Select
              value={scheduleType}
              label="Schedule Type"
              onChange={(e) => setScheduleType(e.target.value as "regular" | "shifting" | "leave")}
            >
              <MenuItem value="regular">Regular</MenuItem>
              <MenuItem value="shifting">Shifting</MenuItem>
              <MenuItem value="leave">Leave</MenuItem>
            </Select>
          </FormControl>

          {scheduleType !== "leave" && (
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start Time"
                type="time"
                fullWidth
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="End Time"
                type="time"
                fullWidth
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, px: 3 }}>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button variant="contained" disabled={!isFormValid || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? "Saving..." : "Save Batch"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
