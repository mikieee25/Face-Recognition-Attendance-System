"use client";

import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface PersonnelRow {
  personnelId: number;
  name: string;
  rank: string;
  stationName: string;
  status: "present" | "absent" | "shifting" | "on_leave";
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "#2E7D32" },
  absent: { label: "Absent", color: "#C62828" },
  shifting: { label: "Shifting", color: "#F57C00" },
  on_leave: { label: "On Leave", color: "#7B1FA2" },
};

export default function PersonnelStatusTable() {
  const { data: personnel = [], isLoading } = useQuery<PersonnelRow[]>({
    queryKey: ["dashboard", "personnel-status-today"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PersonnelRow[]>>(
        "/api/v1/dashboard/personnel-status",
      );
      return res.data.data ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Personnel Status Today
      </Typography>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 360 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  display: { xs: "none", sm: "table-cell" },
                }}
              >
                Station
              </TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell
                        key={j}
                        sx={
                          j === 2
                            ? { display: { xs: "none", sm: "table-cell" } }
                            : {}
                        }
                      >
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : personnel.map((p) => {
                  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.absent;
                  return (
                    <TableRow key={p.personnelId} hover>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.rank}</TableCell>
                      <TableCell
                        sx={{ display: { xs: "none", sm: "table-cell" } }}
                      >
                        {p.stationName}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={cfg.label}
                          size="small"
                          sx={{
                            backgroundColor: `${cfg.color}20`,
                            color: cfg.color,
                            fontWeight: 600,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
