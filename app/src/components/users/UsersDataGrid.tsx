"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { User, Role, Station } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const DEFAULT_PAGE_SIZE = 50;

interface UsersDataGridProps {
  onEdit?: (user: User) => void;
  onAdd?: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

async function fetchUsers(): Promise<User[]> {
  const res = await apiClient.get<ApiEnvelope<User[]>>("/api/v1/users");
  return res.data.data ?? [];
}

function getRoleChipProps(role: Role) {
  switch (role) {
    case "admin":
      return { label: "Admin", color: "primary" as const };
    case "station_user":
      return { label: "Station User", color: "default" as const };
    case "kiosk":
      return { label: "Kiosk", color: "secondary" as const };
  }
}

export default function UsersDataGrid({
  onEdit,
  onAdd,
  onSuccess,
  onError,
}: UsersDataGridProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const queryClient = useQueryClient();

  // Toggle confirmation dialog state
  const [toggleDialog, setToggleDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({ open: false, user: null });

  // Delete confirmation dialog state
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: User | null;
  }>({ open: false, user: null });

  const [actionLoading, setActionLoading] = useState(false);

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
    queryKey: ["users"],
    queryFn: () => fetchUsers(),
  });

  const allRows = data ?? [];
  const total = allRows.length;
  const rows = allRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  function handlePageChange(_: unknown, newPage: number) {
    setPage(newPage);
  }

  function handleRowsPerPageChange(event: React.ChangeEvent<HTMLInputElement>) {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }

  function openToggleDialog(user: User) {
    setToggleDialog({ open: true, user });
  }

  function closeToggleDialog() {
    setToggleDialog({ open: false, user: null });
  }

  function openDeleteDialog(user: User) {
    setDeleteDialog({ open: true, user });
  }

  function closeDeleteDialog() {
    setDeleteDialog({ open: false, user: null });
  }

  async function handleToggleConfirm() {
    const user = toggleDialog.user;
    if (!user) return;
    setActionLoading(true);
    try {
      await apiClient.patch(`/api/v1/users/${user.id}`, {
        isActive: !user.isActive,
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.(
        user.isActive
          ? `${user.username} has been deactivated.`
          : `${user.username} has been activated.`,
      );
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update user status.";
      onError?.(
        typeof message === "string" ? message : "Failed to update user status.",
      );
    } finally {
      setActionLoading(false);
      closeToggleDialog();
    }
  }

  async function handleDeleteConfirm() {
    const user = deleteDialog.user;
    if (!user) return;
    setActionLoading(true);
    try {
      await apiClient.delete(`/api/v1/users/${user.id}`);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.(`${user.username} has been deleted.`);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to delete user.";
      onError?.(
        typeof message === "string" ? message : "Failed to delete user.",
      );
    } finally {
      setActionLoading(false);
      closeDeleteDialog();
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="h5">Station Accounts</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          aria-label="Add user"
        >
          Add User
        </Button>
      </Stack>

      <Paper>
        {isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress aria-label="Loading users" />
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 3 }}>
            <Typography color="error">
              Failed to load users. Please try again.
            </Typography>
          </Box>
        )}

        {!isLoading && !isError && (
          <>
            <TableContainer>
              <Table aria-label="Users table">
                <TableHead>
                  <TableRow>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Station</TableCell>
                    <TableCell>Status</TableCell>
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
                          No users found.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((user) => {
                      const roleChip = getRoleChipProps(user.role);
                      return (
                        <TableRow key={user.id} hover>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={roleChip.label}
                              color={roleChip.color}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {stationMap.get(user.stationId) ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={user.isActive ? "Active" : "Inactive"}
                              color={user.isActive ? "success" : "error"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack
                              direction="row"
                              spacing={0.5}
                              justifyContent="center"
                              alignItems="center"
                            >
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  aria-label={`Edit ${user.username}`}
                                  onClick={() => onEdit?.(user)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip
                                title={
                                  user.isActive ? "Deactivate" : "Activate"
                                }
                              >
                                <Switch
                                  size="small"
                                  checked={user.isActive}
                                  onChange={() => openToggleDialog(user)}
                                  inputProps={{
                                    "aria-label": `${user.isActive ? "Deactivate" : "Activate"} ${user.username}`,
                                  }}
                                />
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  aria-label={`Delete ${user.username}`}
                                  color="error"
                                  onClick={() => openDeleteDialog(user)}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
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

      {/* Toggle active/inactive confirmation dialog */}
      <Dialog
        open={toggleDialog.open}
        onClose={actionLoading ? undefined : closeToggleDialog}
        aria-labelledby="toggle-dialog-title"
        aria-describedby="toggle-dialog-description"
      >
        <DialogTitle id="toggle-dialog-title">
          {toggleDialog.user?.isActive ? "Deactivate User" : "Activate User"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="toggle-dialog-description">
            {toggleDialog.user?.isActive
              ? `Are you sure you want to deactivate ${toggleDialog.user?.username}? They will no longer be able to log in.`
              : `Are you sure you want to activate ${toggleDialog.user?.username}?`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeToggleDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleToggleConfirm}
            disabled={actionLoading}
            startIcon={
              actionLoading ? <CircularProgress size={16} /> : undefined
            }
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteDialog.open}
        onClose={actionLoading ? undefined : closeDeleteDialog}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete {deleteDialog.user?.username}? This
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={actionLoading}
            startIcon={
              actionLoading ? <CircularProgress size={16} /> : undefined
            }
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
