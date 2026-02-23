import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import WebcamCapture from "@/components/attendance/WebcamCapture";

export default function AttendanceCapturePage() {
  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Attendance Capture
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Position your face in front of the camera and click Capture to record
        your attendance.
      </Typography>
      <WebcamCapture />
    </Box>
  );
}
