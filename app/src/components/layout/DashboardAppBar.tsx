"use client";

import Link from "next/link";
import Image from "next/image";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useAuth } from "@/hooks/useAuth";

interface DashboardAppBarProps {
  onMenuClick: () => void;
}

export default function DashboardAppBar({ onMenuClick }: DashboardAppBarProps) {
  const { user, logout } = useAuth();

  return (
    <AppBar
      position="fixed"
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onMenuClick}
          sx={{ mr: 2, display: { md: "none" } }}
        >
          <MenuIcon />
        </IconButton>

        <Box
          component={Link}
          href="/"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexGrow: 1,
            textDecoration: "none",
            color: "inherit",
            cursor: "pointer",
          }}
        >
          <Image
            src="/bfp-logo.png"
            alt="BFP Logo"
            width={36}
            height={36}
            style={{ objectFit: "contain" }}
          />
          <Typography
            variant="h6"
            component="div"
            sx={{ display: { xs: "none", sm: "block" } }}
          >
            BFP Attendance System
          </Typography>
          <Typography
            variant="h6"
            component="div"
            sx={{ display: { xs: "block", sm: "none" } }}
          >
            BFP Attendance
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {user && (
            <Box
              sx={{
                display: { xs: "none", sm: "flex" },
                alignItems: "center",
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                {user.username}
              </Typography>
            </Box>
          )}
          <IconButton color="inherit" aria-label="logout" onClick={logout}>
            <LogoutIcon />
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
