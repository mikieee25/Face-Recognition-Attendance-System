# AGENT_INSTRUCTIONS - Frontend (Next.js + MUI) and Backend (Flask API)

This document contains clear, actionable instructions for the agent implementing the Next.js frontend and Python (Flask) backend for the BFP Attendance system. Focus: consistent, clean UI using Material-UI (MUI), centralized types and theme, server/client separation (Next.js App Router), TanStack Query for data fetching with SSR hydration, and concrete backend API route shapes + validation guidance.

Table of contents
- Goals & constraints
- Frontend conventions
- Centralized types & theme
- UI component patterns (MUI rules)
- Data fetching & TanStack Query (SSR + hydration)
- Folder structure (recommended)
- Backend API conventions (Flask)
- Example backend routes (with request/response shapes)
- Integration checklist

---

Goals & constraints
- Produce a clean, consistent UI using MUI only (Box, Stack, Typography, etc.). Avoid raw HTML tags in components.
- Centralize design tokens (colors, spacing, typography) in a single `theme` file. Always use `theme.spacing()` for spacing.
- Centralize TypeScript types for all shared models and API responses (one source of truth).
- Use Next.js App Router (Server Components by default). Mark interactive components or hooks with `'use client'`.
- Use TanStack Query for data fetching and caching. Support SSR by using hydration boundaries and server-provided initial data.
- Use `url`/`href` navigation patterns (links) instead of `onClick` navigation where possible.
- Accessibility: follow MUI and ARIA best practices.
- Backend: Flask API with JSON contracts, validation using Marshmallow/Pydantic, and JWT auth (httpOnly cookie recommended).

---

Frontend conventions

Naming & structure
- Directories: PascalCase for top-level components and directories (e.g., `Components/`, `Hooks/`).
- Files: PascalCase for components (`PersonnelList.tsx`), camelCase for hooks (`usePersonnel.ts`).
- Types: `types/` directory with `models.ts`, `api.ts`.
- Keep components small and reusable. Prefer composition over inheritance.

Styling & MUI
- Use MUI components only for layout and typography (`Box`, `Stack`, `Typography`, `Button`, `Badge`, `BadgeDisplay` patterns).
- Spacing use: `sx={(theme) => ({ p: theme.spacing(2), gap: theme.spacing(1) })}`.
- Typography: use MUI `Typography` variants (`h1`, `h2`, `body1`, `body2`). Do not inline custom font-size values.
- Responsive values: always provide responsive props, e.g., `sx={{ width: { xs: '100%', md: 640 } }}`.
- Keep color tokens in theme palette, not hard-coded.

UI composition patterns (examples)
- Layouts: app-level `app/layout.tsx` (server component) contains global providers (ThemeProvider, QueryClientProvider hydration boundary).
- Page-level: server components fetch data where possible, then pass to client components that use hooks for interactivity.
- Interactive widgets (camera, capture) are client components (`'use client'`) and use `useRef`, `useState`, and custom hooks.

Example Client Component style (use this pattern)
```/dev/null/frontend/src/components/AttendanceCapture.tsx#L1-120
'use client';
import React, { useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import { useAttendanceCapture } from "../hooks/useAttendanceCapture";

export default function AttendanceCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { startCamera, capture, isProcessing } = useAttendanceCapture(videoRef);

  return (
    <Box sx={(theme) => ({ p: theme.spacing(2), display: "flex", flexDirection: "column", gap: theme.spacing(2) })}>
      <Typography variant="h5">Attendance Capture</Typography>
      <Box sx={{ width: { xs: '100%', md: 640 }, height: 480, bgcolor: "grey.900" }}>
        <video ref={videoRef} autoPlay style={{ width: '100%', height: '100%' }} />
      </Box>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Button variant="contained" onClick={startCamera}>Start Camera</Button>
        <Button variant="contained" color="success" startIcon={<CameraAltIcon />} onClick={capture} disabled={isProcessing}>
          {isProcessing ? "Processing..." : "Capture"}
        </Button>
      </Box>
    </Box>
  );
}
```

Centralized types & theme

- Create `frontend/src/types/models.ts` with shared model shapes.
- Create `frontend/src/lib/api-types.ts` for API response envelope.
- Create `frontend/src/theme.ts` (single source of truth for MUI theme).

Theme example
```/dev/null/frontend/src/theme.ts#L1-120
import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: { main: "#0d47a1" },
    secondary: { main: "#ff6f00" },
    background: { default: "#f7f7fb" },
  },
  spacing: 8, // base spacing unit (theme.spacing(1) === 8px)
  typography: {
    h1: { fontSize: "2rem" },
    h2: { fontSize: "1.5rem" },
    body1: { fontSize: "1rem" },
  },
});

export default theme;
```

Centralized API client & query client
- `lib/api-client.ts` — Axios instance: baseURL from env, `withCredentials: true`.
- `lib/query-client.ts` — TanStack Query client config and defaults.

Api client example
```/dev/null/frontend/src/lib/api-client.ts#L1-80
import axios from "axios";

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
  withCredentials: true, // recommended for httpOnly cookie auth
  headers: {
    "Content-Type": "application/json",
  },
});
```

Query client example
```/dev/null/frontend/src/lib/query-client.ts#L1-80
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
});
```

TanStack Query + SSR hydration
- Server components may fetch data and pass initial data to client via props.
- Use `HydrationBoundary` or `dehydrate`/`Hydrate` pattern in the top-level provider.
- Always use the same query keys in frontend hooks to enable hydration.

Example hook pattern
```/dev/null/frontend/src/hooks/usePersonnel.ts#L1-120
'use client';
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/api-client";
import { Personnel } from "../types/models";

export function usePersonnel() {
  return useQuery<Personnel[]>({
    queryKey: ["personnel"],
    queryFn: async () => {
      const res = await apiClient.get("/personnel");
      return res.data.personnel;
    },
  });
}
```

Frontend best practices
- Keep Server Components for data fetching and non-interactive UI.
- Keep interactive behavior in client components and hooks (marked `'use client'`).
- Use MUI `sx` functions with theme callbacks for spacing and breakpoints.
- Use `Link` component (Next.js) or `<a href>` for navigation; prefer `href` over `onClick`.
- Centralize icons and small UI primitives in `Components/Shared/`.

---

Backend API conventions (Flask)

General
- Use a versioned API base path: `/api/v1/...`.
- Return a consistent JSON envelope:
  ```json
  { "success": true, "data": {...}, "message": "optional" }
  ```
- Use Marshmallow or Pydantic (Flask-compatible) for input validation (DTO-like behavior).
- Use JWT tokens (Flask-JWT-Extended). Store refresh token in httpOnly cookie or use httpOnly cookie for access token and CSRF tokens as needed.
- Keep face-recognition logic in `face_rec_module/`; backend calls it and returns recognized personnel id + confidence.

API route shapes (contract sketches)
- Auth
  - POST /api/v1/auth/login
    - body: { username: string, password: string }
    - success: { access_token: string, user: UserSummary }
  - POST /api/v1/auth/refresh
  - GET /api/v1/auth/me
- Personnel
  - GET /api/v1/personnel
    - returns: { personnel: Personnel[] }
  - POST /api/v1/personnel
    - body: PersonnelCreateDTO
- Attendance
  - POST /api/v1/attendance/capture
    - body (preferred): { main_image: base64string } or form-data file
    - returns: { success: boolean, personnel_id?, confidence?, status?, message? }
  - POST /api/v1/attendance/manual
- Health
  - GET /api/v1/health

Backend example: auth route
```/dev/null/backend/api/auth.py#L1-160
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from models import User
from werkzeug.security import check_password_hash

auth_bp = Blueprint("auth", __name__, url_prefix="/api/v1/auth")

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data.get("username")
    password = data.get("password")
    user = User.query.filter((User.username == username) | (User.email == username)).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"success": False, "message": "Invalid credentials"}), 401
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    return jsonify({"success": True, "access_token": access_token, "refresh_token": refresh_token, "user": user.to_dict()})
```

Backend example: attendance capture route
```/dev/null/backend/api/attendance.py#L1-200
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from face_rec_module.face_service import process_base64_image, recognize_face, process_attendance

attendance_bp = Blueprint("attendance", __name__, url_prefix="/api/v1/attendance")

@attendance_bp.route("/capture", methods=["POST"])
@jwt_required()
def capture_attendance():
    data = request.get_json() or {}
    image_data = data.get("main_image") or data.get("image")
    if not image_data:
        return jsonify({"success": False, "message": "No image provided"}), 400
    embedding, metadata, tmp_path = process_base64_image(image_data)
    if embedding is None:
        return jsonify({"success": False, "message": "No face detected"}), 400
    # Load station-specific database and perform recognition
    user_id = get_jwt_identity()
    recognized_id, confidence = recognize_face(embedding, load_face_database_for_user(user_id))
    if recognized_id is None:
        return jsonify({"success": False, "message": "Face not recognized"}), 400
    result = process_attendance(recognized_id, confidence, image_data)
    return jsonify({"success": True, "data": result})
```

Validation & DTOs (recommended)
- Use Marshmallow schemas or Pydantic models for request validation and serialization.
- Example: `PersonnelCreateSchema` with required fields and validators.

Security
- Protect endpoints with `@jwt_required()`.
- Validate all image uploads; enforce size limit (e.g., 5-10MB).
- Use secrets manager for `SECRET_KEY` and DB credentials.
- Rate-limit capture endpoints to prevent abuse.

---

Integration checklist (what the agent must deliver)
- [ ] Frontend Next.js project with centralized `theme.ts`, `types/`, `lib/api-client.ts`, `lib/query-client.ts`.
- [ ] MUI-based component library (shared primitives) and consistent usage of `theme.spacing()`.
- [ ] TanStack Query hooks for all major resources (`usePersonnel`, `useAttendance`, `useDashboardStats`) with SSR hydration support.
- [ ] `AttendanceCapture` client component that uses webcam, captures base64 image, posts to `/api/v1/attendance/capture`.
- [ ] Backend Flask API with versioned routes (see shapes above), JWT auth, and Marshmallow/Pydantic validation.
- [ ] Health endpoint `/api/v1/health`.
- [ ] Example Postman collection or OpenAPI/Swagger describing API endpoints and request/response contracts.
- [ ] README or short developer intro explaining how to run frontend (dev) and backend (venv / Docker).

---

Developer tips and rules (follow strictly)
- MUI only for UI; no raw HTML for main UI elements.
- All spacing must come from `theme.spacing()`.
- Typography must use MUI `Typography` variants.
- Use PascalCase for component filenames and directories, camelCase for hooks and utility functions.
- Use `url` / `href` for navigation (Next.js Link), avoid `onClick` where navigation is intended.
- Keep face recognition strictly in backend; frontend only sends images.
- Ensure API shape equals contract exactly; document changes in API spec and update centralized types.

---

If you need sample Postman or Swagger output or specific component templates, I can produce those next (specify which module to scaffold first: Auth, Personnel, or Attendance).