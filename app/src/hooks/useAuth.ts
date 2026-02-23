import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api-client";
import type { User } from "@/types/models";
import type { ApiEnvelope } from "@/types/api";

const ME_QUERY_KEY = ["auth", "me"] as const;

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: user = null, isLoading } = useQuery<User | null>({
    queryKey: ME_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<ApiEnvelope<User>>("/api/v1/auth/me");
      return res.data.data ?? null;
    },
    retry: false,
    // Treat a 401 as "not logged in" rather than an error
    throwOnError: false,
  });

  async function login(username: string, password: string): Promise<void> {
    await apiClient.post<ApiEnvelope<User>>("/api/v1/auth/login", {
      username,
      password,
    });
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    router.push("/");
  }

  async function logout(): Promise<void> {
    try {
      await apiClient.post("/api/v1/auth/logout");
    } finally {
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      router.push("/login");
    }
  }

  return { user, login, logout, isLoading };
}
