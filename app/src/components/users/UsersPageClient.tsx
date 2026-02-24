"use client";

import { useState } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import UsersDataGrid from "@/components/users/UsersDataGrid";
import UserForm from "@/components/users/UserForm";
import type { User } from "@/types/models";

export default function UsersPageClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | undefined>(undefined);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  function handleAdd() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function handleEdit(user: User) {
    setEditTarget(user);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditTarget(undefined);
  }

  function showToast(message: string, severity: "success" | "error") {
    setToast({ open: true, message, severity });
  }

  function handleToastClose() {
    setToast((prev) => ({ ...prev, open: false }));
  }

  return (
    <Box sx={{ p: 3 }}>
      <UsersDataGrid
        onAdd={handleAdd}
        onEdit={handleEdit}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      <UserForm
        open={formOpen}
        onClose={handleClose}
        user={editTarget}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleToastClose}
          severity={toast.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
