"use client";

import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { DailyAttendanceSummary } from "@/types/models";
import type { ApiEnvelope, PaginatedResponse } from "@/types/api";

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell>
            <Skeleton variant="text" />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={80} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={80} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
          <TableCell>
            <Skeleton variant="text" width={100} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

export default function RecentAttendanceTable() {
  const { data: records, isLoading } = useQuery<DailyAttendanceSummary[]>({
    queryKey: ["dashboard", "recent-summary"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PaginatedResponse<DailyAttendanceSummary>>>("/api/v1/attendance", {
        params: { summaryMode: true, limit: 10 },
      });
      return res.data.data?.items ?? [];
    },
    refetchInterval: 3000,
  });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Recent Attendance
      </Typography>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 400 }}>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Rank</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Time In</TableCell>
              <TableCell>Time Out</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : (
              records?.map((record) => (
                <TableRow key={`${record.personnelId}-${record.date}`} hover>
                  <TableCell>{record.personnelName}</TableCell>
                  <TableCell>{record.rank}</TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>{record.firstIn ? new Date(record.firstIn).toLocaleTimeString() : "--"}</TableCell>
                  <TableCell>{record.lastOut ? new Date(record.lastOut).toLocaleTimeString() : "--"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
