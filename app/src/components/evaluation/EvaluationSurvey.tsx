"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Button from "@mui/material/Button";

const GOOGLE_FORM_EMBED_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfObOetJ4V3Ug5CDG2dzM0q3lgeNIKCowrDebA6FfUwaG8ljw/viewform?embedded=true";
const GOOGLE_FORM_OPEN_URL = "https://forms.gle/EUz25JQ7Np5Z1PoF9";

export default function EvaluationSurvey() {
  const isConfigured = !GOOGLE_FORM_EMBED_URL.startsWith("PASTE");

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 860, mx: "auto", pb: 6 }}>
      {/* Header */}
      <Paper
        sx={{
          mb: 3,
          p: { xs: 2, md: 3 },
          bgcolor: "#1b2e40",
          border: "1px solid #2e4460",
          borderTop: "4px solid #C62828",
        }}
      >
        <Typography variant="h5" fontWeight={800} color="#e8f4fd" sx={{ mb: 0.5 }}>
          System Evaluation Survey
        </Typography>
        <Typography variant="body2" color="#C62828" fontWeight={600} sx={{ mb: 1 }}>
          Face Recognition-Based Attendance Monitoring System — BFP Sorsogon City
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Please fill out the survey below. All responses are kept confidential and used solely for academic purposes.
        </Typography>

        {/* Open in new tab fallback */}
        {isConfigured && (
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
              href={GOOGLE_FORM_OPEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "#7a9cc0", fontSize: "0.75rem", p: 0, "&:hover": { color: "#e8f4fd" } }}
            >
              Open survey in a new tab
            </Button>
          </Box>
        )}
      </Paper>

      {/* Google Form iframe */}
      {isConfigured ? (
        <Paper sx={{ bgcolor: "#1b2e40", border: "1px solid #2e4460", borderRadius: 3, overflow: "hidden" }}>
          <Box
            component="iframe"
            src={GOOGLE_FORM_EMBED_URL}
            title="System Evaluation Survey"
            width="100%"
            sx={{
              height: { xs: "80vh", md: "90vh" },
              border: "none",
              display: "block",
            }}
            allowFullScreen
          />
        </Paper>
      ) : (
        // Placeholder shown until the URL is configured
        <Paper
          sx={{
            p: 4,
            bgcolor: "#1b2e40",
            border: "1px dashed #2e4460",
            borderRadius: 3,
            textAlign: "center",
          }}
        >
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            📋 Google Form not yet configured.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Set <code style={{ color: "#7c68b5" }}>GOOGLE_FORM_EMBED_URL</code> in{" "}
            <code style={{ color: "#7c68b5" }}>EvaluationSurvey.tsx</code> to your Google Form embed link.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
