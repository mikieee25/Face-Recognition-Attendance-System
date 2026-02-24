import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import StatsCards from "@/components/dashboard/StatsCards";
import AttendanceSummaryTable from "@/components/dashboard/AttendanceSummaryTable";
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
        <Typography variant="h4">Dashboard</Typography>
        <StatsCards />
        <AttendanceSummaryTable />
        <PersonnelStatusTable />
      </Box>
    </HydrationBoundary>
  );
}
