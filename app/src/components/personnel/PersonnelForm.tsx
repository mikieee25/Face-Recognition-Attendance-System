"use client";

import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";

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
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  rank?: string;
  stationId?: string;
}

function validate(values: FormValues, isAdmin: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.rank.trim()) errors.rank = "Rank is required.";
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

  const [values, setValues] = useState<FormValues>({
    firstName: "",
    lastName: "",
    rank: "",
    stationId: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (personnel) {
        setValues({
          firstName: personnel.firstName,
          lastName: personnel.lastName,
          rank: personnel.rank,
          stationId: String(personnel.stationId),
        });
      } else {
        setValues({ firstName: "", lastName: "", rank: "", stationId: "" });
      }
      setErrors({});
    }
  }, [open, personnel]);

  // Fetch stations for Admin station selector
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<PaginatedResponse<Station>>>(
          "/api/v1/stations",
        );
      // API may return array or paginated object
      const payload = res.data.data;
      if (Array.isArray(payload)) return payload as Station[];
      return (payload as PaginatedResponse<Station>).items ?? [];
    },
    enabled: isAdmin && open,
  });
  const stations: Station[] = stationsData ?? [];

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
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
        rank: values.rank.trim(),
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
          <TextField
            label="First Name"
            value={values.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            error={Boolean(errors.firstName)}
            helperText={errors.firstName}
            disabled={submitting}
            fullWidth
            required
            inputProps={{ "aria-label": "First name" }}
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
            inputProps={{ "aria-label": "Last name" }}
          />

          <TextField
            label="Rank"
            value={values.rank}
            onChange={(e) => handleChange("rank", e.target.value)}
            error={Boolean(errors.rank)}
            helperText={errors.rank}
            disabled={submitting}
            fullWidth
            required
            inputProps={{ "aria-label": "Rank" }}
          />

          {isAdmin && (
            <FormControl fullWidth required error={Boolean(errors.stationId)}>
              <InputLabel id="station-select-label">Station</InputLabel>
              <Select
                labelId="station-select-label"
                label="Station"
                value={values.stationId}
                onChange={(e) => handleChange("stationId", e.target.value)}
                disabled={submitting}
                inputProps={{ "aria-label": "Station" }}
              >
                {stations.map((station) => (
                  <MenuItem key={station.id} value={String(station.id)}>
                    {station.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.stationId && (
                <FormHelperText>{errors.stationId}</FormHelperText>
              )}
            </FormControl>
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
          aria-label={isEditMode ? "Save changes" : "Add personnel"}
        >
          {isEditMode ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
