import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ManualEntryForm from "@/components/attendance/ManualEntryForm";

export default function ManualAttendancePage() {
  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Manual Attendance Entry
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a personnel member, attendance type, date, and time to manually
        record an attendance entry.
      </Typography>
      <ManualEntryForm />
    </Box>
  );
}
