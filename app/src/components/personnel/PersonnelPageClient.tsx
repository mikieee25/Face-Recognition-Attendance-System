"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import PersonnelDataGrid from "@/components/personnel/PersonnelDataGrid";
import PersonnelForm from "@/components/personnel/PersonnelForm";
import FaceRegistrationDialog from "@/components/personnel/FaceRegistrationDialog";
import PersonnelProfileModal from "@/components/personnel/PersonnelProfileModal";
import type { Personnel } from "@/types/models";

export default function PersonnelPageClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Personnel | undefined>(
    undefined,
  );
  const [faceDialogOpen, setFaceDialogOpen] = useState(false);
  const [faceTarget, setFaceTarget] = useState<Personnel | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTarget, setProfileTarget] = useState<Personnel | null>(null);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  function handleAdd() {
    setEditTarget(undefined);
    setFormOpen(true);
  }

  function handleEdit(personnel: Personnel) {
    setEditTarget(personnel);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditTarget(undefined);
  }

  function handleFaceRegister(personnel: Personnel) {
    setFaceTarget(personnel);
    setFaceDialogOpen(true);
  }

  function handleFaceDialogClose() {
    setFaceDialogOpen(false);
    setFaceTarget(null);
  }

  function handleViewProfile(personnel: Personnel) {
    setProfileTarget(personnel);
    setProfileOpen(true);
  }

  function showToast(message: string, severity: "success" | "error") {
    setToast({ open: true, message, severity });
  }

  function handleToastClose() {
    setToast((prev) => ({ ...prev, open: false }));
  }

  return (
    <Box sx={{ p: 3 }}>
      <PersonnelDataGrid
        onAdd={handleAdd}
        onEdit={handleEdit}
        onFaceRegister={handleFaceRegister}
        onViewProfile={handleViewProfile}
      />

      <PersonnelForm
        open={formOpen}
        onClose={handleClose}
        personnel={editTarget}
        onSuccess={(msg) => showToast(msg, "success")}
        onError={(msg) => showToast(msg, "error")}
      />

      <FaceRegistrationDialog
        open={faceDialogOpen}
        onClose={handleFaceDialogClose}
        personnel={faceTarget}
      />

      <PersonnelProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        personnel={profileTarget}
        onFaceRegister={(p) => {
          setProfileOpen(false);
          handleFaceRegister(p);
        }}
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
