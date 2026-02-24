"use client";

import Chip from "@mui/material/Chip";
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
import type { AttendanceRecord, AttendanceStatus } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

type RecentRecord = AttendanceRecord & { personnelName: string };

const STATUS_COLORS: Record<AttendanceStatus, "success" | "warning" | "error"> =
  {
    confirmed: "success",
    pending: "warning",
    rejected: "error",
  };

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
            <Skeleton variant="rounded" width={80} height={24} />
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
  const { data: records, isLoading } = useQuery<RecentRecord[]>({
    queryKey: ["dashboard", "recent"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<RecentRecord[]>>(
        "/api/v1/dashboard/recent",
      );
      return res.data.data ?? [];
    },
    refetchInterval: 30000,
  });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Recent Attendance
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Personnel</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <SkeletonRows />
            ) : (
              records?.map((record) => (
                <TableRow key={record.id} hover>
                  <TableCell>{record.personnelName}</TableCell>
                  <TableCell>
                    {record.type === "time_in" ? "Time In" : "Time Out"}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={record.status}
                      color={STATUS_COLORS[record.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(record.createdAt).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
