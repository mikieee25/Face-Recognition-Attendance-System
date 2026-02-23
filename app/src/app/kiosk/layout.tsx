"use client";

import Box from "@mui/material/Box";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const kioskTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#C62828", light: "#EF5350", dark: "#8E0000" },
    secondary: { main: "#1565C0" },
    background: { default: "#0d1b2a", paper: "#1b2e40" },
    text: { primary: "#e8f4fd", secondary: "#7a9cc0" },
    success: { main: "#25a961" },
    info: { main: "#2577cc" },
  },
  typography: {
    fontFamily: ['"Helvetica Neue"', "Inter", "Arial", "sans-serif"].join(","),
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: "none", fontWeight: 700 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
  },
});

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={kioskTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
          {children}
        </Box>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
