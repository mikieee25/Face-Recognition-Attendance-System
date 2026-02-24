"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ReportFilters, { type ReportFilterValues } from "./ReportFilters";
import ReportTable from "./ReportTable";
import ExportButtons from "./ExportButtons";

function getDefaultFilters(): ReportFilterValues {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const dateFrom = firstOfMonth.toISOString().split("T")[0];
  const dateTo = now.toISOString().split("T")[0];
  return { dateFrom, dateTo, stationId: "", personnelId: "", type: "" };
}

export default function ReportsPageClient() {
  const [filters, setFilters] = useState<ReportFilterValues>(getDefaultFilters);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Reports</Typography>
        <ExportButtons filters={filters} />
      </Stack>

      <ReportFilters value={filters} onChange={setFilters} />

      <ReportTable filters={filters} />
    </Box>
  );
}
