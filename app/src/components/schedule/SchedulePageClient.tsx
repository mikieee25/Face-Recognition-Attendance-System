"use client";

import { useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import BatchScheduleModal from "./BatchScheduleModal";
import apiClient from "@/lib/api-client";
import { buildImageUrl, formatSectionLabel, getPersonnelInitials } from "@/lib/personnel-display";
import type { ApiEnvelope } from "@/types/api";
import type { Personnel, Station } from "@/types/models";

type ScheduleType = "regular" | "shifting" | "leave" | "off_duty";

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

const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  regular: "Regular",
  shifting: "Shifting",
  leave: "On Leave",
  off_duty: "Off Duty",
};

function ScheduleSelectCardSkeleton() {
  return (
    <Card
      sx={{
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1.5 }}>
        <Skeleton variant="circular" width={40} height={40} sx={{ flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="55%" height={20} />
          <Skeleton variant="text" width="35%" height={16} />
        </Box>
        <Skeleton variant="rounded" width={64} height={22} />
      </Box>
    </Card>
  );
}

export default function SchedulePageClient() {
  const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<number[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [personnelFilter, setPersonnelFilter] = useState("");
  const [stationFilter, setStationFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<ScheduleType | "all">("all");

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

  const stationMap = useMemo(() => new Map(stationsData.map((station) => [station.id, station.name])), [stationsData]);

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

  const stationOptions = useMemo(() => {
    const stations = Array.from(new Set(personnelList.map((person) => stationMap.get(person.stationId)).filter(Boolean))) as string[];
    stations.sort((a, b) => a.localeCompare(b));
    return stations;
  }, [personnelList, stationMap]);

  const sectionOptions = useMemo(() => {
    const sections = Array.from(new Set(personnelList.map((person) => formatSectionLabel(person.section)).filter(Boolean)));
    sections.sort((a, b) => a.localeCompare(b));
    return sections;
  }, [personnelList]);

  const filteredPersonnel = useMemo(() => {
    const q = personnelFilter.trim().toLowerCase();

    return [...personnelList]
      .filter((person) => {
        const stationName = stationMap.get(person.stationId) ?? `Station #${person.stationId}`;
        const sectionName = formatSectionLabel(person.section);
        const todaySched = allSchedules.find((schedule) => schedule.personnelId === person.id && schedule.date === todayStr);
        const scheduleType = todaySched?.type ?? "off_duty";
        const stationOk = stationFilter === "all" ? true : stationName === stationFilter;
        const sectionOk = sectionFilter === "all" ? true : sectionName === sectionFilter;
        const scheduleTypeOk = scheduleTypeFilter === "all" ? true : scheduleType === scheduleTypeFilter;
        const personnelOk =
          q.length === 0
            ? true
            : `${person.firstName} ${person.lastName} ${person.rank} ${stationName} ${sectionName} ${scheduleType}`.toLowerCase().includes(q);

        return stationOk && sectionOk && scheduleTypeOk && personnelOk;
      })
      .sort((a, b) => {
        const aName = `${a.firstName} ${a.lastName}`.trim();
        const bName = `${b.firstName} ${b.lastName}`.trim();
        return aName.localeCompare(bName);
      });
  }, [allSchedules, personnelFilter, personnelList, scheduleTypeFilter, sectionFilter, stationFilter, stationMap, todayStr]);

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
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            spacing={1}
            sx={{ mb: 2 }}
          >
            <Typography variant="h6">Select Personnel</Typography>
            <Chip
              label={`${filteredPersonnel.length} of ${personnelList.length} personnel`}
              size="small"
              sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
            />
          </Stack>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2.5 }}>
            <TextField label="Search Personnel" value={personnelFilter} onChange={(e) => setPersonnelFilter(e.target.value)} fullWidth />

            <FormControl fullWidth>
              <InputLabel>Station</InputLabel>
              <Select label="Station" value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {stationOptions.map((station) => (
                  <MenuItem key={station} value={station}>
                    {station}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Section</InputLabel>
              <Select label="Section" value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                <MenuItem value="all">All</MenuItem>
                {sectionOptions.map((section) => (
                  <MenuItem key={section} value={section}>
                    {section}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Schedule Type</InputLabel>
              <Select
                label="Schedule Type"
                value={scheduleTypeFilter}
                onChange={(e) => setScheduleTypeFilter(e.target.value as ScheduleType | "all")}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="regular">Regular</MenuItem>
                <MenuItem value="shifting">Shifting</MenuItem>
                <MenuItem value="leave">Leave</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {isLoadingPersonnel || isLoadingAllSchedules ? (
            <Grid container spacing={1.5}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <ScheduleSelectCardSkeleton />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={1.5}>
              {filteredPersonnel.map((person) => {
                const todaySched = allSchedules.find((schedule) => schedule.personnelId === person.id && schedule.date === todayStr);
                const scheduleType = todaySched?.type ?? "off_duty";
                const isSelected = selectedPersonnelIds.includes(person.id);

                return (
                  <Grid key={person.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <Card
                      sx={{
                        height: "100%",
                        border: isSelected ? "2px solid" : "1px solid",
                        borderColor: isSelected ? "primary.main" : "divider",
                        bgcolor: isSelected ? "primary.50" : "background.paper",
                        boxShadow: isSelected ? "0 0 0 3px rgba(25,118,210,0.12)" : "none",
                        transition: "all 0.15s ease-in-out",
                        cursor: "pointer",
                        "&:hover": { borderColor: "primary.light", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
                      }}
                      onClick={() => handleTogglePersonnel(person.id)}
                    >
                      <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        px: 2.5,
                        py: 2,
                        height: "100%",
                      }}>
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          size="small"
                          disableRipple
                          sx={{ p: 0, flexShrink: 0, alignSelf: "flex-start", mt: 0.5 }}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleTogglePersonnel(person.id)}
                        />

                        {/* Avatar */}
                        <Avatar
                          src={buildImageUrl(person.imagePath)}
                          alt={`${person.firstName} ${person.lastName}`}
                          sx={{
                            width: 88,
                            height: 88,
                            flexShrink: 0,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontSize: "1.7rem",
                            fontWeight: 700,
                          }}
                        >
                          {getPersonnelInitials(person.firstName, person.lastName)}
                        </Avatar>

                        {/* Info */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3, fontSize: "1rem" }}>
                            {person.firstName} {person.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            {person.rank}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                            {formatSectionLabel(person.section)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {stationMap.get(person.stationId) ?? `Station #${person.stationId}`}
                          </Typography>
                        </Box>

                        {/* Schedule badge */}
                        <Chip
                          label={SCHEDULE_LABEL[scheduleType] ?? scheduleType}
                          size="small"
                          sx={{
                            flexShrink: 0,
                            alignSelf: "flex-start",
                            mt: 0.5,
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            bgcolor: scheduleType === "regular" ? "#e8f5e9"
                              : scheduleType === "shifting" ? "#e3f2fd"
                              : scheduleType === "leave" ? "#ede7f6"
                              : "#eceff1",
                            color: scheduleType === "regular" ? "#2e7d32"
                              : scheduleType === "shifting" ? "#1565c0"
                              : scheduleType === "leave" ? "#6f42a6"
                              : "#546e7a",
                          }}
                        />
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}

          {!isLoadingPersonnel && !isLoadingAllSchedules && personnelList.length > 0 && filteredPersonnel.length === 0 && (
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
              <Typography variant="body1">No results match your filters.</Typography>
              <Typography variant="body2" color="text.secondary">
                Try changing Station, Section, Schedule Type, or your search keywords.
              </Typography>
            </Box>
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
