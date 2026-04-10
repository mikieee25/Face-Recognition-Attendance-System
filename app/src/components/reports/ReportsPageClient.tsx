"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import ExportButtons from "./ExportButtons";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: string;
  status: "present" | "late" | "leave" | "shifting" | "future";
}

interface CalendarPersonnelItem {
  personnelId: number;
  name: string;
  rank: string;
  station: string;
  imagePath: string | null;
  calendar: CalendarDay[];
}

// ─── Constants & Helpers ──────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LEAVE_COLOR = "#6F42A6";
const LEAVE_TEXT_COLOR = "#FFFFFF";

function formatDateParam(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const getStatusColor = (status: CalendarDay["status"]) => {
  switch (status) {
    case "present":
      return "#4caf50"; // success
    case "late":
      return "#f9a825"; // warning
    case "leave":
      return LEAVE_COLOR;
    case "shifting":
      return "#2196f3"; // info
    case "future":
    default:
      return "#f5f5f5"; // grey[100]
  }
};

const getTextColor = (status: CalendarDay["status"]) => {
  if (status === "leave") return LEAVE_TEXT_COLOR;
  return status === "future" ? "text.secondary" : "#fff";
};

// ─── Components ───────────────────────────────────────────────────────────────

function PersonnelCard({ item, year, month }: { item: CalendarPersonnelItem; year: number; month: number }) {
  // Determine padding for the start of the month
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const paddingCells = Array.from({ length: firstDayOfWeek }).map((_, i) => <Box key={`pad-${i}`} sx={{ aspectRatio: "1/1" }} />);

  return (
    <Paper
      sx={(theme) => ({
        p: theme.spacing(2),
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
        height: "100%",
      })}
    >
      {/* Top Part: Profile Info */}
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar
          src={item.imagePath ? `${process.env.NEXT_PUBLIC_API_URL || ""}${item.imagePath}` : undefined}
          alt={item.name}
          sx={{ width: 64, height: 64, flexShrink: 0 }}
        />
        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="h6" sx={{ wordWrap: "break-word" }}>
            {item.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {item.rank} • {item.station}
          </Typography>
        </Box>
      </Stack>

      {/* Bottom Part: Calendar Grid */}
      <Box sx={{ mt: "auto" }}>
        <Box
          sx={(theme) => ({
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: theme.spacing(0.5),
          })}
        >
          {/* Day Headers */}
          {DAYS_OF_WEEK.map((d) => (
            <Typography key={d} variant="caption" align="center" sx={{ fontWeight: "bold", mb: 0.5 }}>
              {d}
            </Typography>
          ))}

          {/* Empty cells before 1st of month */}
          {paddingCells}

          {/* Actual days */}
          {item.calendar.map((day) => {
            const dayNumber = parseInt(day.date.split("-")[2], 10);
            return (
              <Box
                key={day.date}
                sx={{
                  aspectRatio: "1/1",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: getStatusColor(day.status),
                  borderRadius: 1,
                  color: getTextColor(day.status),
                }}
                title={`${day.date}: ${day.status}`}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  {dayNumber}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function ReportsPageClient() {
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const exportFilters = {
    dateFrom: formatDateParam(year, month, 1),
    dateTo: formatDateParam(year, month, daysInMonth),
    stationId: "",
    personnelId: "",
    type: "",
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reports", "calendar", year, month],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<CalendarPersonnelItem[]>>("/api/v1/reports/calendar", { params: { year, month } });
      return res.data.data ?? [];
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  return (
    <Box sx={(theme) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(3) })}>
      {/* Header & Controls */}
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Box>
          <Typography variant="h5">Personnel Attendance Calendar</Typography>
          <Typography variant="body2" color="text.secondary">
            Export covers the selected month.
          </Typography>
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ width: { xs: "100%", md: "auto" } }}
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="month-select-label">Month</InputLabel>
            <Select labelId="month-select-label" value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="year-select-label">Year</InputLabel>
            <Select labelId="year-select-label" value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <MenuItem key={y} value={y}>
                  {y}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ExportButtons filters={exportFilters} />
        </Stack>
      </Stack>

      {/* Legend */}
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
        {[
          { label: "Present", status: "present" as const },
          { label: "Late", status: "late" as const },
          { label: "Leave", status: "leave" as const },
          { label: "Shifting", status: "shifting" as const },
        ].map((legend) => (
          <Stack key={legend.status} direction="row" alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 16,
                height: 16,
                bgcolor: getStatusColor(legend.status),
                borderRadius: 0.5,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {legend.label}
            </Typography>
          </Stack>
        ))}
      </Stack>

      {/* Content Area */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading calendar data" />
        </Box>
      ) : isError ? (
        <Alert severity="error">{(error as { message?: string })?.message ?? "Failed to load calendar data."}</Alert>
      ) : !data || data.length === 0 ? (
        <Alert severity="info">No personnel found for the selected criteria.</Alert>
      ) : (
        <Box
          sx={(theme) => ({
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            },
            gap: theme.spacing(2),
          })}
        >
          {data.map((item) => (
            <PersonnelCard key={item.personnelId} item={item} year={year} month={month} />
          ))}
        </Box>
      )}
    </Box>
  );
}
