"use client";

import { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

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
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={{ xs: 1.5, md: 4 }}
      alignItems={{ xs: "flex-start", md: "center" }}
      sx={{ color: "text.primary" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <CalendarTodayIcon sx={{ fontSize: { xs: 28, md: 36 }, color: "primary.main" }} />
        {currentTime ? (
          <Typography variant="h4" fontWeight={600} sx={{ letterSpacing: "-0.02em" }}>
            {dateStr}
          </Typography>
        ) : (
          <Skeleton variant="text" width={200} height={40} />
        )}
      </Box>

      <Box
        sx={{
          display: { xs: "none", md: "block" },
          width: "2px",
          height: "32px",
          backgroundColor: "divider",
        }}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <AccessTimeIcon sx={{ fontSize: { xs: 28, md: 36 }, color: "error.main" }} />
        {currentTime ? (
          <Typography variant="h4" fontWeight={600} sx={{ letterSpacing: "-0.02em" }}>
            {timeStr}
          </Typography>
        ) : (
          <Skeleton variant="text" width={160} height={40} />
        )}
      </Box>
    </Stack>
  );
}
