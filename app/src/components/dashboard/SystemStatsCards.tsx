"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import BadgeIcon from "@mui/icons-material/Badge";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

interface DashboardStats {
  present: number;
  late: number;
  shifting: number;
  onLeave: number;
}

export default function SystemStatsCards() {
  const { data: personnel = [], isLoading: pLoading } = useQuery({
    queryKey: ["personnel-stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel", {
        params: { limit: 10000 },
      });
      return res.data.data ?? [];
    },
  });

  const { data: stations = [], isLoading: sLoading } = useQuery({
    queryKey: ["stations-stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations", {
        params: { limit: 1000 },
      });
      return res.data.data ?? [];
    },
  });

  const { data: dashboardStats, isLoading: dLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>("/api/v1/dashboard/stats");
      return res.data.data!;
    },
    refetchInterval: 3000,
  });

  const totalPersonnel = personnel.length;
  const activeCount = personnel.filter((p) => p.isActive).length;
  const maleCount = personnel.filter((p) => p.gender?.toLowerCase() === "male").length;
  const femaleCount = personnel.filter((p) => p.gender?.toLowerCase() === "female").length;
  const totalStations = stations.length;
  const isPersonnelLoading = pLoading;
  const isStationLoading = sLoading;
  const isDashboardLoading = dLoading;

  return (
    <Box
      sx={(theme) => ({
        border: "1px solid",
        borderColor: "divider",
        borderRadius: theme.spacing(2.5),
        p: theme.spacing(2.5),
        backgroundColor: "background.paper",
        boxShadow: theme.shadows[1],
        height: "100%",
      })}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        sx={(theme) => ({
          alignItems: "stretch",
          gap: theme.spacing(2.5),
          flexWrap: "wrap",
          height: "100%",
        })}
      >
        <Box
          sx={(theme) => ({
            flex: "1 1 0",
            display: "flex",
            alignItems: "center",
            gap: theme.spacing(2),
            height: "100%",
          })}
        >
          <Box
            sx={(theme) => ({
              p: theme.spacing(1.5),
              borderRadius: theme.spacing(2),
              backgroundColor: "#1976d220",
              color: "#1976d2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <BadgeIcon />
          </Box>
          <Box
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              gap: theme.spacing(0.5),
            })}
          >
            {isPersonnelLoading ? (
              <>
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(15), height: theme.spacing(6) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(16), height: theme.spacing(3) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(12), height: theme.spacing(3) })} />
              </>
            ) : (
              <>
                <Typography variant="h3" fontWeight={700}>
                  {totalPersonnel}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Total Personnel
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Active: {activeCount}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        <Box
          sx={(theme) => ({
            flex: "1 1 0",
            display: "flex",
            flexWrap: "wrap",
            gap: theme.spacing(1.5),
            justifyContent: { xs: "flex-start", md: "flex-end" },
            width: "100%",
            height: "100%",
          })}
        >
          <Box
            sx={(theme) => ({
              flex: "1 1 0",
              minWidth: { xs: "100%", sm: theme.spacing(20) },
              p: theme.spacing(1.5),
              borderRadius: theme.spacing(2),
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.default",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            })}
          >
            {isStationLoading ? (
              <>
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(10), height: theme.spacing(3.5) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(12), height: theme.spacing(3) })} />
              </>
            ) : (
              <>
                <Typography variant="h5" fontWeight={700} sx={{ color: "#9c27b0" }}>
                  {totalStations}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Total Stations
                </Typography>
              </>
            )}
          </Box>

          <Box
            sx={(theme) => ({
              flex: "1 1 0",
              minWidth: { xs: "100%", sm: theme.spacing(20) },
              p: theme.spacing(1.5),
              borderRadius: theme.spacing(2),
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.default",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            })}
          >
            {isPersonnelLoading ? (
              <>
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(10), height: theme.spacing(3.5) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(14), height: theme.spacing(3) })} />
              </>
            ) : (
              <>
                <Typography variant="h5" fontWeight={700} sx={{ color: "#ed6c02" }}>
                  {maleCount} / {femaleCount}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Male / Female
                </Typography>
              </>
            )}
          </Box>

          <Box
            sx={(theme) => ({
              flex: "1 1 100%",
              minWidth: "100%",
              p: theme.spacing(1.5),
              borderRadius: theme.spacing(2),
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "background.default",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            })}
          >
            {isDashboardLoading ? (
              <>
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(12), height: theme.spacing(3.5) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(18), height: theme.spacing(3) })} />
              </>
            ) : (
              <>
                <Typography variant="h5" fontWeight={700} sx={{ color: "#2E7D32" }}>
                  {dashboardStats?.present ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Checked In Today
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </Stack>
    </Box>
  );
}
