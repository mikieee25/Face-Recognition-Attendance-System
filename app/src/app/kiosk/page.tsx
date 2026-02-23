"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import LogoutIcon from "@mui/icons-material/Logout";
import KioskActionButtons from "@/components/kiosk/KioskActionButtons";
import KioskCameraModal from "@/components/kiosk/KioskCameraModal";
import KioskManualModal from "@/components/kiosk/KioskManualModal";
import KioskRecentList from "@/components/kiosk/KioskRecentList";
import KioskResultCard from "@/components/kiosk/KioskResultCard";
import { useAuth } from "@/hooks/useAuth";
import type { AttendanceType } from "@/types/models";

export interface CaptureResultData {
  success: boolean;
  personnelName?: string;
  action?: string;
  station?: string;
  type?: AttendanceType;
  time?: string;
  status?: string;
  confidence?: number;
  error?: string;
}

export default function KioskPage() {
  const { user, logout } = useAuth();
  const [clock, setClock] = useState({ time: "--:--:--", date: "Loading…" });
  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [captureType, setCaptureType] = useState<"time_in" | "time_out">(
    "time_in",
  );
  const [result, setResult] = useState<CaptureResultData | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Live clock
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClock({
        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const handleAction = useCallback(
    (type: "time_in" | "time_out" | "manual") => {
      if (type === "manual") {
        setManualOpen(true);
      } else {
        setCaptureType(type);
        setCameraOpen(true);
      }
    },
    [],
  );

  const handleCaptureResult = useCallback((data: CaptureResultData) => {
    setResult(data);
    if (data.success) setRefreshKey((k) => k + 1);
  }, []);

  const handleManualSuccess = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Bar */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #8E0000 0%, #C62828 100%)",
          px: { xs: 2, md: 3 },
          py: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            component="img"
            src="/bfp-logo.png"
            alt="BFP Logo"
            sx={{
              height: 48,
              width: 48,
              objectFit: "contain",
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
            }}
          />
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight={800}
              color="#fff"
              lineHeight={1.2}
            >
              BFP Sorsogon
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.8)" }}
            >
              Attendance Kiosk
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ textAlign: "right" }}>
            <Typography
              variant="h5"
              fontWeight={800}
              color="#fff"
              letterSpacing="0.05em"
              lineHeight={1}
            >
              {clock.time}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.8)" }}
            >
              {clock.date}
            </Typography>
          </Box>
          {user && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 1 }}>
              <Box
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                <Typography variant="body2" fontWeight={500} color="#fff">
                  {user.username}
                </Typography>
              </Box>
              <IconButton
                onClick={logout}
                sx={{ color: "#fff" }}
                aria-label="Logout"
              >
                <LogoutIcon />
              </IconButton>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          p: { xs: 2, md: 3 },
          gap: 3,
          flexDirection: { xs: "column", lg: "row" },
        }}
      >
        {/* Left: Actions + Result */}
        <Stack spacing={3} sx={{ flex: { xs: "1 1 auto", lg: "0 0 420px" } }}>
          <KioskActionButtons onAction={handleAction} disabled={cameraOpen} />
          {result && (
            <KioskResultCard
              result={result}
              onDismiss={() => setResult(null)}
            />
          )}
        </Stack>

        {/* Right: Recent Attendance */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <KioskRecentList refreshKey={refreshKey} />
        </Box>
      </Box>

      {/* Camera Modal */}
      <KioskCameraModal
        open={cameraOpen}
        type={captureType}
        onClose={() => setCameraOpen(false)}
        onResult={handleCaptureResult}
      />

      {/* Manual Entry Modal */}
      <KioskManualModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={handleManualSuccess}
      />
    </Box>
  );
}
