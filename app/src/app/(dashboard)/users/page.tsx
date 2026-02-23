import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import apiClient from "@/lib/api-client";
import UsersPageClient from "@/components/users/UsersPageClient";

export default async function UsersPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["users", { page: 0, limit: 50 }],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/users", {
        params: { page: 1, limit: 50 },
      });
      return res.data.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersPageClient />
    </HydrationBoundary>
  );
}
