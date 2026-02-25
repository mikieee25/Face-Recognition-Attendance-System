"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableFooter from "@mui/material/TableFooter";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { Personnel } from "@/types/models";
import type { ReportFilterValues } from "./ReportFilters";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportItem {
  id: number;
  personnelId: number;
  personnelName: string;
  rank: string;
  station: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  totalHours: number | null;
  type: string;
  status: string;
}

interface ReportTableProps {
  filters: ReportFilterValues;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

function statusColor(
  status: string,
): "success" | "warning" | "error" | "default" {
  if (status === "confirmed") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "error";
  return "default";
}

function typeLabel(type: string): string {
  if (type === "time_in") return "Time In";
  if (type === "time_out") return "Time Out";
  return type;
}

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchReports(
  page: number,
  limit: number,
  filters: ReportFilterValues,
): Promise<PaginatedResponse<ReportItem>> {
  const params: Record<string, string | number> = { page: page + 1, limit };
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.stationId) params.stationId = filters.stationId;
  if (filters.personnelId) params.personnelId = filters.personnelId;
  if (filters.type) params.type = filters.type;

  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<ReportItem>>>(
    "/api/v1/reports",
    { params },
  );
  return res.data.data!;
}

// ─── Summary stats ────────────────────────────────────────────────────────────

function computeSummary(items: ReportItem[]) {
  const totalRecords = items.length;
  const confirmed = items.filter((r) => r.status === "confirmed").length;
  const pending = items.filter((r) => r.status === "pending").length;
  const totalHours = items.reduce((sum, r) => sum + (r.totalHours ?? 0), 0);
  return { totalRecords, confirmed, pending, totalHours };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportTable({ filters }: ReportTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["reports", { page, limit: rowsPerPage, ...filters }],
    queryFn: () => fetchReports(page, rowsPerPage, filters),
  });

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const summary = computeSummary(rows);

  // Fetch personnel for schedule status lookup
  const { data: personnelData } = useQuery({
    queryKey: ["personnel", "list"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data ?? [];
    },
  });
  const scheduleMap = new Map(
    (personnelData ?? []).map((p) => [
      p.id,
      !p.isActive ? "on_leave" : p.isShifting ? "shifting" : "regular",
    ]),
  );

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  return (
    <Paper>
      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
          <CircularProgress aria-label="Loading report data" />
        </Box>
      )}

      {isError && (
        <Box sx={{ p: 2 }}>
          <Alert severity="error">
            {(error as { message?: string })?.message ??
              "Failed to load report data. Please try again."}
          </Alert>
        </Box>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary stats bar */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: "divider" }}
            flexWrap="wrap"
            useFlexGap
          >
            <Typography variant="body2" color="text.secondary">
              Total Records:{" "}
              <Typography component="span" variant="body2" fontWeight={600}>
                {total}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Confirmed:{" "}
              <Typography
                component="span"
                variant="body2"
                fontWeight={600}
                color="success.main"
              >
                {summary.confirmed}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending:{" "}
              <Typography
                component="span"
                variant="body2"
                fontWeight={600}
                color="warning.main"
              >
                {summary.pending}
              </Typography>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Hours:{" "}
              <Typography component="span" variant="body2" fontWeight={600}>
                {summary.totalHours.toFixed(1)}
              </Typography>
            </Typography>
          </Stack>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table
              aria-label="Attendance report table"
              size="small"
              sx={{ minWidth: 500 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>Personnel</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    Rank
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    Station
                  </TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    Time In
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                    Time Out
                  </TableCell>
                  <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                    Total Hours
                  </TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                    Schedule
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ py: 3 }}
                      >
                        No records found for the selected filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.personnelName}</TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", sm: "table-cell" } }}
                      >
                        {row.rank}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", md: "table-cell" } }}
                      >
                        {row.station}
                      </TableCell>
                      <TableCell>{formatDate(row.date)}</TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", sm: "table-cell" } }}
                      >
                        {formatTime(row.timeIn)}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", sm: "table-cell" } }}
                      >
                        {formatTime(row.timeOut)}
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", md: "table-cell" } }}
                      >
                        {row.totalHours != null
                          ? `${row.totalHours.toFixed(1)}h`
                          : "—"}
                      </TableCell>
                      <TableCell>{typeLabel(row.type)}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status}
                          color={statusColor(row.status)}
                          size="small"
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", lg: "table-cell" } }}
                      >
                        {(() => {
                          const sched = scheduleMap.get(row.personnelId);
                          if (sched === "on_leave")
                            return (
                              <Chip
                                label="On Leave"
                                size="small"
                                color="secondary"
                              />
                            );
                          if (sched === "shifting")
                            return (
                              <Chip
                                label="Shifting"
                                size="small"
                                color="warning"
                              />
                            );
                          return (
                            <Chip
                              label="Regular"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          );
                        })()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* Summary stats footer row */}
              {rows.length > 0 && (
                <TableFooter>
                  <TableRow
                    sx={{
                      "& td": {
                        fontWeight: 600,
                        borderTop: 2,
                        borderColor: "divider",
                      },
                    }}
                  >
                    <TableCell colSpan={6}>
                      <Typography variant="body2" fontWeight={600}>
                        Page Summary ({rows.length} records)
                      </Typography>
                    </TableCell>
                    <TableCell>{summary.totalHours.toFixed(1)}h</TableCell>
                    <TableCell />
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Chip
                          label={`${summary.confirmed} confirmed`}
                          color="success"
                          size="small"
                          variant="outlined"
                        />
                        {summary.pending > 0 && (
                          <Chip
                            label={`${summary.pending} pending`}
                            color="warning"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={total}
            page={page}
            rowsPerPage={rowsPerPage}
            rowsPerPageOptions={[10, 20, 50, 100]}
            onPageChange={handlePageChange}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </>
      )}
    </Paper>
  );
}
