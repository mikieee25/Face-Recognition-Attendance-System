"use client";

import { useState } from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import TablePagination from "@mui/material/TablePagination";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { buildCoverBackground, buildImageUrl, formatSectionLabel, getPersonnelInitials } from "@/lib/personnel-display";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const DEFAULT_PAGE_SIZE = 12;

interface PersonnelDataGridProps {
  onEdit?: (personnel: Personnel) => void;
  onFaceRegister?: (personnel: Personnel) => void;
  onAdd?: () => void;
  onViewProfile?: (personnel: Personnel) => void;
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res = await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
  return res.data.data ?? [];
}

function LoadingCard() {
  return (
    <Card
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 12px 30px rgba(24, 33, 52, 0.08)",
      }}
    >
      <Skeleton variant="rectangular" height={144} />
      <CardContent>
        <Skeleton variant="text" width="60%" height={34} />
        <Skeleton variant="text" width="38%" />
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Skeleton variant="rounded" width={90} height={28} />
          <Skeleton variant="rounded" width={110} height={28} />
        </Stack>
        <Skeleton variant="text" sx={{ mt: 2 }} />
        <Skeleton variant="text" width="80%" />
      </CardContent>
    </Card>
  );
}

export default function PersonnelDataGrid({ onEdit, onFaceRegister, onAdd, onViewProfile }: PersonnelDataGridProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
      return res.data.data ?? [];
    },
  });
  const stationMap = new Map((stationsData ?? []).map((s) => [s.id, s.name]));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["personnel"],
    queryFn: () => fetchPersonnel(),
  });

  const allRows = data ?? [];
  const total = allRows.length;
  const rows = allRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const handlePageChange = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5}>
        <Box>
          <Typography variant="h4">Personnel Directory</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd} aria-label="Add personnel">
          Add Personnel
        </Button>
      </Stack>

      <Paper
        sx={{
          p: { xs: 2, md: 3 },
          borderRadius: 4,
          background: "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(247,247,247,1) 100%)",
        }}
      >
        {isLoading && (
          <Grid container spacing={2}>
            {Array.from({ length: 8 }).map((_, index) => (
              <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}>
                <LoadingCard />
              </Grid>
            ))}
          </Grid>
        )}

        {isError && (
          <Box sx={{ p: 3 }}>
            <Typography color="error">Failed to load personnel. Please try again.</Typography>
          </Box>
        )}

        {!isLoading && !isError && (
          <>
            {rows.length === 0 ? (
              <Box
                sx={{
                  minHeight: 220,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 3,
                  border: "1px dashed",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  No personnel found.
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {rows.map((person) => (
                  <Grid key={person.id} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 3 }}>
                    <Card
                      sx={{
                        height: "100%",
                        border: "1px solid",
                        borderColor: "divider",
                        boxShadow: "0 14px 28px rgba(24, 33, 52, 0.07)",
                      }}
                    >
                      <Box
                        sx={{
                          px: 2,
                          pt: 2,
                          pb: 1.5,
                          minHeight: 128,
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "space-between",
                          gap: 2,
                          backgroundImage: buildCoverBackground(
                            person.coverImagePath,
                            "linear-gradient(160deg, rgba(198,40,40,0.12) 0%, rgba(255,248,248,1) 45%, rgba(245,245,245,1) 100%)",
                          ),
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <Avatar
                          src={buildImageUrl(person.imagePath)}
                          alt={`${person.firstName} ${person.lastName}`}
                          sx={{
                            width: 68,
                            height: 68,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            border: "4px solid rgba(255,255,255,0.94)",
                            boxShadow: "0 10px 22px rgba(0,0,0,0.14)",
                          }}
                        >
                          {getPersonnelInitials(person.firstName, person.lastName)}
                        </Avatar>
                        <Chip
                          label={person.isActive ? "Active" : "Inactive"}
                          color={person.isActive ? "success" : "default"}
                          size="small"
                          sx={{ fontWeight: 700 }}
                        />
                      </Box>

                      <CardContent sx={{ pb: 1.5 }}>
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                          {person.firstName} {person.lastName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {person.rank}
                        </Typography>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                          <Chip label={formatSectionLabel(person.section)} variant="outlined" size="small" />
                          <Chip
                            label={stationMap.get(person.stationId) ?? `Station #${person.stationId}`}
                            variant="outlined"
                            size="small"
                          />
                          {person.gender && <Chip label={person.gender} variant="outlined" size="small" />}
                        </Stack>

                        <Divider sx={{ my: 1.5 }} />

                        <Stack spacing={1}>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Contact
                            </Typography>
                            <Typography variant="body2">{person.contactNumber || "No contact number"}</Typography>
                          </Box>
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Address
                            </Typography>
                            <Typography variant="body2">{person.address || "No address on file"}</Typography>
                          </Box>
                        </Stack>
                      </CardContent>

                      <CardActions
                        sx={{
                          px: 2.5,
                          pb: 2.5,
                          pt: 0.5,
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        <Button size="small" startIcon={<VisibilityIcon />} onClick={() => onViewProfile?.(person)}>
                          View
                        </Button>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => onEdit?.(person)}>
                            Edit
                          </Button>
                          <Button size="small" variant="outlined" startIcon={<CameraAltIcon />} onClick={() => onFaceRegister?.(person)}>
                            Face
                          </Button>
                        </Stack>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[6, 12, 24]}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
