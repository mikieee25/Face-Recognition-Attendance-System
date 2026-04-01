import axios, { AxiosRequestConfig } from "axios";

// Extend AxiosRequestConfig to support the retry flag
interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  // Use same-origin by default so auth cookies are scoped to the app domain.
  // Priority: NEXT_PUBLIC_API_BASE_URL → NEXT_PUBLIC_API_URL → same-origin
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "",
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: RetryableRequestConfig = error.config;
    const isEvaluation =
      typeof window !== "undefined" &&
      window.location.pathname.startsWith("/evaluation");

    // Only attempt refresh on 401 and if we haven't already retried
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/api/v1/auth/refresh")) {
      originalRequest._retry = true;

      try {
        await apiClient.post("/api/v1/auth/refresh");
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — redirect to login (unless we're in evaluation mode)
        if (typeof window !== "undefined" && !isEvaluation) {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    // If the failing request IS the refresh endpoint, redirect to login
    if (originalRequest.url?.includes("/api/v1/auth/refresh") && !isEvaluation) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
