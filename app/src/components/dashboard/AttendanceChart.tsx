"use client";

import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

interface WeeklyData {
  date: string;
  present: number;
  absent: number;
}

interface MonthlyData {
  month: string;
  present: number;
  absent: number;
}

interface ChartData {
  weekly: WeeklyData[];
  monthly: MonthlyData[];
}

function ChartSkeleton() {
  return <Skeleton variant="rectangular" width="100%" height={250} />;
}

export default function AttendanceChart() {
  const { data, isLoading } = useQuery<ChartData>({
    queryKey: ["dashboard", "charts"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<ChartData>>(
        "/api/v1/dashboard/charts",
      );
      return res.data.data!;
    },
  });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Attendance Trends
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Weekly (Last 7 Days)
          </Typography>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.weekly ?? []}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#2E7D32" />
                <Bar dataKey="absent" name="Absent" fill="#C62828" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Grid>

        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Monthly (Last 6 Months)
          </Typography>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data?.monthly ?? []}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="present" name="Present" fill="#2E7D32" />
                <Bar dataKey="absent" name="Absent" fill="#C62828" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
}
