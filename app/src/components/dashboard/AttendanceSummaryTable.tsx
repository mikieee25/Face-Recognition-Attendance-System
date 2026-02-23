"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface DailySummary {
  date: string;
  present: number;
  absent: number;
  shifting: number;
  onLeave: number;
}

interface PersonnelRow {
  personnelId: number;
  name: string;
  rank: string;
  stationName: string;
  status: "present" | "absent" | "shifting" | "on_leave";
}

type StatusFilter = "present" | "absent" | "shifting" | "on_leave";

const STATUS_COLORS: Record<StatusFilter, string> = {
  present: "#2E7D32",
  absent: "#C62828",
  shifting: "#F57C00",
  on_leave: "#7B1FA2",
};

const STATUS_LABELS: Record<StatusFilter, string> = {
  present: "Present",
  absent: "Absent",
  shifting: "Shifting",
  on_leave: "On Leave",
};

function getThisWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  return {
    dateFrom: monday.toISOString().slice(0, 10),
    dateTo: now.toISOString().slice(0, 10),
  };
}

type RangePreset = "this_week" | "this_month" | "custom";

export default function AttendanceSummaryTable() {
  const [preset, setPreset] = useState<RangePreset>("this_week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState("");
  const [modalStatus, setModalStatus] = useState<StatusFilter>("present");

  const getRange = () => {
    if (preset === "this_week") return getThisWeekRange();
    if (preset === "this_month") {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        dateFrom: first.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10),
      };
    }
    return { dateFrom: customFrom, dateTo: customTo };
  };

  const range = getRange();

  const { data: summaries = [], isLoading } = useQuery<DailySummary[]>({
    queryKey: ["dashboard", "summary", range.dateFrom, range.dateTo],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<DailySummary[]>>(
        "/api/v1/dashboard/summary",
        { params: { dateFrom: range.dateFrom, dateTo: range.dateTo } },
      );
      return res.data.data ?? [];
    },
    enabled: !!range.dateFrom && !!range.dateTo,
    refetchInterval: 30000,
  });

  const { data: personnelList = [], isLoading: personnelLoading } = useQuery<
    PersonnelRow[]
  >({
    queryKey: ["dashboard", "personnel-status", modalDate, modalStatus],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PersonnelRow[]>>(
        "/api/v1/dashboard/personnel-status",
        { params: { date: modalDate, status: modalStatus } },
      );
      return res.data.data ?? [];
    },
    enabled: modalOpen && !!modalDate,
  });

  const handleCellClick = (date: string, status: StatusFilter) => {
    setModalDate(date);
    setModalStatus(status);
    setModalOpen(true);
  };

  const formatDate = (d: string) => {
    const date = new Date(d + "T00:00:00");
    return date.toLocaleDateString("en-PH", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Paper sx={{ p: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ sm: "center" }}
          spacing={2}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">Attendance Summary</Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Range</InputLabel>
              <Select
                value={preset}
                label="Range"
                onChange={(e) => setPreset(e.target.value as RangePreset)}
              >
                <MenuItem value="this_week">This Week</MenuItem>
                <MenuItem value="this_month">This Month</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </Select>
            </FormControl>
            {preset === "custom" && (
              <>
                <TextField
                  type="date"
                  size="small"
                  label="From"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
                <TextField
                  type="date"
                  size="small"
                  label="To"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </>
            )}
          </Stack>
        </Stack>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, color: STATUS_COLORS.present }}
                >
                  Present
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, color: STATUS_COLORS.absent }}
                >
                  Absent
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, color: STATUS_COLORS.shifting }}
                >
                  Shifting
                </TableCell>
                <TableCell
                  align="center"
                  sx={{ fontWeight: 700, color: STATUS_COLORS.on_leave }}
                >
                  On Leave
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : summaries.map((row) => (
                    <TableRow key={row.date} hover>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      {(
                        ["present", "absent", "shifting", "on_leave"] as const
                      ).map((s) => (
                        <TableCell
                          key={s}
                          align="center"
                          sx={{
                            cursor: "pointer",
                            "&:hover": {
                              backgroundColor: `${STATUS_COLORS[s]}15`,
                            },
                          }}
                          onClick={() => handleCellClick(row.date, s)}
                        >
                          <Chip
                            label={row[s === "on_leave" ? "onLeave" : s]}
                            size="small"
                            sx={{
                              backgroundColor: `${STATUS_COLORS[s]}20`,
                              color: STATUS_COLORS[s],
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Modal: personnel list for a specific date + status */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h6" component="span">
              {STATUS_LABELS[modalStatus]}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {modalDate && formatDate(modalDate)}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setModalOpen(false)}
            size="small"
            aria-label="Close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {personnelLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="text" height={40} />
            ))
          ) : personnelList.length === 0 ? (
            <Typography
              color="text.secondary"
              sx={{ py: 2, textAlign: "center" }}
            >
              No personnel found.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Rank</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Station</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {personnelList.map((p) => (
                  <TableRow key={p.personnelId} hover>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.rank}</TableCell>
                    <TableCell>{p.stationName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
