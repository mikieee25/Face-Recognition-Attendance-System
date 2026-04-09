"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

type ScheduleType = "regular" | "shifting" | "leave";

interface ScheduleDto {
  id?: number;
  personnelId?: number;
  date: string;
  type: ScheduleType;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

interface ScheduleOverride {
  type: ScheduleType;
  shiftStartTime: string;
  shiftEndTime: string;
}

const DEFAULT_SHIFT_START = "08:00";
const DEFAULT_SHIFT_END = "17:00";

const TYPE_COLORS: Record<ScheduleType, string> = {
  regular: "#ffffff",
  shifting: "#ff9800",
  leave: "#CDB4F5",
};

function normalizeTimeForInput(value?: string | null): string {
  if (!value) return DEFAULT_SHIFT_START;
  return value.slice(0, 5);
}

function formatShiftRange(start?: string, end?: string): string {
  return `${normalizeTimeForInput(start)} - ${normalizeTimeForInput(end ?? DEFAULT_SHIFT_END)}`;
}

function getDefaultSchedule(): ScheduleOverride {
  return {
    type: "regular",
    shiftStartTime: DEFAULT_SHIFT_START,
    shiftEndTime: DEFAULT_SHIFT_END,
  };
}

function toOverride(schedule?: ScheduleDto): ScheduleOverride {
  if (!schedule) return getDefaultSchedule();
  return {
    type: schedule.type,
    shiftStartTime: normalizeTimeForInput(schedule.shiftStartTime),
    shiftEndTime: normalizeTimeForInput(
      schedule.shiftEndTime ?? DEFAULT_SHIFT_END,
    ),
  };
}

function formatSectionLabel(section: Personnel["section"]): string {
  return section === "admin" ? "Administrative" : "Operation";
}

export default function SchedulePageClient() {
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(
    null,
  );
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const { data: personnelList = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data || [];
    },
  });

  const { data: stationsData = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
  });

  const stationMap = new Map(
    stationsData.map((station) => [station.id, station.name]),
  );

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: allSchedules = [], isLoading: isLoadingAllSchedules } =
    useQuery({
      queryKey: ["schedules", "today", todayStr],
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<ScheduleDto[]>>(
          `/api/v1/schedule?date=${todayStr}`,
        );
        return res.data.data || [];
      },
    });

  return (
    <Box sx={(theme) => ({ p: theme.spacing(3) })}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Schedule Management
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Select Personnel
          </Typography>
          {isLoadingPersonnel || isLoadingAllSchedules ? (
            <Typography>Loading...</Typography>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Rank</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Station</TableCell>
                    <TableCell>Section</TableCell>
                    <TableCell>Today&apos;s Schedule</TableCell>
                    <TableCell>Shift Window</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personnelList.map((person) => {
                    const todaySched = allSchedules.find(
                      (schedule) =>
                        schedule.personnelId === person.id &&
                        schedule.date === todayStr,
                    );
                    const scheduleType = todaySched?.type ?? "regular";
                    const shiftStartTime =
                      todaySched?.shiftStartTime ?? DEFAULT_SHIFT_START;
                    const shiftEndTime =
                      todaySched?.shiftEndTime ?? DEFAULT_SHIFT_END;

                    return (
                      <TableRow key={person.id} hover>
                        <TableCell>{person.rank || ""}</TableCell>
                        <TableCell>{`${person.firstName} ${person.lastName}`}</TableCell>
                        <TableCell>
                          {stationMap.get(person.stationId) ??
                            `Station #${person.stationId}`}
                        </TableCell>
                        <TableCell>
                          {formatSectionLabel(person.section)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              scheduleType.charAt(0).toUpperCase() +
                              scheduleType.slice(1)
                            }
                            color={
                              scheduleType === "shifting"
                                ? "warning"
                                : scheduleType === "regular"
                                  ? "success"
                                  : "default"
                            }
                            variant={
                              scheduleType === "regular" ? "outlined" : "filled"
                            }
                            size="small"
                            sx={
                              scheduleType === "leave"
                                ? {
                                    bgcolor: "#CDB4F5",
                                    color: "#4E3A74",
                                  }
                                : undefined
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {formatShiftRange(shiftStartTime, shiftEndTime)}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setSelectedPersonnel(person)}
                          >
                            View / Edit Schedule
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {selectedPersonnel && (
        <ScheduleModal
          personnel={selectedPersonnel}
          open={!!selectedPersonnel}
          onClose={() => setSelectedPersonnel(null)}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
        />
      )}
    </Box>
  );
}

function ScheduleModal({
  personnel,
  open,
  onClose,
  currentDate,
  setCurrentDate,
}: {
  personnel: Personnel;
  open: boolean;
  onClose: () => void;
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}) {
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevMonth, setPrevMonth] = useState(currentDate.getMonth());
  const [prevYear, setPrevYear] = useState(currentDate.getFullYear());
  const [overrides, setOverrides] = useState<Record<string, ScheduleOverride>>(
    {},
  );
  const queryClient = useQueryClient();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { data: existingSchedules = [], isLoading: isLoadingSchedules } =
    useQuery({
      queryKey: ["schedules", personnel.id, year, month + 1],
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<ScheduleDto[]>>(
          `/api/v1/schedule/personnel/${personnel.id}?year=${year}&month=${
            month + 1
          }`,
        );
        return res.data.data || [];
      },
      enabled: open,
    });

  // Sync state derived from props (React 18 style)
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setSelectedDate(null);
      setOverrides({});
    } else {
      setSelectedDate(`${year}-${String(month + 1).padStart(2, "0")}-01`);
    }
  } else if (open && (month !== prevMonth || year !== prevYear)) {
    setPrevMonth(month);
    setPrevYear(year);
    setSelectedDate(`${year}-${String(month + 1).padStart(2, "0")}-01`);
  }

  const mutation = useMutation({
    mutationFn: async (
      schedules: Array<{
        date: string;
        type: ScheduleType;
        shiftStartTime: string;
        shiftEndTime: string;
      }>,
    ) => {
      return apiClient.post(`/api/v1/schedule/personnel/${personnel.id}`, {
        schedules,
      });
    },
    onSuccess: () => {
      setToast({
        open: true,
        message: "Schedule saved successfully",
        severity: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      setOverrides({});
      onClose();
    },
    onError: () => {
      setToast({
        open: true,
        message: "Failed to save schedule",
        severity: "error",
      });
    },
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setOverrides({});
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setOverrides({});
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const days = useMemo(() => {
    const arr: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      arr.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
        i,
      ).padStart(2, "0")}`;
      arr.push({ date: dateStr, day: i });
    }
    return arr;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  const getScheduleForDate = (dateStr: string): ScheduleOverride => {
    if (overrides[dateStr]) return overrides[dateStr];
    const existing = existingSchedules.find(
      (schedule) => schedule.date === dateStr,
    );
    return toOverride(existing);
  };

  const updateSelectedDate = (
    field: keyof ScheduleOverride,
    value: ScheduleOverride[keyof ScheduleOverride],
  ) => {
    if (!selectedDate) return;
    setOverrides((prev) => ({
      ...prev,
      [selectedDate]: {
        ...getScheduleForDate(selectedDate),
        [field]: value,
      },
    }));
  };

  const handleSave = () => {
    const schedulesToSave = Object.entries(overrides).map(
      ([date, schedule]) => ({
        date,
        type: schedule.type,
        shiftStartTime: schedule.shiftStartTime,
        shiftEndTime: schedule.shiftEndTime,
      }),
    );
    mutation.mutate(schedulesToSave);
  };

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const selectedSchedule = selectedDate
    ? getScheduleForDate(selectedDate)
    : getDefaultSchedule();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Schedule: {personnel.firstName} {personnel.lastName}
      </DialogTitle>
      <DialogContent dividers>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <IconButton onClick={handlePrevMonth}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6">
            {monthName} {year}
          </Typography>
          <IconButton onClick={handleNextMonth}>
            <ChevronRightIcon />
          </IconButton>
        </Stack>

        <Stack
          direction="row"
          spacing={2}
          sx={{ mb: 2, justifyContent: "center" }}
        >
          <LegendItem type="regular" label="Regular" />
          <LegendItem type="shifting" label="Shifting" />
          <LegendItem type="leave" label="Leave" />
        </Stack>

        {isLoadingSchedules ? (
          <Typography textAlign="center">Loading schedules...</Typography>
        ) : (
          <Stack spacing={3}>
            <Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 1,
                  mb: 1,
                  textAlign: "center",
                }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <Typography
                      key={day}
                      variant="subtitle2"
                      color="text.secondary"
                    >
                      {day}
                    </Typography>
                  ),
                )}
              </Box>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 1,
                }}
              >
                {days.map((dayObj, index) => {
                  if (!dayObj) {
                    return <Box key={`empty-${index}`} />;
                  }
                  const { date, day } = dayObj;
                  const schedule = getScheduleForDate(date);
                  const isSelected = date === selectedDate;

                  return (
                    <Box
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      sx={(theme) => ({
                        aspectRatio: "1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        border: `2px solid ${
                          isSelected
                            ? theme.palette.primary.main
                            : theme.palette.divider
                        }`,
                        borderRadius: 1,
                        backgroundColor: TYPE_COLORS[schedule.type],
                        color:
                          schedule.type === "regular" ? "text.primary" : "#fff",
                        transition: "background-color 0.2s, border-color 0.2s",
                        "&:hover": {
                          opacity: 0.85,
                        },
                      })}
                    >
                      <Typography>{day}</Typography>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {selectedDate && (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Edit {selectedDate}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel id="schedule-type-label">
                        Schedule Type
                      </InputLabel>
                      <Select
                        labelId="schedule-type-label"
                        value={selectedSchedule.type}
                        label="Schedule Type"
                        onChange={(event) =>
                          updateSelectedDate(
                            "type",
                            event.target.value as ScheduleType,
                          )
                        }
                      >
                        <MenuItem value="regular">Regular</MenuItem>
                        <MenuItem value="shifting">Shifting</MenuItem>
                        <MenuItem value="leave">Leave</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Shift Start"
                      type="time"
                      value={selectedSchedule.shiftStartTime}
                      onChange={(event) =>
                        updateSelectedDate("shiftStartTime", event.target.value)
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      disabled={selectedSchedule.type === "leave"}
                    />
                    <TextField
                      label="Shift End"
                      type="time"
                      value={selectedSchedule.shiftEndTime}
                      onChange={(event) =>
                        updateSelectedDate("shiftEndTime", event.target.value)
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      fullWidth
                      disabled={selectedSchedule.type === "leave"}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Default shift window is {DEFAULT_SHIFT_START} -{" "}
                    {DEFAULT_SHIFT_END}. Regular days using the default window
                    will not create an override row.
                  </Typography>
                </Stack>
              </Paper>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={mutation.isPending || Object.keys(overrides).length === 0}
        >
          {mutation.isPending ? "Saving..." : "Save Schedule"}
        </Button>
      </DialogActions>
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

function LegendItem({ type, label }: { type: ScheduleType; label: string }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      <Box
        sx={(theme) => ({
          width: 16,
          height: 16,
          borderRadius: "50%",
          backgroundColor: TYPE_COLORS[type],
          border:
            type === "regular" ? `1px solid ${theme.palette.divider}` : "none",
        })}
      />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}

