"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
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
      // Highlight both fields on failed login
      setUsernameError(" ");
      setPasswordError(" ");
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
        position: "relative",
        overflow: "hidden",
        p: 2,
      }}
    >
      {/* Background image with blur + darken */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/station.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(4px) brightness(0.6)",
          transform: "scale(1.05)",
          zIndex: 0,
        }}
      />

      <Paper
        elevation={6}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 4,
          borderRadius: 2,
          position: "relative",
          zIndex: 1,
        }}
      >
        <Stack spacing={3} component="form" onSubmit={handleSubmit} noValidate>
          {/* BFP Branding with logo */}
          <Stack alignItems="center" spacing={1}>
            <Image
              src="/bfp-logo.png"
              alt="BFP Logo"
              width={72}
              height={72}
              priority
              style={{ objectFit: "contain" }}
            />
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
            onChange={(e) => {
              setUsername(e.target.value);
              if (usernameError) setUsernameError("");
              if (generalError) setGeneralError("");
            }}
            error={Boolean(usernameError)}
            helperText={usernameError?.trim() || undefined}
            autoComplete="username"
            autoFocus
            fullWidth
            disabled={isLoading}
          />

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError("");
              if (generalError) setGeneralError("");
            }}
            error={Boolean(passwordError)}
            helperText={passwordError?.trim() || undefined}
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
