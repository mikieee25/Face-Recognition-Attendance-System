"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel } from "@/types/models";

interface ExportButtonsProps {
  filters: {
    dateFrom?: string;
    dateTo?: string;
    stationId?: string;
    personnelId?: string;
    type?: string;
  };
}

type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";
type ExportStatus =
  | ""
  | "present"
  | "late"
  | "absent"
  | "leave"
  | "shifting"
  | "off_duty"
  | "scheduled";

async function fetchPersonnel(): Promise<Personnel[]> {
  const res =
    await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
  return res.data.data ?? [];
}

export default function ExportButtons({ filters }: ExportButtonsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [personnelId, setPersonnelId] = useState(filters.personnelId ?? "");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>("monthly");
  const [exportStatus, setExportStatus] = useState<ExportStatus>("");
  const [preparedBy, setPreparedBy] = useState("");
  const [certifiedBy, setCertifiedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [loadingFormat, setLoadingFormat] = useState<"excel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "export-list"],
    queryFn: fetchPersonnel,
    enabled: dialogOpen,
  });

  const handleOpen = () => {
    // Reset to current month defaults every time dialog opens
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
    setPersonnelId(filters.personnelId ?? "");
    setReportPeriod("monthly");
    setExportStatus("");
    setPreparedBy("");
    setCertifiedBy("");
    setApprovedBy("");
    setDateError(null);
    setDialogOpen(true);
  };

  const handleClose = () => {
    if (loadingFormat !== null) return; // prevent closing while downloading
    setDialogOpen(false);
  };

  const validate = (): boolean => {
    if (!dateFrom || !dateTo) {
      setDateError("Both Date From and Date To are required.");
      return false;
    }
    if (dateFrom > dateTo) {
      setDateError("Date From must not be after Date To.");
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleExport = async () => {
    if (!validate()) return;

    setLoadingFormat("excel");
    setError(null);

    try {
      const params: Record<string, string> = { format: "excel" };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (filters.stationId) params.stationId = filters.stationId;
      if (personnelId) params.personnelId = personnelId;
      params.reportPeriod = reportPeriod;
      if (exportStatus) params.exportStatus = exportStatus;
      if (preparedBy.trim()) params.preparedBy = preparedBy.trim();
      if (certifiedBy.trim()) params.certifiedBy = certifiedBy.trim();
      if (approvedBy.trim()) params.approvedBy = approvedBy.trim();

      const res = await apiClient.get("/api/v1/reports/export", {
        params,
        responseType: "blob",
      });

      const contentDisposition = res.headers["content-disposition"] as
        | string
        | undefined;
      let filename = "attendance-report.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDialogOpen(false);
    } catch {
      setError("Failed to export the Excel file. Please try again.");
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<FileDownloadIcon />}
        onClick={handleOpen}
        aria-label="Export attendance report"
        id="export-report-button"
      >
        Export
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        aria-labelledby="export-dialog-title"
      >
        <DialogTitle id="export-dialog-title">
          <Stack direction="row" alignItems="center" spacing={1}>
            <CalendarMonthIcon fontSize="small" color="primary" />
            <span>Export Attendance Report</span>
          </Stack>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Download a COA-ready DTR Excel workbook. You can export one
              personnel or all personnel, with daily, weekly, monthly, and
              yearly summary tabs included. Use status filtering to answer
              questions like who was late or absent for the selected period.
            </Typography>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl size="small" fullWidth>
                <InputLabel id="export-personnel-label">Personnel</InputLabel>
                <Select
                  labelId="export-personnel-label"
                  value={personnelId}
                  label="Personnel"
                  onChange={(e) => setPersonnelId(e.target.value as string)}
                >
                  <MenuItem value="">All Personnel</MenuItem>
                  {personnelList.map((person) => (
                    <MenuItem key={person.id} value={String(person.id)}>
                      {person.rank} {person.firstName} {person.lastName}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" fullWidth>
                <InputLabel id="export-period-label">Report Period</InputLabel>
                <Select
                  labelId="export-period-label"
                  value={reportPeriod}
                  label="Report Period"
                  onChange={(e) =>
                    setReportPeriod(e.target.value as ReportPeriod)
                  }
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                  <MenuItem value="yearly">Yearly</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel id="export-status-label">Export Status</InputLabel>
              <Select
                labelId="export-status-label"
                value={exportStatus}
                label="Export Status"
                onChange={(e) => setExportStatus(e.target.value as ExportStatus)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="present">Present only</MenuItem>
                <MenuItem value="late">Late only</MenuItem>
                <MenuItem value="absent">Absent only</MenuItem>
                <MenuItem value="leave">Leave only</MenuItem>
                <MenuItem value="shifting">Shifting only</MenuItem>
                <MenuItem value="off_duty">Off Duty only</MenuItem>
                <MenuItem value="scheduled">Scheduled only</MenuItem>
              </Select>
            </FormControl>

            <Stack spacing={1.5}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Signature Fields
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Prepared By"
                  size="small"
                  fullWidth
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  placeholder="Name / designation"
                />
                <TextField
                  label="Certified Correct By"
                  size="small"
                  fullWidth
                  value={certifiedBy}
                  onChange={(e) => setCertifiedBy(e.target.value)}
                  placeholder="Name / designation"
                />
              </Stack>
              <TextField
                label="Approved By"
                size="small"
                fullWidth
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                placeholder="Name / designation"
              />
            </Stack>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                id="export-date-from"
                label="Date From"
                type="date"
                size="small"
                fullWidth
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setDateError(null);
                }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ max: dateTo || undefined }}
              />
              <TextField
                id="export-date-to"
                label="Date To"
                type="date"
                size="small"
                fullWidth
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setDateError(null);
                }}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: dateFrom || undefined }}
              />
            </Stack>

            {dateError && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                {dateError}
              </Alert>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={handleClose}
            disabled={loadingFormat !== null}
            color="inherit"
            size="small"
          >
            Cancel
          </Button>

          <Button
            id="export-excel-button"
            variant="contained"
            size="small"
            startIcon={
              loadingFormat === "excel" ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <TableChartIcon />
              )
            }
            onClick={handleExport}
            disabled={loadingFormat !== null}
            aria-label="Download Excel report"
          >
            Export Excel
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
}
