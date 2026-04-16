"use client";

import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import BadgeIcon from "@mui/icons-material/Badge";
import ApartmentIcon from "@mui/icons-material/Apartment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WcIcon from "@mui/icons-material/Wc";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  loading?: boolean;
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

  const totalPersonnel = personnel.length;
  const activeCount = personnel.filter((p) => p.isActive).length;
  const maleCount = personnel.filter((p) => p.gender?.toLowerCase() === "male").length;
  const femaleCount = personnel.filter((p) => p.gender?.toLowerCase() === "female").length;
  const totalStations = stations.length;

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          label="Total Personnel"
          value={totalPersonnel}
          color="#1976d2" // Primary Blue
          icon={<BadgeIcon />}
          loading={pLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          label="Total Stations"
          value={totalStations}
          color="#9c27b0" // Purple
          icon={<ApartmentIcon />}
          loading={sLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          label="Active Personnel"
          value={activeCount}
          color="#2e7d32" // Success Green
          icon={<CheckCircleIcon />}
          loading={pLoading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          label="Male / Female"
          value={`${maleCount} / ${femaleCount}`}
          color="#ed6c02" // Warning Orange
          icon={<WcIcon />}
          loading={pLoading}
        />
      </Grid>
    </Grid>
  );
}
