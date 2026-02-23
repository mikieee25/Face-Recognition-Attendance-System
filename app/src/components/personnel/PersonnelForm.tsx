"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const RANKS = [
  "Fire Officer I",
  "Fire Officer II",
  "Fire Officer III",
  "Senior Fire Officer I",
  "Senior Fire Officer II",
  "Senior Fire Officer III",
  "Senior Fire Officer IV",
  "Chief Fire Officer",
  "Fire Chief",
];

interface PersonnelFormProps {
  open: boolean;
  onClose: () => void;
  personnel?: Personnel;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  rank: string;
  stationId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  isShifting: boolean;
  shiftStartDate: string;
  shiftDurationDays: number;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  rank?: string;
  stationId?: string;
}

const INITIAL_VALUES: FormValues = {
  firstName: "",
  lastName: "",
  rank: "",
  stationId: "",
  shiftStartTime: "08:00",
  shiftEndTime: "17:00",
  isShifting: false,
  shiftStartDate: "",
  shiftDurationDays: 15,
};

function validate(values: FormValues, isAdmin: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.rank) errors.rank = "Rank is required.";
  if (isAdmin && !values.stationId) errors.stationId = "Station is required.";
  return errors;
}

export default function PersonnelForm({
  open,
  onClose,
  personnel,
  onSuccess,
  onError,
}: PersonnelFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "admin";
  const isEditMode = Boolean(personnel);

  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (personnel) {
        setValues({
          firstName: personnel.firstName,
          lastName: personnel.lastName,
          rank: personnel.rank,
          stationId: String(personnel.stationId),
          shiftStartTime: personnel.shiftStartTime ?? "08:00",
          shiftEndTime: personnel.shiftEndTime ?? "17:00",
          isShifting: personnel.isShifting ?? false,
          shiftStartDate: personnel.shiftStartDate ?? "",
          shiftDurationDays: personnel.shiftDurationDays ?? 15,
        });
      } else {
        setValues(INITIAL_VALUES);
      }
      setErrors({});
    }
  }, [open, personnel]);

  // Fetch stations for all users — admin needs the dropdown, station_user needs the label
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
    enabled: open,
  });
  const stations: Station[] = stationsData ?? [];

  // For station_user: resolve their station name
  const userStationName =
    !isAdmin && user?.stationId
      ? (stations.find((s) => s.id === user.stationId)?.name ??
        `Station #${user.stationId}`)
      : "";

  function handleChange(field: keyof FormValues, value: unknown) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (field in errors) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  async function handleSubmit() {
    const validationErrors = validate(values, isAdmin);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        rank: values.rank,
        shiftStartTime: values.shiftStartTime || "08:00",
        shiftEndTime: values.shiftEndTime || "17:00",
        isShifting: values.isShifting,
      };

      if (isAdmin) {
        payload.stationId = Number(values.stationId);
      }

      if (values.isShifting) {
        if (values.shiftStartDate)
          payload.shiftStartDate = values.shiftStartDate;
        payload.shiftDurationDays = values.shiftDurationDays;
      }

      if (isEditMode && personnel) {
        await apiClient.patch(`/api/v1/personnel/${personnel.id}`, payload);
      } else {
        await apiClient.post("/api/v1/personnel", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["personnel"] });
      onSuccess?.(
        isEditMode
          ? "Personnel updated successfully."
          : "Personnel added successfully.",
      );
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "An unexpected error occurred.";
      onError?.(
        typeof message === "string" ? message : "An unexpected error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="personnel-form-title"
    >
      <DialogTitle id="personnel-form-title">
        {isEditMode ? "Edit Personnel" : "Add Personnel"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Basic Info */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="First Name"
              value={values.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              error={Boolean(errors.firstName)}
              helperText={errors.firstName}
              disabled={submitting}
              fullWidth
              required
            />
            <TextField
              label="Last Name"
              value={values.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              error={Boolean(errors.lastName)}
              helperText={errors.lastName}
              disabled={submitting}
              fullWidth
              required
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {/* Rank Dropdown */}
            <FormControl fullWidth required error={Boolean(errors.rank)}>
              <InputLabel>Rank</InputLabel>
              <Select
                value={values.rank}
                label="Rank"
                onChange={(e) => handleChange("rank", e.target.value)}
                disabled={submitting}
              >
                {RANKS.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </Select>
              {errors.rank && <FormHelperText>{errors.rank}</FormHelperText>}
            </FormControl>

            {/* Station — Admin: dropdown, Station user: read-only */}
            {isAdmin ? (
              <FormControl fullWidth required error={Boolean(errors.stationId)}>
                <InputLabel>Station</InputLabel>
                <Select
                  value={values.stationId}
                  label="Station"
                  onChange={(e) => handleChange("stationId", e.target.value)}
                  disabled={submitting}
                >
                  {stations.map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
                {errors.stationId && (
                  <FormHelperText>{errors.stationId}</FormHelperText>
                )}
              </FormControl>
            ) : (
              <TextField
                label="Station"
                value={userStationName}
                fullWidth
                disabled
                helperText="Auto-assigned from your account"
              />
            )}
          </Stack>

          {/* Shift Schedule Section */}
          <Divider />
          <Typography variant="subtitle2" color="primary" fontWeight={600}>
            Shift Schedule
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Shift Start Time"
              type="time"
              value={values.shiftStartTime}
              onChange={(e) => handleChange("shiftStartTime", e.target.value)}
              disabled={submitting}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Default work start time"
            />
            <TextField
              label="Shift End Time"
              type="time"
              value={values.shiftEndTime}
              onChange={(e) => handleChange("shiftEndTime", e.target.value)}
              disabled={submitting}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
              helperText="Default work end time"
            />
          </Stack>

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={values.isShifting}
                  onChange={(e) => handleChange("isShifting", e.target.checked)}
                  disabled={submitting}
                />
              }
              label="Rotation Shift"
            />
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              Enable for rotation schedule
            </Typography>
          </Box>

          {values.isShifting && (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Shift Cycle Start Date"
                type="date"
                value={values.shiftStartDate}
                onChange={(e) => handleChange("shiftStartDate", e.target.value)}
                disabled={submitting}
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
                helperText="When does their current shift cycle begin?"
              />
              <TextField
                label="Shift Duration (Days)"
                type="number"
                value={values.shiftDurationDays}
                onChange={(e) =>
                  handleChange("shiftDurationDays", Number(e.target.value))
                }
                disabled={submitting}
                fullWidth
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { min: 1, max: 60 },
                }}
                helperText="Number of days ON duty (same for OFF)"
              />
            </Stack>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} /> : undefined}
        >
          {isEditMode ? "Save" : "Add Personnel"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
