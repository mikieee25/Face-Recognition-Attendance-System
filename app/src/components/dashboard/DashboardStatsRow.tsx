"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";

interface DashboardStatsRowProps {
  children: ReactNode;
}

export default function DashboardStatsRow({ children }: DashboardStatsRowProps) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: { xs: "column", lg: "row" },
        alignItems: "stretch",
        gap: theme.spacing(3),
        width: "100%",
        "& > *": {
          height: "100%",
        },
      })}
    >
      {children}
    </Box>
  );
}
