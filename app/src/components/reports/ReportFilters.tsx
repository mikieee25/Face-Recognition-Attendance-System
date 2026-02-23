"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

export interface ReportFilterValues {
  dateFrom: string;
  dateTo: string;
  stationId: string;
  personnelId: string;
  type: string;
}

interface ReportFiltersProps {
  value: ReportFilterValues;
  onChange: (filters: ReportFilterValues) => void;
}

const MAX_RANGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

function validateDateRange(dateFrom: string, dateTo: string): string | null {
  if (!dateFrom || !dateTo) return null;
  const from = new Date(dateFrom).getTime();
  const to = new Date(dateTo).getTime();
  if (to < from) return "End date must be after start date.";
  if (to - from > MAX_RANGE_MS) return "Date range cannot exceed 1 year.";
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (to > today.getTime()) return "End date cannot be in the future.";
  return null;
}

async function fetchStations(): Promise<Station[]> {
  const res = await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
  return res.data.data ?? [];
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res =
    await apiClient.get<
      ApiEnvelope<Personnel[] | PaginatedResponse<Personnel>>
    >("/api/v1/personnel");
  const payload = res.data.data;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return (payload as PaginatedResponse<Personnel>).items ?? [];
}

export default function ReportFilters({ value, onChange }: ReportFiltersProps) {
  // Local state for debouncing date inputs
  const [localDateFrom, setLocalDateFrom] = useState(value.dateFrom);
  const [localDateTo, setLocalDateTo] = useState(value.dateTo);
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: stations = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
  });

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "list"],
    queryFn: fetchPersonnel,
  });

  // Debounce date inputs — 400ms delay before propagating to parent
  useEffect(() => {
    const timer = setTimeout(() => {
      const err = validateDateRange(localDateFrom, localDateTo);
      setDateError(err);
      if (!err) {
        onChange({ ...value, dateFrom: localDateFrom, dateTo: localDateTo });
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localDateFrom, localDateTo]);

  const handleSelectChange =
    (field: keyof ReportFilterValues) => (newValue: string) => {
      onChange({ ...value, [field]: newValue });
    };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
        Filters
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        flexWrap="wrap"
        useFlexGap
      >
        {/* Date From */}
        <Box sx={{ minWidth: 160 }}>
          <TextField
            label="From"
            type="date"
            size="small"
            fullWidth
            value={localDateFrom}
            onChange={(e) => setLocalDateFrom(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!dateError}
            aria-label="Start date"
          />
        </Box>

        {/* Date To */}
        <Box sx={{ minWidth: 160 }}>
          <TextField
            label="To"
            type="date"
            size="small"
            fullWidth
            value={localDateTo}
            onChange={(e) => setLocalDateTo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            error={!!dateError}
            aria-label="End date"
          />
          {dateError && (
            <FormHelperText error sx={{ mx: 0 }}>
              {dateError}
            </FormHelperText>
          )}
        </Box>

        {/* Station */}
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="filter-station-label">Station</InputLabel>
          <Select
            labelId="filter-station-label"
            value={value.stationId}
            label="Station"
            onChange={(e) =>
              handleSelectChange("stationId")(e.target.value as string)
            }
          >
            <MenuItem value="">All Stations</MenuItem>
            {stations.map((s) => (
              <MenuItem key={s.id} value={String(s.id)}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Personnel */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="filter-personnel-label">Personnel</InputLabel>
          <Select
            labelId="filter-personnel-label"
            value={value.personnelId}
            label="Personnel"
            onChange={(e) =>
              handleSelectChange("personnelId")(e.target.value as string)
            }
          >
            <MenuItem value="">All Personnel</MenuItem>
            {personnelList.map((p) => (
              <MenuItem key={p.id} value={String(p.id)}>
                {p.rank} {p.firstName} {p.lastName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Attendance Type */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="filter-type-label">Type</InputLabel>
          <Select
            labelId="filter-type-label"
            value={value.type}
            label="Type"
            onChange={(e) =>
              handleSelectChange("type")(e.target.value as string)
            }
          >
            <MenuItem value="">All Types</MenuItem>
            <MenuItem value="time_in">Time In</MenuItem>
            <MenuItem value="time_out">Time Out</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    </Paper>
  );
}
