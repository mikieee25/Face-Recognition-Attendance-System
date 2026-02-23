import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import StatsCards from "@/components/dashboard/StatsCards";
import RecentAttendanceTable from "@/components/dashboard/RecentAttendanceTable";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import apiClient from "@/lib/api-client";

export default async function DashboardPage() {
  const queryClient = getQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "stats"],
      queryFn: async () => {
        const res = await apiClient.get("/api/v1/dashboard/stats");
        return res.data.data;
      },
    }),
    queryClient.prefetchQuery({
      queryKey: ["dashboard", "recent"],
      queryFn: async () => {
        const res = await apiClient.get("/api/v1/dashboard/recent");
        return res.data.data ?? [];
      },
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <StatsCards />
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <RecentAttendanceTable />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <AttendanceChart />
          </Grid>
        </Grid>
      </Box>
    </HydrationBoundary>
  );
}
