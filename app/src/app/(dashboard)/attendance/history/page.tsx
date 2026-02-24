import Box from "@mui/material/Box";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import apiClient from "@/lib/api-client";
import AttendanceHistoryGrid from "@/components/attendance/AttendanceHistoryGrid";

export default async function AttendanceHistoryPage() {
  const queryClient = getQueryClient();

  // Prefetch the first page of attendance records for SSR hydration
  await queryClient.prefetchQuery({
    queryKey: [
      "attendance",
      {
        page: 0,
        limit: 20,
        dateFrom: "",
        dateTo: "",
        personnelId: "",
        type: "",
      },
    ],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/attendance", {
        params: { page: 1, limit: 20 },
      });
      return res.data.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Box sx={{ p: 3 }}>
        <AttendanceHistoryGrid />
      </Box>
    </HydrationBoundary>
  );
}
