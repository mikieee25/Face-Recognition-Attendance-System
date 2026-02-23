"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { LocalFireDepartment } from "@mui/icons-material";
import apiClient from "@/lib/api-client";
import type { ApiEnvelope } from "@/types/api";
import type { User } from "@/types/models";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function validate(): boolean {
    let valid = true;
    if (!username.trim()) {
      setUsernameError("Username is required");
      valid = false;
    } else {
      setUsernameError("");
    }
    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else {
      setPasswordError("");
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError("");
    if (!validate()) return;

    setIsLoading(true);
    try {
      await apiClient.post<ApiEnvelope<User>>("/api/v1/auth/login", {
        username,
        password,
      });
      router.push("/");
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: ApiEnvelope };
        message?: string;
      };
      const message =
        axiosErr.response?.data?.message ??
        axiosErr.message ??
        "Login failed. Please try again.";
      setGeneralError(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 4,
          borderRadius: 2,
        }}
      >
        <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate>
          {/* BFP Branding */}
          <Stack alignItems="center" spacing={1}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LocalFireDepartment sx={{ color: "white", fontSize: 36 }} />
            </Box>
            <Typography variant="h5" color="primary" fontWeight={700}>
              BFP Sorsogon
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Attendance Management System
            </Typography>
          </Stack>

          {/* General error */}
          {generalError && (
            <Typography
              variant="body2"
              color="error"
              sx={{
                bgcolor: "error.light",
                color: "error.contrastText",
                px: 2,
                py: 1,
                borderRadius: 1,
                opacity: 0.9,
              }}
            >
              {generalError}
            </Typography>
          )}

          {/* Fields */}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={Boolean(usernameError)}
            helperText={usernameError}
            autoComplete="username"
            autoFocus
            fullWidth
            disabled={isLoading}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={Boolean(passwordError)}
            helperText={passwordError}
            autoComplete="current-password"
            fullWidth
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="contained"
            size="large"
            fullWidth
            disabled={isLoading}
            sx={{ mt: 1 }}
          >
            {isLoading ? "Signing in…" : "Sign In"}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
