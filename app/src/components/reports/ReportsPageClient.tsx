"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import ExportButtons from "./ExportButtons";

interface CalendarDay {
  date: string;
  status: "present" | "late" | "absent" | "leave" | "shifting" | "off_duty" | "future";
}

interface CalendarPersonnelItem {
  personnelId: number;
  name: string;
  rank: string;
  station: string;
  imagePath: string | null;
  calendar: CalendarDay[];
}

interface CalendarDayPersonnelDetail {
  personnelId: number;
  name: string;
  rank: string;
  station: string;
  imagePath: string | null;
}

interface CalendarDateSummaryItem {
  date: string;
  isFuture: boolean;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  shiftingCount: number;
  leaveCount: number;
  offDutyCount: number;
  presentPersonnel: CalendarDayPersonnelDetail[];
  latePersonnel: CalendarDayPersonnelDetail[];
  absentPersonnel: CalendarDayPersonnelDetail[];
  shiftingPersonnel: CalendarDayPersonnelDetail[];
  leavePersonnel: CalendarDayPersonnelDetail[];
  offDutyPersonnel: CalendarDayPersonnelDetail[];
}

type ReportView = "personnel" | "date";

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_META = {
  present: { label: "Present", color: "#4caf50", textColor: "#fff" },
  late: { label: "Late", color: "#f9a825", textColor: "#fff" },
  absent: { label: "Absent", color: "#c62828", textColor: "#fff" },
  leave: { label: "Leave", color: "#6F42A6", textColor: "#fff" },
  shifting: { label: "Shifting", color: "#2196f3", textColor: "#fff" },
  off_duty: { label: "Off Duty", color: "#cfd8dc", textColor: "#455a64" },
  future: { label: "Future", color: "#f5f5f5", textColor: "text.secondary" },
} as const;
const DATE_VIEW_STATUS_SECTIONS = [
  { key: "presentPersonnel", countKey: "presentCount", label: "Present", color: "#4caf50" },
  { key: "latePersonnel", countKey: "lateCount", label: "Late", color: "#f9a825" },
  { key: "absentPersonnel", countKey: "absentCount", label: "Absent", color: "#c62828" },
  { key: "shiftingPersonnel", countKey: "shiftingCount", label: "Shifting", color: "#2196f3" },
  { key: "leavePersonnel", countKey: "leaveCount", label: "On Leave", color: "#6F42A6" },
  { key: "offDutyPersonnel", countKey: "offDutyCount", label: "Off Duty", color: "#78909c" },
] as const;

function formatDateParam(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplayDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildImageSrc(imagePath: string | null): string | undefined {
  if (!imagePath) return undefined;
  return `${process.env.NEXT_PUBLIC_API_URL || ""}${imagePath}`;
}

function getStatusColor(status: string) {
  return (STATUS_META[status as CalendarDay["status"]] ?? STATUS_META.off_duty).color;
}

function getStatusTextColor(status: string) {
  return (STATUS_META[status as CalendarDay["status"]] ?? STATUS_META.off_duty).textColor;
}

function PersonnelCard({ item, year, month }: { item: CalendarPersonnelItem; year: number; month: number }) {
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
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar src={buildImageSrc(item.imagePath)} alt={item.name} sx={{ width: 64, height: 64, flexShrink: 0 }} />
        <Box sx={{ overflow: "hidden" }}>
          <Typography variant="h6" sx={{ wordWrap: "break-word" }}>
            {item.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {item.rank} • {item.station}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ mt: "auto" }}>
        <Box
          sx={(theme) => ({
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: theme.spacing(0.5),
          })}
        >
          {DAYS_OF_WEEK.map((day) => (
            <Typography key={day} variant="caption" align="center" sx={{ fontWeight: "bold", mb: 0.5 }}>
              {day}
            </Typography>
          ))}

          {paddingCells}

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
                  color: getStatusTextColor(day.status),
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

function DateSummaryCalendar({
  summary,
  year,
  month,
  onSelectDate,
}: {
  summary: CalendarDateSummaryItem[];
  year: number;
  month: number;
  onSelectDate: (item: CalendarDateSummaryItem) => void;
}) {
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const paddingCells = Array.from({ length: firstDayOfWeek }).map((_, i) => (
    <Box
      key={`pad-${i}`}
      sx={{
        minHeight: { xs: 110, md: 140 },
        borderRadius: 2,
        border: "1px dashed",
        borderColor: "divider",
        bgcolor: "action.hover",
      }}
    />
  ));

  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: theme.spacing(1.5),
      })}
    >
      {DAYS_OF_WEEK.map((day) => (
        <Typography key={day} variant="subtitle2" align="center" sx={{ fontWeight: 700, py: 1 }}>
          {day}
        </Typography>
      ))}

      {paddingCells}

      {summary.map((item) => {
        const dayNumber = parseInt(item.date.split("-")[2], 10);
        const total = item.presentCount + item.lateCount + item.absentCount + item.shiftingCount + item.leaveCount + item.offDutyCount;

        return (
          <Paper
            key={item.date}
            onClick={() => {
              if (!item.isFuture) onSelectDate(item);
            }}
            sx={(theme) => ({
              minHeight: { xs: 110, md: 140 },
              p: theme.spacing(1.25),
              borderRadius: theme.spacing(2),
              border: "1px solid",
              borderColor: item.isFuture ? "divider" : "rgba(25, 118, 210, 0.16)",
              backgroundColor: item.isFuture ? "action.hover" : "background.paper",
              cursor: item.isFuture ? "default" : "pointer",
              opacity: item.isFuture ? 0.7 : 1,
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
              "&:hover": item.isFuture
                ? undefined
                : {
                    transform: "translateY(-2px)",
                    boxShadow: theme.shadows[3],
                  },
              display: "flex",
              flexDirection: "column",
              gap: theme.spacing(0.75),
            })}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={800}>
                {dayNumber}
              </Typography>
              {!item.isFuture && (
                <Typography variant="caption" color="text.secondary">
                  {total} total
                </Typography>
              )}
            </Stack>

            {item.isFuture ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: "auto" }}>
                No data yet
              </Typography>
            ) : (
              <Stack spacing={0.5} sx={{ mt: "auto" }}>
                <Typography variant="caption" sx={{ color: "#4caf50", fontWeight: 700 }}>
                  {item.presentCount} present
                </Typography>
                <Typography variant="caption" sx={{ color: "#f9a825", fontWeight: 700 }}>
                  {item.lateCount} late
                </Typography>
                <Typography variant="caption" sx={{ color: "#c62828", fontWeight: 700 }}>
                  {item.absentCount} absent
                </Typography>
                <Typography variant="caption" sx={{ color: "#2196f3", fontWeight: 700 }}>
                  {item.shiftingCount} shifting
                </Typography>
                <Typography variant="caption" sx={{ color: "#6F42A6", fontWeight: 700 }}>
                  {item.leaveCount} on leave
                </Typography>
                {item.offDutyCount > 0 && (
                  <Typography variant="caption" sx={{ color: "#78909c", fontWeight: 700 }}>
                    {item.offDutyCount} off duty
                  </Typography>
                )}
              </Stack>
            )}
          </Paper>
        );
      })}
    </Box>
  );
}

function DateDetailsModal({
  selectedDate,
  open,
  onClose,
}: {
  selectedDate: CalendarDateSummaryItem | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{selectedDate ? formatDisplayDate(selectedDate.date) : "Attendance Details"}</DialogTitle>
      <DialogContent dividers>
        {!selectedDate ? null : (
          <Stack spacing={2.5}>
            {DATE_VIEW_STATUS_SECTIONS.map((section) => {
              const people = selectedDate[section.key];
              const count = selectedDate[section.countKey];

              return (
                <Box
                  key={section.key}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{
                      px: 2,
                      py: 1.25,
                      bgcolor: `${section.color}14`,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: section.color }}>
                      {section.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {count} personnel
                    </Typography>
                  </Stack>

                  {people.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        No personnel in this status for the selected date.
                      </Typography>
                    </Box>
                  ) : (
                    <Stack spacing={1} sx={{ p: 2 }}>
                      {people.map((person) => (
                        <Stack
                          key={`${section.key}-${person.personnelId}`}
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{
                            p: 1.25,
                            borderRadius: 1.5,
                            bgcolor: "background.default",
                          }}
                        >
                          <Avatar src={buildImageSrc(person.imagePath)} alt={person.name} />
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700}>
                              {person.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {person.rank} • {person.station}
                            </Typography>
                          </Box>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              );
            })}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ReportsPageClient() {
  const now = new Date();
  const [view, setView] = useState<ReportView>("date");
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<CalendarDateSummaryItem | null>(null);
  const daysInMonth = new Date(year, month, 0).getDate();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;
  const exportFilters = {
    dateFrom: formatDateParam(year, month, 1),
    dateTo: formatDateParam(
      year,
      month,
      isCurrentMonth ? now.getDate() : daysInMonth
    ),
    stationId: "",
    personnelId: "",
    type: "",
  };

  const { data: personnelData, isLoading: personnelLoading, isError: personnelError, error: personnelQueryError } = useQuery({
    queryKey: ["reports", "calendar", year, month],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<CalendarPersonnelItem[]>>("/api/v1/reports/calendar", { params: { year, month } });
      return res.data.data ?? [];
    },
    enabled: view === "personnel",
  });

  const { data: dateSummaryData, isLoading: dateSummaryLoading, isError: dateSummaryError, error: dateSummaryQueryError } = useQuery({
    queryKey: ["reports", "calendar-date-summary", year, month],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<CalendarDateSummaryItem[]>>("/api/v1/reports/calendar-date-summary", {
        params: { year, month },
      });
      return res.data.data ?? [];
    },
    enabled: view === "date",
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

  const activeError = view === "personnel" ? personnelQueryError : dateSummaryQueryError;
  const activeIsError = view === "personnel" ? personnelError : dateSummaryError;
  const activeIsLoading = view === "personnel" ? personnelLoading : dateSummaryLoading;
  const activeDataLength = view === "personnel" ? personnelData?.length ?? 0 : dateSummaryData?.length ?? 0;

  const viewTitle = view === "personnel" ? "Personnel Attendance Calendar" : "Attendance Summary by Date";
  const viewDescription =
    view === "personnel"
      ? "Review the whole month per personnel."
      : "Click a date to inspect who is present, late, absent, shifting, or on leave.";

  const selectedDateData = useMemo(() => {
    if (!selectedDate || !dateSummaryData) return null;
    return dateSummaryData.find((item) => item.date === selectedDate.date) ?? selectedDate;
  }, [dateSummaryData, selectedDate]);

  const segmentedControl = (
    <Paper
      sx={{
        p: 0.75,
        width: "fit-content",
        maxWidth: "100%",
        borderRadius: 999,
        bgcolor: "#f3f4f6",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "none",
      }}
    >
      <Tabs
        value={view}
        onChange={(_, nextValue: ReportView) => setView(nextValue)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{
          minHeight: 0,
          "& .MuiTabs-indicator": {
            display: "none",
          },
        }}
      >
        <Tab
          value="date"
          label="By Date"
          sx={{
            minHeight: 42,
            px: 2.5,
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 700,
            color: "text.secondary",
            transition: "all 0.18s ease",
            "&.Mui-selected": {
              color: "#c62828",
              bgcolor: "background.paper",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
            },
          }}
        />
        <Tab
          value="personnel"
          label="By Personnel"
          sx={{
            minHeight: 42,
            px: 2.5,
            borderRadius: 999,
            textTransform: "none",
            fontWeight: 700,
            color: "text.secondary",
            transition: "all 0.18s ease",
            "&.Mui-selected": {
              color: "#c62828",
              bgcolor: "background.paper",
              boxShadow: "0 2px 10px rgba(15, 23, 42, 0.08)",
            },
          }}
        />
      </Tabs>
    </Paper>
  );

  return (
    <Box sx={(theme) => ({ display: "flex", flexDirection: "column", gap: theme.spacing(3) })}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "center", lg: "center" }}
        spacing={2}
        sx={{
          textAlign: { xs: "center", lg: "left" },
        }}
      >
        <Box sx={{ flex: { lg: 1 }, width: { xs: "100%", lg: "auto" } }}>
          <Typography variant="h5">{viewTitle}</Typography>
          <Typography variant="body2" color="text.secondary">
            {viewDescription}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", flex: { lg: 1 }, width: { xs: "100%", lg: "auto" } }}>
          {segmentedControl}
        </Box>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ width: { xs: "100%", lg: "auto" }, justifyContent: { xs: "center", lg: "flex-end" }, flex: { lg: 1 } }}
          alignItems="center"
        >
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="month-select-label">Month</InputLabel>
            <Select labelId="month-select-label" value={month} label="Month" onChange={(e) => setMonth(Number(e.target.value))}>
              {months.map((item) => (
                <MenuItem key={item.value} value={item.value}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 100 }}>
            <InputLabel id="year-select-label">Year</InputLabel>
            <Select labelId="year-select-label" value={year} label="Year" onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((item) => (
                <MenuItem key={item} value={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ExportButtons filters={exportFilters} />
        </Stack>
      </Stack>

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          {[
            { label: "Present", status: "present" as const },
            { label: "Late", status: "late" as const },
            { label: "Absent", status: "absent" as const },
            { label: "Leave", status: "leave" as const },
            { label: "Shifting", status: "shifting" as const },
            { label: "Off Duty", status: "off_duty" as const },
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

      {activeIsLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading reports calendar data" />
        </Box>
      ) : activeIsError ? (
        <Alert severity="error">{(activeError as { message?: string })?.message ?? "Failed to load calendar data."}</Alert>
      ) : activeDataLength === 0 ? (
        <Alert severity="info">No personnel found for the selected criteria.</Alert>
      ) : view === "personnel" ? (
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
          {(personnelData ?? []).map((item) => (
            <PersonnelCard key={item.personnelId} item={item} year={year} month={month} />
          ))}
        </Box>
      ) : (
        <DateSummaryCalendar summary={dateSummaryData ?? []} year={year} month={month} onSelectDate={setSelectedDate} />
      )}

      <DateDetailsModal selectedDate={selectedDateData} open={!!selectedDateData} onClose={() => setSelectedDate(null)} />
    </Box>
  );
}
