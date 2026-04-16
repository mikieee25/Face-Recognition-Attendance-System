import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import StatsCards from "@/components/dashboard/StatsCards";
import SystemStatsCards from "@/components/dashboard/SystemStatsCards";
import DateTimeCards from "@/components/dashboard/DateTimeCards";
import PersonnelStatusTable from "@/components/dashboard/PersonnelStatusTable";
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
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 2,
          }}
        >
          <Typography variant="h4">Dashboard</Typography>
          <DateTimeCards />
        </Box>
        <StatsCards />
        <SystemStatsCards />
        <PersonnelStatusTable />
      </Box>
    </HydrationBoundary>
  );
}
