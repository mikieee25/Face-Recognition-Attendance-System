"use client";

import { useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import apiClient from "@/lib/api-client";
import PendingApprovalCard from "@/components/pending/PendingApprovalCard";
import type { ApiEnvelope } from "@/types/api";
import type { PendingApproval, Personnel } from "@/types/models";

// ─── API fetchers ─────────────────────────────────────────────────────────────

async function fetchPending(): Promise<PendingApproval[]> {
  const res =
    await apiClient.get<ApiEnvelope<PendingApproval[]>>("/api/v1/pending");
  return res.data.data ?? [];
}

async function fetchPersonnel(): Promise<Personnel[]> {
  const res =
    await apiClient.get<ApiEnvelope<Personnel[] | { items: Personnel[] }>>(
      "/api/v1/personnel",
    );
  const payload = res.data.data;
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return (payload as { items: Personnel[] }).items ?? [];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendingApprovalsPage() {
  const {
    data: pendingList = [],
    isLoading: pendingLoading,
    isError: pendingError,
  } = useQuery({
    queryKey: ["pending"],
    queryFn: fetchPending,
  });

  const { data: personnelList = [] } = useQuery({
    queryKey: ["personnel", "list"],
    queryFn: fetchPersonnel,
  });

  // Build a lookup map for quick name resolution
  const personnelMap = new Map<number, Personnel>(
    personnelList.map((p) => [p.id, p]),
  );

  const getPersonnelName = (personnelId: number): string | undefined => {
    const p = personnelMap.get(personnelId);
    if (!p) return undefined;
    return `${p.rank} ${p.firstName} ${p.lastName}`.trim();
  };

  const count = pendingList.length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: 3 }}>
      {/* Page title with pending count */}
      <Typography variant="h5" sx={{ mb: 3 }}>
        Pending Approvals
        {!pendingLoading && count > 0 && (
          <Typography
            component="span"
            variant="body1"
            color="text.secondary"
            sx={{ ml: 1 }}
          >
            ({count} {count === 1 ? "record" : "records"})
          </Typography>
        )}
      </Typography>

      {/* Loading state */}
      {pendingLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress aria-label="Loading pending approvals" />
        </Box>
      )}

      {/* Error state */}
      {pendingError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load pending approvals. Please try again.
        </Alert>
      )}

      {/* Empty state */}
      {!pendingLoading && !pendingError && count === 0 && (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            No pending approvals at this time.
          </Typography>
        </Box>
      )}

      {/* Cards grid */}
      {!pendingLoading && !pendingError && count > 0 && (
        <Grid container spacing={3}>
          {pendingList.map((record) => (
            <Grid key={record.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
              <PendingApprovalCard
                record={record}
                personnelName={getPersonnelName(record.personnelId)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
