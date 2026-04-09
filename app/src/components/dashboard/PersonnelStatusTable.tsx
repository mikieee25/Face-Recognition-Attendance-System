"use client";

import Avatar from "@mui/material/Avatar";
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
  imagePath: string | null;
  section: string;
  status: "present" | "late" | "shifting" | "on_leave";
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "#2E7D32" },
  late: { label: "Late", color: "#F9A825" },
  shifting: { label: "Shifting", color: "#F57C00" },
  on_leave: { label: "On Leave", color: "#CDB4F5" },
};

function formatSectionLabel(section: string): string {
  return section === "admin" ? "Administrative" : "Operation";
}

function buildImageUrl(imagePath: string | null): string | undefined {
  if (!imagePath) return undefined;
  if (imagePath.startsWith("http")) return imagePath;

  const assetBase =
    process.env.NEXT_PUBLIC_ASSET_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "";
  const normalizedBase = assetBase.replace(/\/+$/, "");
  const normalizedPath = imagePath.replace(/^\//, "");
  return normalizedBase ? `${normalizedBase}/${normalizedPath}` : `/${normalizedPath}`;
}

export default function PersonnelStatusTable() {
  const { data: personnel = [], isLoading } = useQuery<PersonnelRow[]>({
    queryKey: ["dashboard", "personnel-status-today"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PersonnelRow[]>>(
        "/api/v1/dashboard/personnel-status",
      );
      return res.data.data ?? [];
    },
    refetchInterval: 3000,
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
              <TableCell sx={{ fontWeight: 700 }}>Profile</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
              <TableCell
                sx={{
                  fontWeight: 700,
                  display: { xs: "none", sm: "table-cell" },
                }}
              >
                Section
              </TableCell>
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
                    {Array.from({ length: 6 }).map((__, j) => (
                      <TableCell
                        key={j}
                        sx={
                          j === 4
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
                  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.late;
                  return (
                    <TableRow key={p.personnelId} hover>
                      <TableCell>
                        <Avatar
                          src={buildImageUrl(p.imagePath)}
                          alt={p.name}
                          sx={{ width: 36, height: 36 }}
                        />
                      </TableCell>
                      <TableCell>{p.name}</TableCell>
                      <TableCell>{p.rank}</TableCell>
                      <TableCell
                        sx={{
                          display: { xs: "none", sm: "table-cell" },
                        }}
                      >
                        {formatSectionLabel(p.section)}
                      </TableCell>
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
