"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import PeopleIcon from "@mui/icons-material/People";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface DashboardStats {
  present: number;
  absent: number;
  shifting: number;
  onLeave: number;
}

interface StatCardProps {
  label: string;
  value: number | undefined;
  color: string;
  icon: React.ReactNode;
  loading: boolean;
}

function StatCard({ label, value, color, icon, loading }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              backgroundColor: `${color}20`,
              color,
              display: "flex",
              alignItems: "center",
            }}
          >
            {icon}
          </Box>
          <Box>
            {loading ? (
              <>
                <Skeleton variant="text" width={60} height={40} />
                <Skeleton variant="text" width={80} />
              </>
            ) : (
              <>
                <Typography variant="h4" fontWeight={700}>
                  {value ?? 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function StatsCards() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<DashboardStats>>(
        "/api/v1/dashboard/stats",
      );
      return res.data.data!;
    },
    refetchInterval: 30000,
  });

  const cards = [
    {
      label: "Present",
      value: data?.present,
      color: "#2E7D32",
      icon: <PeopleIcon />,
    },
    {
      label: "Absent",
      value: data?.absent,
      color: "#C62828",
      icon: <PersonOffIcon />,
    },
    {
      label: "Shifting",
      value: data?.shifting,
      color: "#F57C00",
      icon: <SwapHorizIcon />,
    },
    {
      label: "On Leave",
      value: data?.onLeave,
      color: "#7B1FA2",
      icon: <EventBusyIcon />,
    },
  ];

  return (
    <Grid container spacing={3}>
      {cards.map((card) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={card.label}>
          <StatCard {...card} loading={isLoading} />
        </Grid>
      ))}
    </Grid>
  );
}
