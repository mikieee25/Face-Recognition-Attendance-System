import Box from "@mui/material/Box";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import AttendanceHistoryGrid from "@/components/attendance/AttendanceHistoryGrid";

export default async function AttendanceHistoryPage() {
  const queryClient = getQueryClient();

  // Search-first UX: don't prefetch attendance here.
  // The grid will fetch only after the user submits filters.
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Box sx={{ p: 3 }}>
        <AttendanceHistoryGrid />
      </Box>
    </HydrationBoundary>
  );
}
