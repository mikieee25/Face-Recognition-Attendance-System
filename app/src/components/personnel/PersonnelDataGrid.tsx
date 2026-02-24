"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TablePagination from "@mui/material/TablePagination";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import Chip from "@mui/material/Chip";
import EditIcon from "@mui/icons-material/Edit";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { Personnel, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const DEFAULT_PAGE_SIZE = 50;

interface PersonnelDataGridProps {
  onEdit?: (personnel: Personnel) => void;
  onFaceRegister?: (personnel: Personnel) => void;
  onAdd?: () => void;
  onViewProfile?: (personnel: Personnel) => void;
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res =
    await apiClient.get<ApiEnvelope<Personnel[]>>("/api/v1/personnel");
  return res.data.data ?? [];
}

export default function PersonnelDataGrid({
  onEdit,
  onFaceRegister,
  onAdd,
  onViewProfile,
}: PersonnelDataGridProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);

  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiEnvelope<Station[]>>("/api/v1/stations");
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

  const handleRowsPerPageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Personnel</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          aria-label="Add personnel"
        >
          Add Personnel
        </Button>
      </Stack>

      <Paper>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress aria-label="Loading personnel" />
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 3 }}>
            <Typography color="error">
              Failed to load personnel. Please try again.
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && (
          <>
            <TableContainer>
              <Table aria-label="Personnel table">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Rank</TableCell>
                    <TableCell>Station</TableCell>
                    <TableCell>Schedule</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          No personnel found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((person) => (
                      <TableRow key={person.id} hover>
                        <TableCell>{person.id}</TableCell>
                        <TableCell>
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{
                              cursor: "pointer",
                              color: "primary.main",
                              fontWeight: 500,
                              "&:hover": { textDecoration: "underline" },
                            }}
                            onClick={() => onViewProfile?.(person)}
                          >
                            {person.firstName} {person.lastName}
                          </Typography>
                        </TableCell>
                        <TableCell>{person.rank}</TableCell>
                        <TableCell>
                          {stationMap.get(person.stationId) ?? person.stationId}
                        </TableCell>
                        <TableCell>
                          {!person.isActive ? (
                            <Chip
                              label="On Leave"
                              size="small"
                              color="secondary"
                            />
                          ) : person.isShifting ? (
                            <Chip
                              label="Shifting"
                              size="small"
                              color="warning"
                            />
                          ) : (
                            <Chip
                              label="Regular"
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="center"
                          >
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                aria-label={`Edit ${person.firstName} ${person.lastName}`}
                                onClick={() => onEdit?.(person)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Face Registration">
                              <IconButton
                                size="small"
                                aria-label={`Register face for ${person.firstName} ${person.lastName}`}
                                onClick={() => onFaceRegister?.(person)}
                              >
                                <CameraAltIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={total}
              page={page}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[25, 50, 100]}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
