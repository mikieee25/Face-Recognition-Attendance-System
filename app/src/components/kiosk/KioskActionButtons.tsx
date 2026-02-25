"use client";

import ButtonBase from "@mui/material/ButtonBase";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LoginIcon from "@mui/icons-material/Login";
import LogoutIcon from "@mui/icons-material/Logout";
import EditNoteIcon from "@mui/icons-material/EditNote";

interface Props {
  onAction: (type: "time_in" | "time_out" | "manual") => void;
  disabled?: boolean;
}

const buttons = [
  {
    type: "time_in" as const,
    label: "Time In",
    icon: <LoginIcon sx={{ fontSize: 48 }} />,
    gradient: "linear-gradient(135deg, #1a7a4a 0%, #25a961 100%)",
    minHeight: 160,
  },
  {
    type: "time_out" as const,
    label: "Time Out",
    icon: <LogoutIcon sx={{ fontSize: 48 }} />,
    gradient: "linear-gradient(135deg, #1a5a99 0%, #2577cc 100%)",
    minHeight: 160,
  },
  {
    type: "manual" as const,
    label: "Manual Entry",
    icon: <EditNoteIcon sx={{ fontSize: 36 }} />,
    gradient: "linear-gradient(135deg, #5a4a8a 0%, #7c68b5 100%)",
    minHeight: 120,
  },
] as const;

export default function KioskActionButtons({ onAction, disabled }: Props) {
  return (
    <Paper sx={{ p: 2, bgcolor: "#243447", border: "1px solid #2e4460" }}>
      <Typography
        variant="overline"
        sx={{
          color: "#7a9cc0",
          fontWeight: 700,
          letterSpacing: "0.06em",
          mb: 1.5,
          display: "block",
        }}
      >
        Record Attendance
      </Typography>
      <Stack spacing={2} direction={{ xs: "row", lg: "column" }}>
        {buttons.map((btn) => (
          <ButtonBase
            key={btn.type}
            onClick={() => onAction(btn.type)}
            disabled={disabled}
            sx={{
              flex: 1,
              minHeight: { xs: 90, sm: btn.minHeight },
              borderRadius: 1.8,
              background: btn.gradient,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 0.5,
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
              transition: "transform 0.12s, box-shadow 0.12s",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
              },
              "&:active": { transform: "scale(0.96)" },
              "&:disabled": { opacity: 0.5 },
            }}
          >
            {btn.icon}
            <Typography
              variant="h6"
              fontWeight={800}
              letterSpacing="0.04em"
              textTransform="uppercase"
              sx={{ fontSize: { xs: "0.75rem", sm: "1.25rem" } }}
            >
              {btn.label}
            </Typography>
          </ButtonBase>
        ))}
      </Stack>
    </Paper>
  );
}
