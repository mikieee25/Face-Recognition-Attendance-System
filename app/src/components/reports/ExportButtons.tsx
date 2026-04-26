"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import TableChartIcon from "@mui/icons-material/TableChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import apiClient from "@/lib/api-client";

interface ExportButtonsProps {
  filters: {
    dateFrom?: string;
    dateTo?: string;
    stationId?: string;
    personnelId?: string;
    type?: string;
  };
}

export default function ExportButtons({ filters }: ExportButtonsProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "");
  const [loadingFormat, setLoadingFormat] = useState<"excel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const handleOpen = () => {
    // Reset to current month defaults every time dialog opens
    setDateFrom(filters.dateFrom ?? "");
    setDateTo(filters.dateTo ?? "");
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
      if (filters.personnelId) params.personnelId = filters.personnelId;
      if (filters.type) params.type = filters.type;

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
        maxWidth="xs"
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
              Download a polished Excel report using the selected date range. The
              file will reflect the current filters already applied on this page.
            </Typography>

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
