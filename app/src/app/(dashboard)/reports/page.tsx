import Box from "@mui/material/Box";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import apiClient from "@/lib/api-client";
import ReportsPageClient from "@/components/reports/ReportsPageClient";

function getDefaultDateRange() {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: firstOfMonth.toISOString().split("T")[0],
    dateTo: now.toISOString().split("T")[0],
  };
}

export default async function ReportsPage() {
  const queryClient = getQueryClient();
  const { dateFrom, dateTo } = getDefaultDateRange();

  // Prefetch reports with default filters (current month)
  await queryClient.prefetchQuery({
    queryKey: [
      "reports",
      {
        page: 0,
        limit: 20,
        dateFrom,
        dateTo,
        stationId: "",
        personnelId: "",
        type: "",
      },
    ],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/reports", {
        params: { page: 1, limit: 20, dateFrom, dateTo },
      });
      return res.data.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Box sx={{ p: 3 }}>
        <ReportsPageClient />
      </Box>
    </HydrationBoundary>
  );
}
