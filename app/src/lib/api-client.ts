import axios, { AxiosRequestConfig } from "axios";

// Extend AxiosRequestConfig to support the retry flag
interface RetryableRequestConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001",
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: RetryableRequestConfig = error.config;

    // Only attempt refresh on 401 and if we haven't already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes("/api/v1/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        await apiClient.post("/api/v1/auth/refresh");
        return apiClient(originalRequest);
      } catch {
        // Refresh failed — redirect to login
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
    }

    // If the failing request IS the refresh endpoint, redirect to login
    if (originalRequest.url?.includes("/api/v1/auth/refresh")) {
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
