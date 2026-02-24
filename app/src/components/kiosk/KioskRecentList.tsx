"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import PersonIcon from "@mui/icons-material/Person";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface RecentRecord {
  id: number;
  personnelName: string;
  rank: string;
  type: string;
  status: string;
  createdAt: string;
}

interface Props {
  refreshKey: number;
}

export default function KioskRecentList({ refreshKey }: Props) {
  const { data: records = [], isLoading } = useQuery<RecentRecord[]>({
    queryKey: ["kiosk", "recent", refreshKey],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<RecentRecord[]>>(
        "/api/v1/dashboard/recent",
      );
      return res.data.data ?? [];
    },
    refetchInterval: 15000,
  });

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return "";
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        bgcolor: "#243447",
        border: "1px solid #2e4460",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 2 }}
      >
        <Typography
          variant="overline"
          sx={{ color: "#7a9cc0", fontWeight: 700, letterSpacing: "0.06em" }}
        >
          ⬤ Recently Recorded
        </Typography>
        <Chip
          label={records.length}
          size="small"
          sx={{ bgcolor: "#1b2e40", color: "#7a9cc0" }}
        />
      </Stack>

      <Box sx={{ flex: 1, overflow: "auto", maxHeight: "70vh" }}>
        <Stack spacing={1.5}>
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={56}
                sx={{ bgcolor: "#1b2e40" }}
              />
            ))}

          {!isLoading && records.length === 0 && (
            <Box sx={{ textAlign: "center", py: 6 }}>
              <PersonIcon sx={{ fontSize: 48, color: "#7a9cc0", mb: 1 }} />
              <Typography color="text.secondary">
                No attendance recorded today yet.
              </Typography>
            </Box>
          )}

          {records.map((r) => (
            <Box
              key={r.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "#1b2e40",
                border: "1px solid #2e4460",
                transition: "background 0.15s",
                "&:hover": { bgcolor: "#2e4460" },
              }}
            >
              <Avatar sx={{ bgcolor: "#2e4460", width: 40, height: 40 }}>
                <PersonIcon />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {r.personnelName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {r.rank}
                </Typography>
              </Box>
              <Stack alignItems="flex-end" spacing={0.5}>
                <Chip
                  label={`${r.type === "time_out" ? "OUT" : "IN"} ${formatTime(r.createdAt)}`}
                  size="small"
                  sx={{
                    bgcolor:
                      r.type === "time_out"
                        ? "rgba(37,119,204,0.2)"
                        : "rgba(37,169,97,0.2)",
                    color: r.type === "time_out" ? "#2577cc" : "#25a961",
                    fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                  }}
                />
                <Chip
                  label={r.status}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.08)",
                    color: "#7a9cc0",
                    fontSize: "0.7rem",
                    textTransform: "capitalize",
                  }}
                />
              </Stack>
            </Box>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
}
