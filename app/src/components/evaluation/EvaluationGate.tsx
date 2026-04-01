"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Image from "next/image";
import LoginIcon from "@mui/icons-material/Login";

import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { User } from "@/types/models";

interface Props {
  onAuthenticated: () => void;
}

export default function EvaluationGate({ onAuthenticated }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiClient.post<ApiEnvelope<{ user: User }>>("/api/v1/auth/login", {
        username: username.trim(),
        password: password.trim(),
      });
      onAuthenticated();
    } catch {
      setError("Invalid credentials. Please use the credentials provided to you by the system administrator.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 72px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 2, md: 4 },
        background: "radial-gradient(ellipse at top, #1b2e40 0%, #0d1b2a 60%)",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 460 }}>
        {/* Logo */}
        <Stack alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #8E0000, #C62828)",
              boxShadow: "0 8px 32px rgba(198,40,40,0.4)",
            }}
          >
            <Image src="/bfp-logo.png" alt="BFP Logo" width={56} height={56} style={{ objectFit: "contain", filter: "brightness(0) invert(1)" }} />
          </Box>
          <Box textAlign="center">
            <Typography variant="h5" fontWeight={800} color="#e8f4fd">
              Evaluator Access
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Sign in to explore the system and complete your evaluation
            </Typography>
          </Box>
        </Stack>



        {/* Login Form */}
        <Paper
          component="form"
          onSubmit={handleLogin}
          sx={{
            p: { xs: 3, md: 4 },
            bgcolor: "#1b2e40",
            border: "1px solid #2e4460",
            borderRadius: 3,
          }}
        >
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              disabled={loading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#e8f4fd",
                  "& fieldset": { borderColor: "#2e4460" },
                  "&:hover fieldset": { borderColor: "#7a9cc0" },
                  "&.Mui-focused fieldset": { borderColor: "#C62828" },
                },
                "& .MuiInputLabel-root": { color: "#7a9cc0" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#C62828" },
              }}
            />

            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#e8f4fd",
                  "& fieldset": { borderColor: "#2e4460" },
                  "&:hover fieldset": { borderColor: "#7a9cc0" },
                  "&.Mui-focused fieldset": { borderColor: "#C62828" },
                },
                "& .MuiInputLabel-root": { color: "#7a9cc0" },
                "& .MuiInputLabel-root.Mui-focused": { color: "#C62828" },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ bgcolor: "rgba(220,53,69,0.12)" }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <LoginIcon />}
              sx={{
                bgcolor: "#C62828",
                "&:hover": { bgcolor: "#8E0000" },
                "&:disabled": { bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" },
                fontWeight: 800,
                py: 1.5,
                boxShadow: "0 4px 16px rgba(198,40,40,0.3)",
              }}
            >
              {loading ? "Signing in…" : "Sign In & Start Evaluation"}
            </Button>

            <Divider sx={{ borderColor: "#2e4460" }} />

            <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ lineHeight: 1.6 }}>
              This portal is for evaluation purposes only. Your session will be used solely to demonstrate
              system features. All test data may be reviewed or cleared by the administrator.
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
