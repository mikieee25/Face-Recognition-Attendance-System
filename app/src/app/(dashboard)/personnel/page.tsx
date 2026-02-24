import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import apiClient from "@/lib/api-client";
import PersonnelPageClient from "@/components/personnel/PersonnelPageClient";

export default async function PersonnelPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["personnel", { page: 0, limit: 50 }],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/personnel", {
        params: { page: 1, limit: 50 },
      });
      return res.data.data;
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PersonnelPageClient />
    </HydrationBoundary>
  );
}
