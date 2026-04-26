"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import { buildImageUrl, getPersonnelInitials } from "@/lib/personnel-display";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";
import type { DailyAttendanceSummary, Personnel } from "@/types/models";

interface AttendanceFilters {
  dateFrom: string;
  dateTo: string;
  personnelId: string; // "" = all
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function isMissing(value: string | null | undefined): boolean {
  if (!value) return true;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime());
}

function formatSummaryDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildIssues(summary: DailyAttendanceSummary): string[] {
  const issues: string[] = [];
  if (isMissing(summary.firstIn)) issues.push("Missing Time In");
  if (isMissing(summary.lastOut)) issues.push("Missing Time Out");
  return issues;
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
  return res.data.data ?? [];
}

async function fetchAttendanceSummary(
  page: number,
  limit: number,
  filters: AttendanceFilters,
): Promise<PaginatedResponse<DailyAttendanceSummary>> {
  const params: Record<string, string | number | boolean> = {
    page: page + 1,
    limit,
    summaryMode: true,
  };

  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.personnelId) params.personnelId = filters.personnelId;

  const res = await apiClient.get<ApiEnvelope<PaginatedResponse<DailyAttendanceSummary>>>("/api/v1/attendance", { params });

  return res.data.data!;
}

export default function AttendanceHistoryGrid() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  // applied filters (used for query)
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [filters, setFilters] = useState<AttendanceFilters>({
    dateFrom: formatDateInput(monthStart),
    dateTo: formatDateInput(monthEnd),
    personnelId: "",
  });

  // search-first
  const [hasSearched, setHasSearched] = useState(false);
  const [searchOpen, setSearchOpen] = useState(true);
  const [draftFilters, setDraftFilters] = useState<AttendanceFilters>({
    dateFrom: formatDateInput(monthStart),
    dateTo: formatDateInput(monthEnd),
    personnelId: "",
  });

  // admin helpers within results
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [summarySearch, setSummarySearch] = useState("");

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "list"],
    queryFn: fetchPersonnel,
  });

  const personnelById = useMemo(() => {
    return new Map(personnelList.map((p) => [p.id, p]));
  }, [personnelList]);

  const {
    data: attendanceData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: [
      "attendance",
      {
        page,
        limit: rowsPerPage,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        personnelId: filters.personnelId,
        summaryMode: true,
      },
    ],
    queryFn: () => fetchAttendanceSummary(page, rowsPerPage, filters),
    enabled: hasSearched,
  });

  const total = attendanceData?.total ?? 0;
  const sourceRows = useMemo(() => attendanceData?.items ?? [], [attendanceData]);
  const issueCount = useMemo(() => sourceRows.filter((record) => buildIssues(record).length > 0).length, [sourceRows]);
  const totalCount = sourceRows.length;

  const isDraftValid = !!draftFilters.dateFrom && !!draftFilters.dateTo && new Date(draftFilters.dateFrom) <= new Date(draftFilters.dateTo);

  const applySearch = () => {
    if (!isDraftValid) return;
    setPage(0);
    setFilters(draftFilters);
    setHasSearched(true);
    setSearchOpen(false);
  };

  const visibleRows = useMemo(() => {
    const sourceRows = attendanceData?.items ?? [];
    const q = normalize(summarySearch);

    return sourceRows.filter((record) => {
      const issues = buildIssues(record);
      const isIssue = issues.length > 0;

      if (showOnlyIssues && !isIssue) return false;

      if (q.length === 0) return true;

      const haystack = normalize(`${record.personnelName} ${record.rank} ${formatSummaryDate(record.date)} ${issues.join(" ")}`);
      return haystack.includes(q);
    });
  }, [attendanceData, showOnlyIssues, summarySearch]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Search-first modal */}
      <Dialog open={searchOpen} onClose={() => setSearchOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Search Attendance History</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Select your search filters then press{" "}
              <Box component="span" sx={{ fontWeight: 700 }}>
                Enter
              </Box>{" "}
              to view results.
            </Typography>

            <FormControl fullWidth>
              <InputLabel id="search-personnel-label" shrink>
                Personnel
              </InputLabel>
              <Select
                labelId="search-personnel-label"
                label="Personnel"
                value={draftFilters.personnelId}
                displayEmpty
                renderValue={(selected) => {
                  if (!selected) return "All Personnel";
                  const person = personnelList.find((p) => String(p.id) === String(selected));
                  return person ? `${person.rank} ${person.firstName} ${person.lastName}` : "All Personnel";
                }}
                onChange={(e) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    personnelId: String(e.target.value),
                  }))
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

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Date From"
                type="date"
                value={draftFilters.dateFrom}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Date To"
                type="date"
                value={draftFilters.dateTo}
                onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>

            {!isDraftValid && (draftFilters.dateFrom || draftFilters.dateTo) && (
              <Alert severity="warning">Please provide a valid date range. “Date From” must be earlier than or equal to “Date To”.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, px: 3 }}>
          <Button onClick={() => setSearchOpen(false)}>Close</Button>
          <Button variant="contained" onClick={applySearch} disabled={!isDraftValid}>
            Enter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Header */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5">Attendance History</Typography>
        <Button variant="outlined" onClick={() => setSearchOpen(true)}>
          Search
        </Button>
      </Stack>

      {/* Applied filters bar */}
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" useFlexGap alignItems={{ sm: "center" }}>
          <TextField
            label="From"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => {
              setPage(0);
              setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="To"
            type="date"
            value={filters.dateTo}
            onChange={(e) => {
              setPage(0);
              setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
            }}
            InputLabelProps={{ shrink: true }}
            size="small"
          />

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="filter-personnel-label" shrink>
              Personnel
            </InputLabel>
            <Select
              labelId="filter-personnel-label"
              value={filters.personnelId}
              label="Personnel"
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return "All Personnel";
                const person = personnelList.find((p) => String(p.id) === String(selected));
                return person ? `${person.rank} ${person.firstName} ${person.lastName}` : "All Personnel";
              }}
              onChange={(e) => {
                setPage(0);
                setFilters((prev) => ({ ...prev, personnelId: String(e.target.value) }));
              }}
            >
              <MenuItem value="">All Personnel</MenuItem>
              {personnelList.map((p) => (
                <MenuItem key={p.id} value={String(p.id)}>
                  {p.rank} {p.firstName} {p.lastName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ flex: "1 1 0" }} />

          <TextField
            label="Search within results"
            value={summarySearch}
            onChange={(e) => setSummarySearch(e.target.value)}
            size="small"
            sx={{ minWidth: { sm: 260 } }}
          />

          <Chip label={`${issueCount} issues / ${totalCount} total`} size="small" variant="outlined" sx={{ flexShrink: 0 }} />

          <FormControlLabel
            control={<Switch checked={showOnlyIssues} onChange={(e) => setShowOnlyIssues(e.target.checked)} />}
            label="Show only issues"
            sx={{ flexShrink: 0 }}
          />
        </Stack>
      </Paper>

      {/* Results */}
      {!hasSearched ? (
        <Box
          sx={{
            minHeight: 280,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 3,
            border: "1px dashed",
            borderColor: "divider",
            bgcolor: "background.paper",
            p: 3,
            textAlign: "center",
          }}
        >
          <Stack spacing={1} alignItems="center">
            <Typography variant="h6">No results yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Use the search to load attendance history.
            </Typography>
            <Button variant="contained" onClick={() => setSearchOpen(true)}>
              Open Search
            </Button>
          </Stack>
        </Box>
      ) : (
        <Paper>
          {isLoading && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress aria-label="Loading attendance summary" />
            </Box>
          )}

          {isError && (
            <Box sx={{ p: 2 }}>
              <Alert severity="error">
                {(error as { message?: string })?.message ?? "Failed to load attendance records. Please try again."}
              </Alert>
            </Box>
          )}

          {!isLoading && !isError && (
            <>
              {visibleRows.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    No attendance records found.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: 2 }}>
                  <TableContainer sx={{ overflowX: "auto" }}>
                    <Table aria-label="Attendance summary table" sx={{ minWidth: 980 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell sx={{ width: 88 }}>Photo</TableCell>
                          <TableCell>Personnel</TableCell>
                          <TableCell>Time In</TableCell>
                          <TableCell>Time Out</TableCell>
                          <TableCell>Issues</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visibleRows.map((record, idx) => {
                          const issues = buildIssues(record);
                          const p = personnelById.get(record.personnelId);

                          const timeIn = formatClock(record.firstIn);
                          const timeOut = formatClock(record.lastOut);

                          return (
                            <TableRow key={`${record.personnelId}-${record.date}-${idx}`} hover>
                              <TableCell sx={{ whiteSpace: "nowrap" }}>{formatSummaryDate(record.date)}</TableCell>

                              <TableCell>
                                <Avatar
                                  src={buildImageUrl(p?.imagePath)}
                                  sx={{
                                    width: 56,
                                    height: 56,
                                    bgcolor: "primary.main",
                                    fontSize: 22,
                                    fontWeight: 700,
                                  }}
                                >
                                  {getPersonnelInitials(p?.firstName, p?.lastName)}
                                </Avatar>
                              </TableCell>

                              <TableCell sx={{ minWidth: 260 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700, wordWrap: "break-word" }}>
                                  {record.personnelName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                                  {record.rank}
                                </Typography>
                              </TableCell>

                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <Chip
                                  label={timeIn}
                                  size="small"
                                  variant="outlined"
                                  color={isMissing(record.firstIn) ? "warning" : "success"}
                                  sx={{ fontWeight: 700 }}
                                />
                              </TableCell>

                              <TableCell sx={{ whiteSpace: "nowrap" }}>
                                <Chip
                                  label={timeOut}
                                  size="small"
                                  variant="outlined"
                                  color={isMissing(record.lastOut) ? "warning" : "info"}
                                  sx={{ fontWeight: 700 }}
                                />
                              </TableCell>

                              <TableCell>
                                {issues.length === 0 ? (
                                  <Chip label="OK" size="small" color="success" variant="outlined" />
                                ) : (
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    {issues.map((issue) => (
                                      <Chip key={issue} label={issue} size="small" color="warning" variant="outlined" />
                                    ))}
                                  </Stack>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              <TablePagination
                component="div"
                count={total}
                page={page}
                rowsPerPage={rowsPerPage}
                rowsPerPageOptions={[6, 12, 24]}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
              />
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
