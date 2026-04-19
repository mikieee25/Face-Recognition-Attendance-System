"use client";

import { useEffect, useState } from "react";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
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
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import WallpaperIcon from "@mui/icons-material/Wallpaper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { useAuth } from "@/hooks/useAuth";
import { buildImageUrl, getPersonnelInitials } from "@/lib/personnel-display";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const RANK_OPTIONS = [
  { value: "NUP", label: "NUP" },
  { value: "FO1", label: "Fire Officer 1" },
  { value: "FO2", label: "Fire Officer 2" },
  { value: "FO3", label: "Fire Officer 3" },
  { value: "SFO1", label: "Senior Fire Officer 1" },
  { value: "SFO2", label: "Senior Fire Officer 2" },
  { value: "SFO3", label: "Senior Fire Officer 3" },
  { value: "SFO4", label: "Senior Fire Officer 4" },
  { value: "INSP", label: "Fire Inspector" },
  { value: "SINSP", label: "Fire Senior Inspector" },
  { value: "CINSP", label: "Fire Chief Inspector" },
  { value: "SUPT", label: "Fire Superintendent" },
  { value: "SSUPT", label: "Fire Senior Superintendent" },
  { value: "CSUPT", label: "Fire Chief Superintendent" },
  { value: "FDIR", label: "Fire Director" },
] as const;

const LEGACY_RANK_TO_CODE: Record<string, string> = {
  "Fire Officer 1": "FO1",
  "Fire Officer 2": "FO2",
  "Fire Officer 3": "FO3",
  "Senior Fire Officer 1": "SFO1",
  "Senior Fire Officer 2": "SFO2",
  "Senior Fire Officer 3": "SFO3",
  "Senior Fire Officer 4": "SFO4",
  "Fire Inspector": "INSP",
  "Fire Senior Inspector": "SINSP",
  "Fire Chief Inspector": "CINSP",
  "Fire Superintendent": "SUPT",
  "Fire Senior Superintendent": "SSUPT",
  "Fire Chief Superintendent": "CSUPT",
  "Fire Director": "FDIR",
};

function normalizeRank(rank: string): string {
  if (!rank) return "";
  if (RANK_OPTIONS.some((option) => option.value === rank)) {
    return rank;
  }
  return LEGACY_RANK_TO_CODE[rank] ?? rank;
}

function formatSectionLabel(section: "admin" | "operation"): string {
  return section === "admin" ? "Administrative" : "Operation";
}

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
  section: "admin" | "operation";
  stationId: string;
  address: string;
  contactNumber: string;
  gender: string;
  photo?: string;
  coverPhoto?: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  rank?: string;
  section?: string;
  stationId?: string;
}

const INITIAL_VALUES: FormValues = {
  firstName: "",
  lastName: "",
  rank: "",
  section: "admin",
  stationId: "",
  address: "",
  contactNumber: "",
  gender: "",
  photo: undefined,
  coverPhoto: undefined,
};

function validate(values: FormValues, isAdmin: boolean): FormErrors {
  const errors: FormErrors = {};
  if (!values.firstName.trim()) errors.firstName = "First name is required.";
  if (!values.lastName.trim()) errors.lastName = "Last name is required.";
  if (!values.rank) errors.rank = "Rank is required.";
  if (!values.section) errors.section = "Section is required.";
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
          rank: normalizeRank(personnel.rank),
          section: personnel.section,
          stationId: String(personnel.stationId),
          address: personnel.address ?? "",
          contactNumber: personnel.contactNumber ?? "",
          gender: personnel.gender ?? "",
          photo: undefined,
          coverPhoto: undefined,
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

  const handleImageFileChange = (field: "photo" | "coverPhoto") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setValues((prev) => ({ ...prev, [field]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const profilePreviewSrc = values.photo || buildImageUrl(personnel?.imagePath);
  const coverPreviewSrc = values.coverPhoto || buildImageUrl(personnel?.coverImagePath);

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
        section: values.section,
        address: values.address.trim(),
        contactNumber: values.contactNumber.trim(),
        gender: values.gender,
      };

      if (values.photo) {
        payload.photo = values.photo;
      }

      if (values.coverPhoto) {
        payload.coverPhoto = values.coverPhoto;
      }

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
          <Box
            sx={{
              position: "relative",
              minHeight: 220,
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              backgroundImage: coverPreviewSrc
                ? `linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.74) 100%), url("${coverPreviewSrc}")`
                : "none",
              backgroundColor: "#ffffff",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <input
              accept="image/*"
              style={{ display: "none" }}
              id="personnel-photo-upload"
              type="file"
              onChange={handleImageFileChange("photo")}
              disabled={submitting}
            />
            <input
              accept="image/*"
              style={{ display: "none" }}
              id="personnel-cover-upload"
              type="file"
              onChange={handleImageFileChange("coverPhoto")}
              disabled={submitting}
            />
            <Box
              sx={{
                position: "relative",
                zIndex: 1,
                minHeight: 220,
                p: 2.5,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  Card Media Preview
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Upload a profile photo and an optional cover photo for the new card layout.
                </Typography>
              </Box>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                alignItems={{ xs: "flex-start", sm: "flex-end" }}
                justifyContent="space-between"
              >
                <Avatar
                  src={profilePreviewSrc}
                  sx={{
                    width: 100,
                    height: 100,
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    fontSize: "1.65rem",
                    fontWeight: 700,
                    border: "4px solid rgba(255,255,255,0.94)",
                    boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
                  }}
                >
                  {!profilePreviewSrc && getPersonnelInitials(values.firstName, values.lastName)}
                </Avatar>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <label htmlFor="personnel-cover-upload">
                    <Button component="span" variant="outlined" startIcon={<WallpaperIcon />} disabled={submitting}>
                      Cover Photo
                    </Button>
                  </label>
                  <label htmlFor="personnel-photo-upload">
                    <Button component="span" variant="contained" startIcon={<CameraAltIcon />} disabled={submitting}>
                      Profile Photo
                    </Button>
                  </label>
                </Stack>
              </Stack>
            </Box>
          </Box>

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
            <FormControl fullWidth required error={Boolean(errors.rank)}>
              <InputLabel>Rank</InputLabel>
              <Select value={values.rank} label="Rank" onChange={(e) => handleChange("rank", e.target.value)} disabled={submitting}>
                {RANK_OPTIONS.map((rank) => (
                  <MenuItem key={rank.value} value={rank.value}>
                    {rank.label}
                  </MenuItem>
                ))}
              </Select>
              {errors.rank && <FormHelperText>{errors.rank}</FormHelperText>}
            </FormControl>

            <FormControl fullWidth required error={Boolean(errors.section)}>
              <InputLabel>Section</InputLabel>
              <Select
                value={values.section}
                label="Section"
                onChange={(e) => handleChange("section", e.target.value)}
                disabled={submitting}
              >
                <MenuItem value="admin">{formatSectionLabel("admin")}</MenuItem>
                <MenuItem value="operation">{formatSectionLabel("operation")}</MenuItem>
              </Select>
              {errors.section && <FormHelperText>{errors.section}</FormHelperText>}
            </FormControl>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
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
