"use client";

import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ApartmentIcon from "@mui/icons-material/Apartment";
import BadgeIcon from "@mui/icons-material/Badge";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { buildImageUrl, formatSectionLabel } from "@/lib/personnel-display";
import type { ApiEnvelope } from "@/types/api";

interface PersonnelRow {
  personnelId: number;
  name: string;
  rank: string;
  stationName: string;
  imagePath: string | null;
  section: string;
  status: "present" | "late" | "shifting" | "on_leave";
}

const STATUS_CONFIG: Record<
  PersonnelRow["status"],
  { label: string; color: string; tint: string }
> = {
  present: { label: "Present", color: "#2E7D32", tint: "#E8F5E9" },
  late: { label: "Late", color: "#F9A825", tint: "#FFF4D6" },
  shifting: { label: "Shifting", color: "#F57C00", tint: "#FDEBDD" },
  on_leave: { label: "On Leave", color: "#7B61A8", tint: "#F1EBFB" },
};

function StatusCardSkeleton() {
  return (
    <Card
      sx={{
        height: "100%",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Skeleton variant="rectangular" height={148} />
      <Box sx={{ p: 2.5 }}>
        <Skeleton variant="text" width="45%" height={32} />
        <Skeleton variant="text" width="70%" />
        <Stack direction="row" spacing={1} sx={{ mt: 2, mb: 2 }}>
          <Skeleton variant="rounded" width={84} height={28} />
          <Skeleton variant="rounded" width={96} height={28} />
        </Stack>
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="65%" />
      </Box>
    </Card>
  );
}

export default function PersonnelStatusTable() {
  const { data: personnel = [], isLoading } = useQuery<PersonnelRow[]>({
    queryKey: ["dashboard", "personnel-status-today"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PersonnelRow[]>>(
        "/api/v1/dashboard/personnel-status",
      );
      return res.data.data ?? [];
    },
    refetchInterval: 3000,
  });

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,250,250,0.98) 100%)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={1}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h6">Personnel Status Today</Typography>
          <Typography variant="body2" color="text.secondary">
            Live personnel presence in a cleaner, profile-focused view.
          </Typography>
        </Box>
        <Chip
          label={`${personnel.length} personnel tracked`}
          size="small"
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
        />
      </Stack>

      <Grid container spacing={2.5}>
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                <StatusCardSkeleton />
              </Grid>
            ))
          : personnel.map((person) => {
              const status = STATUS_CONFIG[person.status] ?? STATUS_CONFIG.late;

              return (
                <Grid key={person.personnelId} size={{ xs: 12, sm: 6, lg: 3 }}>
                  <Card
                    sx={{
                      height: "100%",
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      boxShadow: "0 14px 34px rgba(25, 33, 61, 0.08)",
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        minHeight: 156,
                        px: 2.5,
                        pt: 2.5,
                        pb: 2,
                        display: "flex",
                        alignItems: "flex-end",
                        background: `linear-gradient(160deg, ${status.tint} 0%, rgba(255,255,255,0.92) 100%)`,
                      }}
                    >
                      <Chip
                        label={status.label}
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 16,
                          right: 16,
                          backgroundColor: status.color,
                          color: "#fff",
                          fontWeight: 700,
                        }}
                      />
                      <Avatar
                        src={buildImageUrl(person.imagePath)}
                        alt={person.name}
                        sx={{
                          width: 76,
                          height: 76,
                          border: "4px solid rgba(255,255,255,0.92)",
                          boxShadow: "0 12px 24px rgba(0,0,0,0.12)",
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          fontSize: "1.4rem",
                          fontWeight: 700,
                        }}
                      >
                        {person.name
                          .split(" ")
                          .slice(0, 2)
                          .map((part) => part[0] ?? "")
                          .join("")
                          .toUpperCase()}
                      </Avatar>
                    </Box>

                    <Box sx={{ p: 2.5 }}>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>
                        {person.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {person.rank}
                      </Typography>

                      <Stack
                        direction="row"
                        spacing={1}
                        flexWrap="wrap"
                        useFlexGap
                        sx={{ mb: 2 }}
                      >
                        <Chip
                          icon={<BadgeIcon />}
                          label={formatSectionLabel(person.section)}
                          variant="outlined"
                          size="small"
                        />
                        <Chip
                          icon={<ApartmentIcon />}
                          label={person.stationName}
                          variant="outlined"
                          size="small"
                        />
                      </Stack>

                      <Stack spacing={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AccessTimeIcon
                            sx={{ fontSize: 18, color: status.color }}
                          />
                          <Typography variant="body2" color="text.secondary">
                            Current status:{" "}
                            <Box
                              component="span"
                              sx={{ color: status.color, fontWeight: 700 }}
                            >
                              {status.label}
                            </Box>
                          </Typography>
                        </Stack>
                      </Stack>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
      </Grid>

      {!isLoading && personnel.length === 0 && (
        <Box
          sx={{
            mt: 2,
            borderRadius: 3,
            border: "1px dashed",
            borderColor: "divider",
            p: 4,
            textAlign: "center",
          }}
        >
          <Typography variant="body1">No personnel status available.</Typography>
          <Typography variant="body2" color="text.secondary">
            Check back after attendance data is recorded for today.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
