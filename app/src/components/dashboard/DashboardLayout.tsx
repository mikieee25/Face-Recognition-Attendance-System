"use client";

import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface DashboardLayoutProps {
  title: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

export default function DashboardLayout({ title, headerRight, children }: DashboardLayoutProps) {
  return (
    <Box
      sx={(theme) => ({
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(3),
      })}
    >
      <Box
        sx={(theme) => ({
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", md: "center" },
          gap: theme.spacing(2),
        })}
      >
        <Typography variant="h4">{title}</Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: { xs: "flex-start", md: "flex-end" },
            width: { xs: "100%", md: "auto" },
          }}
        >
          {headerRight}
        </Box>
      </Box>

      {children}
    </Box>
  );
}
