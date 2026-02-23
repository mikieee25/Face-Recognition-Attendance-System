"use client";

import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import LogoutIcon from "@mui/icons-material/Logout";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: number;
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function usePendingCount(isAdmin: boolean) {
  return useQuery<number>({
    queryKey: ["pending", "count"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<{ count: number }>>(
        "/api/v1/pending/count",
      );
      return res.data.data?.count ?? 0;
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });
}

function SidebarContent() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const isKiosk = user?.role === "kiosk";
  const { data: pendingCount = 0 } = usePendingCount(isAdmin);

  if (isKiosk) {
    return (
      <Box
        sx={{ p: 2, display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
          BFP Sorsogon
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Kiosk Mode
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={logout}
          fullWidth
        >
          Logout
        </Button>
      </Box>
    );
  }

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/", icon: <DashboardIcon /> },
    { label: "Personnel", href: "/personnel", icon: <PeopleIcon /> },
    {
      label: "Attendance",
      href: "/attendance/history",
      icon: <AccessTimeIcon />,
    },
    { label: "Reports", href: "/reports", icon: <AssessmentIcon /> },
    {
      label: "Pending Approvals",
      href: "/pending",
      icon: (
        <Badge badgeContent={pendingCount || undefined} color="error">
          <PendingActionsIcon />
        </Badge>
      ),
      adminOnly: true,
    },
    {
      label: "Users",
      href: "/users",
      icon: <ManageAccountsIcon />,
      adminOnly: true,
    },
  ];

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <Box>
      <Toolbar>
        <Typography variant="h6" color="primary" noWrap>
          BFP Sorsogon
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={isActive}
              sx={{
                "&.Mui-selected": {
                  backgroundColor: "primary.light",
                  color: "primary.contrastText",
                  "& .MuiListItemIcon-root": { color: "primary.contrastText" },
                  "&:hover": { backgroundColor: "primary.main" },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <Box
      component="nav"
      sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
    >
      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
      >
        <SidebarContent />
      </Drawer>

      {/* Desktop drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": {
            boxSizing: "border-box",
            width: DRAWER_WIDTH,
          },
        }}
        open
      >
        <SidebarContent />
      </Drawer>
    </Box>
  );
}
