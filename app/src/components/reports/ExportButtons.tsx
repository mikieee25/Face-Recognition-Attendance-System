"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import DownloadIcon from "@mui/icons-material/Download";
import TableChartIcon from "@mui/icons-material/TableChart";
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
  const [loadingFormat, setLoadingFormat] = useState<"excel" | "csv" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (format: "excel" | "csv") => {
    setLoadingFormat(format);
    setError(null);

    try {
      const params: Record<string, string> = { format };
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
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
      let filename = `attendance-report.${format === "excel" ? "xlsx" : "csv"}`;
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
    } catch {
      setError(
        `Failed to export ${format.toUpperCase()} file. Please try again.`,
      );
    } finally {
      setLoadingFormat(null);
    }
  };

  return (
    <>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            loadingFormat === "excel" ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <TableChartIcon />
            )
          }
          onClick={() => handleExport("excel")}
          disabled={loadingFormat !== null}
          aria-label="Export as Excel"
        >
          Excel
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={
            loadingFormat === "csv" ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <DownloadIcon />
            )
          }
          onClick={() => handleExport("csv")}
          disabled={loadingFormat !== null}
          aria-label="Export as CSV"
        >
          CSV
        </Button>
      </Stack>

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
