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
import Typography from "@mui/material/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { User, Station, Role } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  user?: User;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

interface FormValues {
  username: string;
  email: string;
  password: string;
  role: Role | "";
  stationId: string;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  stationId?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_UPPERCASE = /[A-Z]/;
const PASSWORD_DIGIT = /[0-9]/;

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!PASSWORD_UPPERCASE.test(password))
    return "Password must contain at least 1 uppercase letter.";
  if (!PASSWORD_DIGIT.test(password))
    return "Password must contain at least 1 digit.";
  return undefined;
}

function validate(values: FormValues, isEditMode: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!values.username.trim()) errors.username = "Username is required.";
  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!EMAIL_REGEX.test(values.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!isEditMode) {
    // Password required on create
    if (!values.password) {
      errors.password = "Password is required.";
    } else {
      const pwError = validatePassword(values.password);
      if (pwError) errors.password = pwError;
    }
  } else if (values.password) {
    // Password optional on edit — validate only if provided
    const pwError = validatePassword(values.password);
    if (pwError) errors.password = pwError;
  }

  if (!values.role) errors.role = "Role is required.";

  if (
    (values.role === "station_user" || values.role === "kiosk") &&
    !values.stationId
  ) {
    errors.stationId = "Station is required for this role.";
  }

  return errors;
}

export default function UserForm({
  open,
  onClose,
  user,
  onSuccess,
  onError,
}: UserFormProps) {
  const queryClient = useQueryClient();
  const isEditMode = Boolean(user);

  const [values, setValues] = useState<FormValues>({
    username: "",
    email: "",
    password: "",
    role: "",
    stationId: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (user) {
        setValues({
          username: user.username,
          email: user.email,
          password: "",
          role: user.role,
          stationId: user.stationId ? String(user.stationId) : "",
        });
      } else {
        setValues({
          username: "",
          email: "",
          password: "",
          role: "",
          stationId: "",
        });
      }
      setErrors({});
      setApiError(null);
    }
  }, [open, user]);

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

  const needsStation =
    values.role === "station_user" || values.role === "kiosk";

  function handleChange(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if (apiError) setApiError(null);
    // Clear stationId error when role changes away from station-required roles
    if (field === "role" && value !== "station_user" && value !== "kiosk") {
      setErrors((prev) => ({ ...prev, stationId: undefined }));
    }
  }

  async function handleSubmit() {
    const validationErrors = validate(values, isEditMode);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setApiError(null);
    try {
      const payload: Record<string, unknown> = {
        username: values.username.trim(),
        email: values.email.trim(),
        role: values.role,
      };

      if (values.password) {
        payload.password = values.password;
      }

      if (needsStation && values.stationId) {
        payload.stationId = Number(values.stationId);
      } else if (!needsStation) {
        // admin role doesn't require stationId
        if (values.stationId) {
          payload.stationId = Number(values.stationId);
        }
      }

      if (isEditMode && user) {
        await apiClient.patch(`/api/v1/users/${user.id}`, payload);
      } else {
        await apiClient.post("/api/v1/users", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.(
        isEditMode
          ? "User updated successfully."
          : "User created successfully.",
      );
      onClose();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "An unexpected error occurred.";
      const errorText =
        typeof message === "string" ? message : "An unexpected error occurred.";
      setApiError(errorText);
      onError?.(errorText);
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
      aria-labelledby="user-form-title"
    >
      <DialogTitle id="user-form-title">
        {isEditMode ? "Edit User" : "Add User"}
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {apiError && (
            <Typography color="error" variant="body2">
              {apiError}
            </Typography>
          )}

          <TextField
            label="Username"
            value={values.username}
            onChange={(e) => handleChange("username", e.target.value)}
            error={Boolean(errors.username)}
            helperText={errors.username}
            disabled={submitting}
            fullWidth
            required
            inputProps={{ "aria-label": "Username" }}
          />

          <TextField
            label="Email"
            type="email"
            value={values.email}
            onChange={(e) => handleChange("email", e.target.value)}
            error={Boolean(errors.email)}
            helperText={errors.email}
            disabled={submitting}
            fullWidth
            required
            inputProps={{ "aria-label": "Email" }}
          />

          <TextField
            label={
              isEditMode
                ? "Password (leave blank to keep existing)"
                : "Password"
            }
            type="password"
            value={values.password}
            onChange={(e) => handleChange("password", e.target.value)}
            error={Boolean(errors.password)}
            helperText={
              errors.password ??
              "Min 8 characters, 1 uppercase letter, 1 digit."
            }
            disabled={submitting}
            fullWidth
            required={!isEditMode}
            inputProps={{ "aria-label": "Password" }}
          />

          <FormControl fullWidth required error={Boolean(errors.role)}>
            <InputLabel id="role-select-label">Role</InputLabel>
            <Select
              labelId="role-select-label"
              label="Role"
              value={values.role}
              onChange={(e) => handleChange("role", e.target.value)}
              disabled={submitting}
              inputProps={{ "aria-label": "Role" }}
            >
              <MenuItem value="admin">Admin</MenuItem>
              <MenuItem value="station_user">Station User</MenuItem>
              <MenuItem value="kiosk">Kiosk</MenuItem>
            </Select>
            {errors.role && <FormHelperText>{errors.role}</FormHelperText>}
          </FormControl>

          {needsStation && (
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
          aria-label={isEditMode ? "Save changes" : "Add user"}
        >
          {isEditMode ? "Save" : "Add"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
