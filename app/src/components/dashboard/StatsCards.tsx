"use client";

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/People";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface DashboardStats {
  present: number;
  late: number;
  shifting: number;
  onLeave: number;
}

export default function StatsCards() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>("/api/v1/dashboard/stats");
      return res.data.data!;
    },
    refetchInterval: 3000,
  });

  const total = (data?.present ?? 0) + (data?.late ?? 0) + (data?.shifting ?? 0) + (data?.onLeave ?? 0);

  const breakdownItems = [
    {
      label: "Late",
      value: data?.late,
      color: "#F9A825",
    },
    {
      label: "Shifting",
      value: data?.shifting,
      color: "#2196f3",
    },
    {
      label: "On Leave",
      value: data?.onLeave,
      color: "#6F42A6",
    },
  ];

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
              backgroundColor: "#2E7D3220",
              color: "#2E7D32",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            <PeopleIcon />
          </Box>
          <Box
            sx={(theme) => ({
              display: "flex",
              flexDirection: "column",
              gap: theme.spacing(0.5),
            })}
          >
            {isLoading ? (
              <>
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(15), height: theme.spacing(6) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(16), height: theme.spacing(3) })} />
                <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(12), height: theme.spacing(3) })} />
              </>
            ) : (
              <>
                <Typography variant="h3" fontWeight={700}>
                  {data?.present ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Present Today
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                  Total Status Count: {total}
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
          {breakdownItems.map((item) => (
            <Box
              key={item.label}
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
              {isLoading ? (
                <>
                  <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(10), height: theme.spacing(3.5) })} />
                  <Skeleton variant="text" sx={(theme) => ({ width: theme.spacing(12), height: theme.spacing(3) })} />
                </>
              ) : (
                <>
                  <Typography variant="h5" fontWeight={700} sx={{ color: item.color }}>
                    {item.value ?? 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                    {item.label}
                  </Typography>
                </>
              )}
            </Box>
          ))}
        </Box>
      </Stack>
    </Box>
  );
}
