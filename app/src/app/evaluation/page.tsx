"use client";

import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Image from "next/image";
import EvaluationGate from "@/components/evaluation/EvaluationGate";
import EvaluationKiosk from "@/components/evaluation/EvaluationKiosk";
import EvaluationSurvey from "@/components/evaluation/EvaluationSurvey";
import PersonnelPageClient from "@/components/personnel/PersonnelPageClient";
import ReportsPageClient from "@/components/reports/ReportsPageClient";
import AttendanceHistoryGrid from "@/components/attendance/AttendanceHistoryGrid";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import PeopleIcon from "@mui/icons-material/People";
import AssessmentIcon from "@mui/icons-material/Assessment";
import EventNoteIcon from "@mui/icons-material/EventNote";

type Stage = "gate" | "explore" | "survey";

export default function EvaluationPage() {
  const [stage, setStage] = useState<Stage>("gate");
  const [activeTab, setActiveTab] = useState(0);

  const handleAuthenticated = useCallback(() => {
    setStage("explore");
  }, []);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Header */}
      <Box
        sx={{
          background: "linear-gradient(135deg, #8E0000 0%, #C62828 100%)",
          px: { xs: 2, md: 4 },
          py: { xs: 1.5, md: 2 },
          boxShadow: "0 2px 16px rgba(0,0,0,0.5)",
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Image
              src="/bfp-logo.png"
              alt="BFP Logo"
              width={40}
              height={40}
              style={{ objectFit: "contain", filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.4))" }}
            />
            <Box>
              <Typography variant="body1" fontWeight={800} color="#fff" lineHeight={1.1}>
                BFP Sorsogon City
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>
                Face Recognition Attendance System — Evaluator Portal
              </Typography>
            </Box>
          </Stack>

          {stage === "explore" && (
            <Chip
              label="Evaluation Mode"
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.15)", color: "#fff", fontWeight: 700, border: "1px solid rgba(255,255,255,0.3)" }}
            />
          )}
        </Stack>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1 }}>
        {stage === "gate" && (
          <EvaluationGate onAuthenticated={handleAuthenticated} />
        )}

        {stage === "explore" && (
          <Box>
            {/* Tabs */}
            <Box sx={{ bgcolor: "#1b2e40", borderBottom: "1px solid #2e4460" }}>
              <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 1, md: 3 } }}>
                <Tabs
                  value={activeTab}
                  onChange={(_, v) => setActiveTab(v)}
                  variant="scrollable"
                  scrollButtons="auto"
                  sx={{
                    "& .MuiTab-root": { color: "#7a9cc0", fontWeight: 600, minHeight: 56 },
                    "& .MuiTab-root.Mui-selected": { color: "#e8f4fd" },
                    "& .MuiTabs-indicator": { bgcolor: "#C62828", height: 3 },
                  }}
                >
                  <Tab icon={<CameraAltIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Attendance Kiosk" />
                  <Tab icon={<PeopleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Personnel Management" />
                  <Tab icon={<AssessmentIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Attendance Reports" />
                  <Tab icon={<EventNoteIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Attendance Records" />
                </Tabs>
              </Box>
            </Box>

            {/* Tab Panels */}
            <Box sx={{ maxWidth: 1200, mx: "auto" }}>
              {activeTab === 0 && (
                <EvaluationKiosk onProceedToSurvey={() => setStage("survey")} />
              )}
              {activeTab === 1 && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <PersonnelPageClient />
                </Box>
              )}
              {activeTab === 2 && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <ReportsPageClient />
                </Box>
              )}
              {activeTab === 3 && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <AttendanceHistoryGrid />
                </Box>
              )}
            </Box>

            {/* Sticky bottom CTA (visible on all tabs except kiosk which has its own) */}
            {activeTab !== 0 && (
              <Box
                sx={{
                  position: "sticky",
                  bottom: 0,
                  bgcolor: "#0d1b2a",
                  borderTop: "1px solid #2e4460",
                  px: { xs: 2, md: 4 },
                  py: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                  zIndex: 10,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  Done exploring? Proceed to the survey when ready.
                </Typography>
                <Button
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => setStage("survey")}
                  sx={{
                    bgcolor: "#C62828",
                    "&:hover": { bgcolor: "#8E0000" },
                    fontWeight: 800,
                    boxShadow: "0 4px 16px rgba(198,40,40,0.4)",
                  }}
                >
                  Proceed to Survey
                </Button>
              </Box>
            )}
          </Box>
        )}

        {stage === "survey" && (
          <Box>
            <Box sx={{ px: { xs: 2, md: 4 }, py: 2, bgcolor: "#1b2e40", borderBottom: "1px solid #2e4460" }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">
                  Changed your mind? You can still go back and explore more.
                </Typography>
                <Button
                  size="small"
                  onClick={() => setStage("explore")}
                  sx={{ color: "#7a9cc0" }}
                >
                  ← Back to System
                </Button>
              </Stack>
              <Divider sx={{ borderColor: "#2e4460", mt: 1 }} />
            </Box>
            <EvaluationSurvey />
          </Box>
        )}
      </Box>
    </Box>
  );
}
