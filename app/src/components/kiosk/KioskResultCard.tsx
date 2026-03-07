"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import CloseIcon from "@mui/icons-material/Close";
import type { CaptureResultData } from "@/app/kiosk/page";

interface Props {
  result: CaptureResultData;
  onDismiss: () => void;
}

export default function KioskResultCard({ result, onDismiss }: Props) {
  const isSuccess = result.success;
  const isPending = isSuccess && result.status === "pending";

  const bgColor = isPending ? "rgba(255,167,38,0.12)" : isSuccess ? "rgba(25,135,84,0.12)" : "rgba(220,53,69,0.12)";

  const borderColor = isPending ? "rgba(255,167,38,0.45)" : isSuccess ? "rgba(25,135,84,0.4)" : "rgba(220,53,69,0.4)";

  const accentColor = isPending ? "#f5a623" : isSuccess ? "#25a961" : "#dc3545";

  return (
    <Paper
      sx={{
        p: 2.5,
        bgcolor: bgColor,
        border: "1px solid",
        borderColor,
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

      <Box sx={{ fontSize: 56, color: accentColor, mb: 1 }}>
        {isPending ? (
          <HourglassTopIcon fontSize="inherit" />
        ) : isSuccess ? (
          <CheckCircleIcon fontSize="inherit" />
        ) : (
          <ErrorIcon fontSize="inherit" />
        )}
      </Box>

      <Typography variant="h6" fontWeight={800} color={accentColor}>
        {isPending ? "Submitted for Approval" : isSuccess ? (result.action ?? "Attendance Recorded") : "Recognition Failed"}
      </Typography>

      {isPending && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          An admin will review and confirm your entry.
        </Typography>
      )}

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
          <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 1 }}>
            {result.time && (
              <Chip
                label={`${result.type === "time_out" ? "Time Out" : "Time In"}: ${result.time}`}
                color={isPending ? "warning" : "success"}
                size="small"
              />
            )}
            {isPending && <Chip label="Pending" color="warning" size="small" />}
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
