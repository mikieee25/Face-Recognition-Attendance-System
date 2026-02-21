import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#C62828", // BFP red — fire department red
      light: "#EF5350",
      dark: "#8E0000",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1565C0", // Complementary navy blue
      light: "#5E92F3",
      dark: "#003C8F",
      contrastText: "#FFFFFF",
    },
    success: {
      main: "#2E7D32", // Green — confirmed / present
      light: "#60AD5E",
      dark: "#005005",
      contrastText: "#FFFFFF",
    },
    warning: {
      main: "#F9A825", // Amber — pending / late
      light: "#FFD95A",
      dark: "#C17900",
      contrastText: "#000000",
    },
    error: {
      main: "#C62828", // Red — rejected / absent
      light: "#EF5350",
      dark: "#8E0000",
      contrastText: "#FFFFFF",
    },
    info: {
      main: "#0277BD", // Blue — informational
      light: "#58A5F0",
      dark: "#004C8C",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F5F5F5",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#212121",
      secondary: "#757575",
    },
  },
  typography: {
    fontFamily: [
      "Inter",
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: {
      fontSize: "2.5rem",
      fontWeight: 700,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: "2rem",
      fontWeight: 700,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: "1.75rem",
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: "1rem",
      fontWeight: 400,
      lineHeight: 1.5,
    },
    body2: {
      fontSize: "0.875rem",
      fontWeight: 400,
      lineHeight: 1.43,
    },
    button: {
      fontWeight: 600,
      textTransform: "none",
    },
  },
  spacing: 8, // MUI default: 8px base unit
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: "8px 16px",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
  },
});

export default theme;
