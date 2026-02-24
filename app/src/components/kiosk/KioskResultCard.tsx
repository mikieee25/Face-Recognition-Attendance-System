"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import CloseIcon from "@mui/icons-material/Close";
import type { CaptureResultData } from "@/app/kiosk/page";

interface Props {
  result: CaptureResultData;
  onDismiss: () => void;
}

export default function KioskResultCard({ result, onDismiss }: Props) {
  const isSuccess = result.success;

  return (
    <Paper
      sx={{
        p: 2.5,
        bgcolor: isSuccess ? "rgba(25,135,84,0.12)" : "rgba(220,53,69,0.12)",
        border: "1px solid",
        borderColor: isSuccess ? "rgba(25,135,84,0.4)" : "rgba(220,53,69,0.4)",
        textAlign: "center",
        position: "relative",
      }}
    >
      <IconButton
        size="small"
        onClick={onDismiss}
        sx={{ position: "absolute", top: 8, right: 8, color: "text.secondary" }}
        aria-label="Dismiss"
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <Box
        sx={{ fontSize: 56, color: isSuccess ? "#25a961" : "#dc3545", mb: 1 }}
      >
        {isSuccess ? (
          <CheckCircleIcon fontSize="inherit" />
        ) : (
          <ErrorIcon fontSize="inherit" />
        )}
      </Box>

      <Typography
        variant="h6"
        fontWeight={800}
        color={isSuccess ? "#25a961" : "#dc3545"}
      >
        {isSuccess
          ? (result.action ?? "Attendance Recorded")
          : "Recognition Failed"}
      </Typography>

      {isSuccess && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {result.personnelName && (
            <Typography variant="body1" fontWeight={700}>
              {result.personnelName}
            </Typography>
          )}
          {result.station && (
            <Typography variant="body2" color="text.secondary">
              {result.station}
            </Typography>
          )}
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            sx={{ mt: 1 }}
          >
            {result.time && (
              <Chip
                label={`${result.type === "time_out" ? "Time Out" : "Time In"}: ${result.time}`}
                color="success"
                size="small"
              />
            )}
            {result.status && <Chip label={result.status} size="small" />}
          </Stack>
        </Stack>
      )}

      {!isSuccess && (
        <Typography variant="body2" color="text.primary" sx={{ mt: 1 }}>
          {result.error ?? "Please try again."}
        </Typography>
      )}
    </Paper>
  );
}
