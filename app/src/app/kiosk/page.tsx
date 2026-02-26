"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
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
          px: { xs: 1.5, md: 3 },
          py: { xs: 1, md: 1 },
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
          flexShrink: 0,
        }}
      >
        {/* Row 1: Logo + Title | Clock | Logout */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          {/* Logo + Title */}
          <Stack direction="row" alignItems="center" spacing={1}>
            <Image
              src="/bfp-logo.png"
              alt="BFP Logo"
              width={36}
              height={36}
              style={{
                objectFit: "contain",
                filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))",
              }}
            />
            <Box>
              <Typography
                variant="body1"
                fontWeight={800}
                color="#fff"
                lineHeight={1.1}
              >
                BFP Sorsogon
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "rgba(255,255,255,0.75)", lineHeight: 1 }}
              >
                Attendance Kiosk
              </Typography>
            </Box>
          </Stack>

          {/* Clock — center */}
          <Typography
            fontWeight={800}
            color="#fff"
            letterSpacing="0.05em"
            sx={{
              fontSize: { xs: "1.1rem", sm: "1.5rem" },
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {clock.time}
          </Typography>

          {/* Logout */}
          <IconButton
            onClick={logout}
            sx={{ color: "#fff", p: { xs: 0.5, sm: 1 } }}
            aria-label="Logout"
          >
            <LogoutIcon />
          </IconButton>
        </Stack>

        {/* Row 2: Date + Username */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mt: 0.25 }}
        >
          <Typography
            variant="caption"
            sx={{ color: "rgba(255,255,255,0.75)" }}
          >
            {clock.date}
          </Typography>
          {user && (
            <Box
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1.5,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Typography variant="caption" fontWeight={600} color="#fff">
                {user.username}
              </Typography>
            </Box>
          )}
        </Stack>
      </Box>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          p: { xs: 2, md: 3 },
          gap: 3,
        }}
      >
        {/* Top: Actions */}
        <KioskActionButtons onAction={handleAction} disabled={cameraOpen} />

        {/* Result Card (if any) */}
        {result && (
          <KioskResultCard result={result} onDismiss={() => setResult(null)} />
        )}

        {/* Bottom: Recent Attendance */}
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
