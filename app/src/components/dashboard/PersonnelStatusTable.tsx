"use client";

import { useMemo, useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
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
import Pagination from "@mui/material/Pagination";

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
  coverImagePath: string | null;
  section: string;
  status: "present" | "late" | "shifting" | "on_leave" | "off_duty";
}

const STATUS_CONFIG: Record<PersonnelRow["status"], { label: string; color: string; tint: string }> = {
  present: { label: "Present", color: "#2E7D32", tint: "#E8F5E9" },
  late: { label: "Late", color: "#F9A825", tint: "#FFF4D6" },
  shifting: { label: "Shifting", color: "#2196f3", tint: "#E3F2FD" },
  on_leave: { label: "On Leave", color: "#6F42A6", tint: "#ECE2F8" },
  off_duty: { label: "Off Duty", color: "#607d8b", tint: "#ECEFF1" },
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
  const [statusFilter, setStatusFilter] = useState<PersonnelRow["status"] | "all">("all");
  const [stationFilter, setStationFilter] = useState<string>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [personnelFilter, setPersonnelFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const { data: personnel = [], isLoading } = useQuery<PersonnelRow[]>({
    queryKey: ["dashboard", "personnel-status-today"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<PersonnelRow[]>>("/api/v1/dashboard/personnel-status");
      return res.data.data ?? [];
    },
    refetchInterval: 3000,
  });

  const stationOptions = useMemo(() => {
    const stations = Array.from(new Set(personnel.map((p) => p.stationName).filter(Boolean)));
    stations.sort((a, b) => a.localeCompare(b));
    return stations;
  }, [personnel]);

  const sectionOptions = useMemo(() => {
    const sections = Array.from(new Set(personnel.map((p) => formatSectionLabel(p.section)).filter(Boolean)));
    sections.sort((a, b) => a.localeCompare(b));
    return sections;
  }, [personnel]);

  const filteredPersonnel = useMemo(() => {
    const q = personnelFilter.trim().toLowerCase();

    const STATUS_ORDER: Record<PersonnelRow["status"], number> = {
      present: 0,
      late: 1,
      shifting: 2,
      on_leave: 3,
      off_duty: 4,
    };

    return personnel
      .filter((p) => {
        const statusOk = statusFilter === "all" ? true : p.status === statusFilter;
        const stationOk = stationFilter === "all" ? true : p.stationName === stationFilter;
        const sectionOk = sectionFilter === "all" ? true : formatSectionLabel(p.section) === sectionFilter;

        const personnelOk =
          q.length === 0 ? true : `${p.name} ${p.rank} ${p.stationName} ${formatSectionLabel(p.section)}`.toLowerCase().includes(q);

        return statusOk && stationOk && sectionOk && personnelOk;
      })
      .sort((a, b) => {
        const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        if (statusDiff !== 0) return statusDiff;
        return a.name.localeCompare(b.name);
      });
  }, [personnel, personnelFilter, sectionFilter, stationFilter, statusFilter]);


  const paginatedPersonnel = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return filteredPersonnel.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPersonnel, page, itemsPerPage]);

  const pageCount = Math.ceil(filteredPersonnel.length / itemsPerPage);

  return (
    <Box
      sx={{
        p: { xs: 2, md: 3 },
        borderRadius: 4,
        border: "1px solid",
        borderColor: "divider",
        background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(250,250,250,0.98) 100%)",
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ sm: "center" }}
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        <Box>
          <Typography variant="h6">Personnel Status Today</Typography>
        </Box>
        <Chip
          label={`${filteredPersonnel.length} of ${personnel.length} personnel`}
          size="small"
          sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
        />
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2.5 }}>
        <TextField label="Search Personnel" value={personnelFilter} onChange={(e) => { setPersonnelFilter(e.target.value); setPage(1); }} fullWidth />

        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as PersonnelRow["status"] | "all"); setPage(1); }}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="present">Present</MenuItem>
            <MenuItem value="late">Late</MenuItem>
            <MenuItem value="shifting">Shifting</MenuItem>
            <MenuItem value="on_leave">On Leave</MenuItem>
            <MenuItem value="off_duty">Off Duty</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Station</InputLabel>
          <Select label="Station" value={stationFilter} onChange={(e) => { setStationFilter(e.target.value); setPage(1); }}>
            <MenuItem value="all">All</MenuItem>
            {stationOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Section</InputLabel>
          <Select label="Section" value={sectionFilter} onChange={(e) => { setSectionFilter(e.target.value); setPage(1); }}>
            <MenuItem value="all">All</MenuItem>
            {sectionOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      <Grid container spacing={2}>
        {isLoading
          ? Array.from({ length: 6 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
                <StatusCardSkeleton />
              </Grid>
            ))
          : paginatedPersonnel.map((person) => {
              const status = STATUS_CONFIG[person.status] ?? STATUS_CONFIG.late;
              const coverImage = buildImageUrl(person.coverImagePath);

              return (
                <Grid key={person.personnelId} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
                  <Card
                    sx={{
                      height: "100%",
                      width: "100%",
                      maxWidth: 300,
                      overflow: "hidden",
                      border: "1px solid",
                      borderColor: "divider",
                      boxShadow: "0 14px 34px rgba(25, 33, 61, 0.08)",
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        minHeight: 120,
                        px: 2,
                        pt: 2,
                        pb: 2,
                        display: "flex",
                        justifyContent: "center",
                        backgroundImage: coverImage ? `url("${coverImage}")` : "none",
                        backgroundColor: "white",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <Avatar
                        src={buildImageUrl(person.imagePath)}
                        alt={person.name}
                        sx={{
                          width: 120,
                          height: 120,
                          border: "3px solid rgba(255,255,255,0.92)",
                          boxShadow: "0 8px 16px rgba(0,0,0,0.12)",
                          bgcolor: "primary.main",
                          color: "primary.contrastText",
                          fontSize: "1.5rem",
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

                    <Box
                      sx={(theme) => ({
                        p: theme.spacing(2),
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        gap: theme.spacing(0.5),
                      })}
                    >
                      <Typography variant="subtitle1" fontWeight={700} sx={{ wordWrap: "break-word", lineHeight: 1.2, mb: 0.5 }}>
                        {person.name}
                      </Typography>

                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ color: "text.secondary" }}>
                        <ApartmentIcon sx={{ fontSize: 16 }} />
                        <Typography variant="caption" sx={{ wordWrap: "break-word" }}>
                          {person.stationName}
                        </Typography>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ color: "text.secondary" }}>
                        <BadgeIcon sx={{ fontSize: 16 }} />
                        <Typography variant="caption" sx={{ wordWrap: "break-word" }}>
                          {formatSectionLabel(person.section)}
                        </Typography>
                      </Stack>

                      <Chip
                        label={status.label}
                        size="small"
                        sx={(theme) => ({
                          mt: theme.spacing(1),
                          px: theme.spacing(1.5),
                          borderRadius: theme.spacing(3),
                          backgroundColor: status.color,
                          color: "#fff",
                          fontWeight: 700,
                        })}
                      />
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

      {!isLoading && personnel.length > 0 && filteredPersonnel.length === 0 && (
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
            Try changing Status, Station, Section, or your search keywords.
          </Typography>
        </Box>
      )}

      {!isLoading && pageCount > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" size="large" />
        </Box>
      )}
    </Box>
  );
}
