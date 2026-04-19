import Box from "@mui/material/Box";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DashboardStatsRow from "@/components/dashboard/DashboardStatsRow";
import DateTimeCards from "@/components/dashboard/DateTimeCards";
import PersonnelStatusTable from "@/components/dashboard/PersonnelStatusTable";
import StatsCards from "@/components/dashboard/StatsCards";
import SystemStatsCards from "@/components/dashboard/SystemStatsCards";
import apiClient from "@/lib/api-client";
import { getQueryClient } from "@/lib/query-client";

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
      <DashboardLayout title="Dashboard" headerRight={<DateTimeCards />}>
        <DashboardStatsRow>
          <Box sx={{ flex: "1 1 0", height: "100%" }}>
            <StatsCards />
          </Box>
          <Box sx={{ flex: "1 1 0", height: "100%" }}>
            <SystemStatsCards />
          </Box>
        </DashboardStatsRow>
        <PersonnelStatusTable />
      </DashboardLayout>
    </HydrationBoundary>
  );
}
