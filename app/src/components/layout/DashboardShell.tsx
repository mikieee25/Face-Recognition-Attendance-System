"use client";

import Box from "@mui/material/Box";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardAppBar from "./DashboardAppBar";
import Sidebar from "./Sidebar";
import { useAuth } from "@/hooks/useAuth";

interface DashboardShellProps {
  children: React.ReactNode;
}

export default function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Redirect kiosk users away from dashboard
  useEffect(() => {
    if (!isLoading && user?.role === "kiosk") {
      router.replace("/kiosk");
    }
  }, [user, isLoading, router]);

  // Don't render dashboard shell for kiosk users
  if (!isLoading && user?.role === "kiosk") return null;

  return (
    <Box sx={{ display: "flex" }}>
      <DashboardAppBar onMenuClick={() => setMobileOpen(!mobileOpen)} />
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: { xs: 7, sm: 8 },
          minHeight: "100vh",
          backgroundColor: "background.default",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
