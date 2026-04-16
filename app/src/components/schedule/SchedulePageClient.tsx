"use client";

import { useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import BatchScheduleModal from "./BatchScheduleModal";
import apiClient from "@/lib/api-client";
import { buildCoverBackground, buildImageUrl, formatSectionLabel, getPersonnelInitials } from "@/lib/personnel-display";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

type ScheduleType = "regular" | "shifting" | "leave";

interface ScheduleDto {
  id?: number;
  personnelId?: number;
  date: string;
  type: ScheduleType;
  shiftStartTime?: string;
  shiftEndTime?: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
}

const DEFAULT_SHIFT_START = "08:00";
const DEFAULT_SHIFT_END = "17:00";

function normalizeTimeForInput(value?: string | null): string {
  if (!value) return DEFAULT_SHIFT_START;
  return value.slice(0, 5);
}

function formatShiftRange(start?: string, end?: string): string {
  return `${normalizeTimeForInput(start)} - ${normalizeTimeForInput(end ?? DEFAULT_SHIFT_END)}`;
}

function ScheduleSelectCardSkeleton() {
  return (
    <Card
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Skeleton variant="rectangular" height={136} />
      <CardContent>
        <Skeleton variant="text" width="60%" height={32} />
        <Skeleton variant="text" width="40%" />
        <Stack direction="row" spacing={1} sx={{ mt: 2, mb: 2 }}>
          <Skeleton variant="rounded" width={88} height={28} />
          <Skeleton variant="rounded" width={110} height={28} />
        </Stack>
        <Skeleton variant="text" />
        <Skeleton variant="text" width="75%" />
      </CardContent>
    </Card>
  );
}

export default function SchedulePageClient() {
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<number[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);

  const handleTogglePersonnel = (id: number) => {
    setSelectedPersonnelIds((prev) => (prev.includes(id) ? prev.filter((pId) => pId !== id) : [...prev, id]));
  };

  const { data: personnelList = [], isLoading: isLoadingPersonnel } = useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
      return res.data.data || [];
    },
  });

  const { data: stationsData = [] } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
  });

  const stationMap = new Map(stationsData.map((station) => [station.id, station.name]));

  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const { data: allSchedules = [], isLoading: isLoadingAllSchedules } = useQuery({
    queryKey: ["schedules", "today", todayStr],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ScheduleDto[]>>(`/api/v1/schedule?date=${todayStr}`);
      return res.data.data || [];
    },
  });

  return (
    <Box sx={(theme) => ({ p: theme.spacing(3) })}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Schedule Management</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" disabled={selectedPersonnelIds.length === 0} onClick={() => setBatchModalOpen(true)}>
            Assign Selected ({selectedPersonnelIds.length})
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Select Personnel
          </Typography>
          {isLoadingPersonnel || isLoadingAllSchedules ? (
            <Grid container spacing={2.5}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <ScheduleSelectCardSkeleton />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2.5}>
              {personnelList.map((person) => {
                const todaySched = allSchedules.find((schedule) => schedule.personnelId === person.id && schedule.date === todayStr);
                const scheduleType = todaySched?.type ?? "regular";
                const shiftStartTime = todaySched?.shiftStartTime ?? DEFAULT_SHIFT_START;
                const shiftEndTime = todaySched?.shiftEndTime ?? DEFAULT_SHIFT_END;

                return (
                  <Grid key={person.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card
                      sx={{
                        height: "100%",
                        border: selectedPersonnelIds.includes(person.id) ? "2px solid" : "1px solid",
                        borderColor: selectedPersonnelIds.includes(person.id) ? "primary.main" : "divider",
                        boxShadow: "0 16px 36px rgba(24, 33, 52, 0.08)",
                        transition: "all 0.2s ease-in-out",
                        cursor: "pointer",
                      }}
                      onClick={() => handleTogglePersonnel(person.id)}
                    >
                      <Box
                        sx={{
                          px: 2,
                          pt: 2,
                          pb: 1.5,
                          minHeight: 120,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "space-between",
                          gap: 2,
                          position: "relative",
                          backgroundImage: buildCoverBackground(
                            person.coverImagePath,
                            "linear-gradient(160deg, rgba(198,40,40,0.10) 0%, rgba(255,248,248,1) 45%, rgba(245,245,245,1) 100%)",
                          ),
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <Checkbox
                          checked={selectedPersonnelIds.includes(person.id)}
                          size="small"
                          disableRipple
                          sx={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            p: 0.5,
                            bgcolor: "rgba(255,255,255,0.7)",
                            backdropFilter: "blur(4px)",
                            borderRadius: 1,
                            "&:hover": { bgcolor: "rgba(255,255,255,0.9)" },
                          }}
                        />
                        <Avatar
                          src={buildImageUrl(person.imagePath)}
                          alt={`${person.firstName} ${person.lastName}`}
                          sx={{
                            width: 64,
                            height: 64,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontSize: "1.45rem",
                            fontWeight: 700,
                            border: "4px solid rgba(255,255,255,0.94)",
                            boxShadow: "0 10px 22px rgba(0,0,0,0.14)",
                          }}
                        >
                          {getPersonnelInitials(person.firstName, person.lastName)}
                        </Avatar>
                      </Box>

                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" sx={{ mb: 0.5, lineHeight: 1.2 }}>
                              {person.firstName} {person.lastName}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {person.rank || "No rank assigned"}
                            </Typography>

                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                              <Chip label={formatSectionLabel(person.section)} variant="outlined" size="small" />
                              <Chip
                                label={stationMap.get(person.stationId) ?? `Station #${person.stationId}`}
                                variant="outlined"
                                size="small"
                              />
                            </Stack>
                          </Box>

                          <Box sx={{ textAlign: "right" }}>
                            <Box sx={{ mb: 1 }}>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: "nowrap" }}>
                                Today&apos;s Schedule
                              </Typography>
                              <Typography variant="body2" fontWeight={500}>
                                {scheduleType.charAt(0).toUpperCase() + scheduleType.slice(1)}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ whiteSpace: "nowrap" }}>
                                Shift Window
                              </Typography>
                              <Typography variant="body2" fontWeight={500} sx={{ whiteSpace: "nowrap" }}>
                                {formatShiftRange(shiftStartTime, shiftEndTime)}
                              </Typography>
                            </Box>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>

      {batchModalOpen && (
        <BatchScheduleModal
          open={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          personnelIds={selectedPersonnelIds}
          onSuccess={() => {
            setSelectedPersonnelIds([]);
          }}
        />
      )}
    </Box>
  );
}
