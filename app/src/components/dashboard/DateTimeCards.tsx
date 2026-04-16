"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

interface DateTimeCardProps {
  label: string;
  value: React.ReactNode;
  color: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function DateTimeCard({ label, value, color, icon, loading }: DateTimeCardProps) {
  return (
    <Card sx={{ height: "100%", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", borderRadius: 2 }}>
      <CardContent sx={{ p: "16px !important" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              p: 1.25,
              borderRadius: 2,
              backgroundColor: `${color}20`,
              color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {icon}
          </Box>
          <Box>
            {loading ? (
              <>
                <Skeleton variant="text" width={120} height={32} />
                <Skeleton variant="text" width={80} />
              </>
            ) : (
              <>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2, mb: 0.25 }}>
                  {value ?? ""}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
              </>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DateTimeCards() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const initTimer = setTimeout(() => {
      setCurrentTime(new Date());
    }, 0);

    return () => {
      clearInterval(timer);
      clearTimeout(initTimer);
    };
  }, []);

  const dateStr = currentTime
    ? currentTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const timeStr = currentTime
    ? currentTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "";

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={3}>
      <Box sx={{ minWidth: { sm: 260, md: 280 } }}>
        <DateTimeCard
          label="Current Date"
          value={dateStr}
          color="#0288d1" // Light Blue
          icon={<CalendarTodayIcon fontSize="medium" />}
          loading={!currentTime}
        />
      </Box>
      <Box sx={{ minWidth: { sm: 240, md: 260 } }}>
        <DateTimeCard
          label="Current Time"
          value={timeStr}
          color="#d32f2f" // Error Red
          icon={<AccessTimeIcon fontSize="medium" />}
          loading={!currentTime}
        />
      </Box>
    </Stack>
  );
}
