"use client";

import { useState, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";

import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

interface Personnel {
  id: number;
  firstName: string;
  lastName: string;
  rank?: { name: string } | string;
}

type ScheduleType = "regular" | "shifting" | "leave";

interface ScheduleDto {
  id?: number;
  personnelId?: number;
  date: string; // YYYY-MM-DD
  type: ScheduleType;
}

interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

const TYPE_COLORS: Record<ScheduleType, string> = {
  regular: "#ffffff",
  shifting: "#ff9800", // orange
  leave: "#9c27b0", // purple
};

const NEXT_TYPE: Record<ScheduleType, ScheduleType> = {
  regular: "shifting",
  shifting: "leave",
  leave: "regular",
};

export default function SchedulePageClient() {
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const { data: personnelList = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data || [];
    },
  });

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: allSchedules = [], isLoading: isLoadingAllSchedules } = useQuery({
    queryKey: ["schedules", "today", todayStr],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ScheduleDto[]>>(`/api/v1/schedule?date=${todayStr}`);
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
                    <TableCell>Today&apos;s Schedule</TableCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {personnelList.map((person) => {
                    const todaySched = allSchedules.find((s) => s.personnelId === person.id && s.date === todayStr);
                    const scheduleType = todaySched ? todaySched.type : "regular";
                    return (
                      <TableRow key={person.id} hover>
                        <TableCell>{typeof person.rank === "object" ? person.rank?.name : person.rank || ""}</TableCell>
                        <TableCell>{`${person.firstName} ${person.lastName}`}</TableCell>
                        <TableCell>
                          <Chip
                            label={scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
                            color={scheduleType === "shifting" ? "warning" : scheduleType === "leave" ? "secondary" : "success"}
                            variant={scheduleType === "regular" ? "outlined" : "filled"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Button variant="outlined" size="small" onClick={() => setSelectedPersonnel(person)}>
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
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false,
    message: "",
    severity: "success",
  });
  const queryClient = useQueryClient();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11

  const { data: existingSchedules = [], isLoading: isLoadingSchedules } = useQuery({
    queryKey: ["schedules", personnel.id, year, month + 1],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ScheduleDto[]>>(
        `/api/v1/schedule/personnel/${personnel.id}?year=${year}&month=${month + 1}`,
      );
      return res.data.data || [];
    },
    enabled: open,
  });

  const [overrides, setOverrides] = useState<Record<string, ScheduleType>>({});

  const mutation = useMutation({
    mutationFn: async (schedules: { date: string; type: ScheduleType }[]) => {
      return apiClient.post(`/api/v1/schedule/personnel/${personnel.id}`, { schedules });
    },
    onSuccess: () => {
      setToast({ open: true, message: "Schedule saved successfully", severity: "success" });
      queryClient.invalidateQueries({ queryKey: ["schedules", personnel.id] });
      setOverrides({});
      onClose();
    },
    onError: () => {
      setToast({ open: true, message: "Failed to save schedule", severity: "error" });
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
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  const days = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      arr.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      arr.push({ date: dateStr, day: i });
    }
    return arr;
  }, [year, month, daysInMonth, firstDayOfWeek]);

  const handleDayClick = (dateStr: string) => {
    const currentType = getTypeForDate(dateStr);
    const nextType = NEXT_TYPE[currentType];
    setOverrides((prev) => ({ ...prev, [dateStr]: nextType }));
  };

  const getTypeForDate = (dateStr: string): ScheduleType => {
    if (overrides[dateStr]) {
      return overrides[dateStr];
    }
    const existing = existingSchedules.find((s) => s.date === dateStr);
    return existing ? existing.type : "regular";
  };

  const handleSave = () => {
    const schedulesToSave = Object.entries(overrides).map(([date, type]) => ({
      date,
      type,
    }));
    mutation.mutate(schedulesToSave);
  };

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Schedule: {personnel.firstName} {personnel.lastName}
      </DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
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

        <Stack direction="row" spacing={2} sx={{ mb: 2, justifyContent: "center" }}>
          <LegendItem type="regular" label="Regular" />
          <LegendItem type="shifting" label="Shifting" />
          <LegendItem type="leave" label="Leave" />
        </Stack>

        {isLoadingSchedules ? (
          <Typography textAlign="center">Loading schedules...</Typography>
        ) : (
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
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <Typography key={d} variant="subtitle2" color="text.secondary">
                  {d}
                </Typography>
              ))}
            </Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 1,
              }}
            >
              {days.map((dayObj, i) => {
                if (!dayObj) {
                  return <Box key={`empty-${i}`} />;
                }
                const { date, day } = dayObj;
                const type = getTypeForDate(date);
                return (
                  <Box
                    key={date}
                    onClick={() => handleDayClick(date)}
                    sx={(theme) => ({
                      aspectRatio: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                      backgroundColor: TYPE_COLORS[type],
                      color: type === "regular" ? "text.primary" : "#fff",
                      transition: "background-color 0.2s",
                      "&:hover": {
                        opacity: 0.8,
                      },
                    })}
                  >
                    <Typography>{day}</Typography>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={mutation.isPending || Object.keys(overrides).length === 0}>
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
          border: type === "regular" ? `1px solid ${theme.palette.divider}` : "none",
        })}
      />
      <Typography variant="body2">{label}</Typography>
    </Stack>
  );
}
