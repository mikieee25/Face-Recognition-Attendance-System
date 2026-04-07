"use client";

import { useEffect, useState } from "react";

import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";

import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";

import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const RANKS = [
  "NUP",
  "Fire Officer 1",
  "Fire Officer 2",
  "Fire Officer 3",
  "Senior Fire Officer 1",
  "Senior Fire Officer 2",
  "Senior Fire Officer 3",
  "Senior Fire Officer 4",
  "Fire Inspector",
  "Fire Senior Inspector",
  "Fire Chief Inspector",
  "Fire Superintendent",
  "Fire Senior Superintendent",
  "Fire Chief Superintendent",
  "Fire Director",
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
  address: string;
  contactNumber: string;
  gender: string;
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
  address: "",
  contactNumber: "",
  gender: "",
};

function validate(values: FormValues, isAdmin: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.rank) errors.rank = "Rank is required.";
  if (isAdmin && !values.stationId) errors.stationId = "Station is required.";
  return errors;
}

export default function PersonnelForm({ open, onClose, personnel, onSuccess, onError }: PersonnelFormProps) {
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
          address: personnel.address ?? "",
          contactNumber: personnel.contactNumber ?? "",
          gender: personnel.gender ?? "",
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
      const res = await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
    enabled: open,
  });
  const stations: Station[] = stationsData ?? [];

  // For station_user: resolve their station name
  const userStationName =
    !isAdmin && user?.stationId ? (stations.find((s) => s.id === user.stationId)?.name ?? `Station #${user.stationId}`) : "";

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
        address: values.address.trim(),
        contactNumber: values.contactNumber.trim(),
        gender: values.gender,
      };

      if (isAdmin) {
        payload.stationId = Number(values.stationId);
      }

      if (isEditMode && personnel) {
        await apiClient.patch(`/api/v1/personnel/${personnel.id}`, payload);
      } else {
        await apiClient.post("/api/v1/personnel", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["personnel"] });
      onSuccess?.(isEditMode ? "Personnel updated successfully." : "Personnel added successfully.");
      onClose();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const raw = data?.message;
      const message = Array.isArray(raw) ? raw.join(" • ") : typeof raw === "string" ? raw : "An unexpected error occurred.";
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="personnel-form-title">
      <DialogTitle id="personnel-form-title">{isEditMode ? "Edit Personnel" : "Add Personnel"}</DialogTitle>

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
              <Select value={values.rank} label="Rank" onChange={(e) => handleChange("rank", e.target.value)} disabled={submitting}>
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
                {errors.stationId && <FormHelperText>{errors.stationId}</FormHelperText>}
              </FormControl>
            ) : (
              <TextField label="Station" value={userStationName} fullWidth disabled helperText="Auto-assigned from your account" />
            )}
          </Stack>

          {/* Additional Info Section */}
          <Divider />
          <Typography variant="subtitle2" color="primary" fontWeight={600}>
            Additional Information
          </Typography>

          <TextField
            label="Address"
            value={values.address}
            onChange={(e) => handleChange("address", e.target.value)}
            disabled={submitting}
            fullWidth
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Contact Number"
              value={values.contactNumber}
              onChange={(e) => handleChange("contactNumber", e.target.value)}
              disabled={submitting}
              fullWidth
            />
            <FormControl fullWidth disabled={submitting}>
              <InputLabel>Gender</InputLabel>
              <Select value={values.gender} label="Gender" onChange={(e) => handleChange("gender", e.target.value)}>
                <MenuItem value="Male">Male</MenuItem>
                <MenuItem value="Female">Female</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
          </Stack>
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
