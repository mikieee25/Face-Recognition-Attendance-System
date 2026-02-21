# Next.js Migration Guide - BFP Attendance System

## Executive Summary

**YES, kaya i-rework ang system!** The current Flask-based application can be successfully migrated to a modern Next.js frontend + Flask API backend architecture. This guide provides a complete roadmap for the migration.

---

## Table of Contents

- [Current Architecture](#current-architecture)
- [Proposed Architecture](#proposed-architecture)
- [Feasibility Assessment](#feasibility-assessment)
- [Migration Benefits](#migration-benefits)
- [Migration Challenges](#migration-challenges)
- [Project Structure](#project-structure)
- [Step-by-Step Migration Plan](#step-by-step-migration-plan)
- [Code Examples](#code-examples)
- [API Contract](#api-contract)
- [Deployment Strategy](#deployment-strategy)
- [Timeline Estimate](#timeline-estimate)

---

## Current Architecture

### Technology Stack

```
┌─────────────────────────────────────┐
│        Flask Monolith (SSR)         │
├─────────────────────────────────────┤
│ • Jinja2 Templates (HTML)           │
│ • Bootstrap 5 + jQuery              │
│ • Chart.js + DataTables             │
│ • Flask-Login (Sessions)            │
│ • SQLAlchemy ORM                    │
│ • MySQL Database                    │
│ • Face Recognition (OpenCV/YOLO)    │
└─────────────────────────────────────┘
```

### Current File Structure

```
BFPAttendance/
├── app.py                    # Flask app factory
├── models.py                 # SQLAlchemy models
├── routes/                   # Blueprint routes
│   ├── auth.py              # Login/logout/register
│   ├── dashboard.py         # Dashboard views
│   ├── personnel.py         # Personnel CRUD
│   ├── attendance.py        # Attendance management
│   ├── reports.py           # Report generation
│   ├── pending.py           # Approval workflow
│   ├── profile.py           # User profile
│   ├── kiosk.py             # Kiosk terminal
│   └── api.py               # JSON API endpoints (limited)
├── templates/               # Jinja2 HTML templates
├── static/                  # CSS, JS, images
└── face_rec_module/         # Face recognition logic
```

### Key Observations

1. **Mixed concerns**: HTML rendering and business logic are coupled
2. **Limited API endpoints**: Most routes return HTML, not JSON
3. **Session-based auth**: Flask-Login with server-side sessions
4. **Heavy server rendering**: All UI is generated server-side
5. **Face recognition is stateful**: Models loaded in memory on backend

---

## Proposed Architecture

### New Technology Stack

```
┌──────────────────────────────────────────────────────────────┐
│                     Next.js Frontend (SSR/CSR)                │
├──────────────────────────────────────────────────────────────┤
│ • React 18+ with TypeScript                                   │
│ • Next.js App Router (Server Components + Client Components) │
│ • TanStack Query (Data fetching + caching)                   │
│ • Material-UI (MUI) - following your custom rules            │
│ • Chart.js / Recharts (visualizations)                       │
│ • Next-Auth or custom JWT auth                               │
│ • Axios or Fetch API (HTTP client)                           │
└──────────────────────────────────────────────────────────────┘
                              ↕ REST API (JSON)
┌──────────────────────────────────────────────────────────────┐
│                    Flask API Backend                          │
├──────────────────────────────────────────────────────────────┤
│ • Flask with Flask-RESTX or Flask-RESTful                    │
│ • JWT Authentication (Flask-JWT-Extended)                    │
│ • SQLAlchemy ORM                                             │
│ • MySQL Database                                             │
│ • Face Recognition Module (unchanged)                        │
│ • CORS enabled for Next.js frontend                          │
└──────────────────────────────────────────────────────────────┘
```

### New Project Structure

```
BFPAttendance/
├── frontend/                        # Next.js application
│   ├── app/                         # App Router
│   │   ├── (auth)/                  # Auth group
│   │   │   ├── login/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/             # Protected group
│   │   │   ├── dashboard/
│   │   │   ├── personnel/
│   │   │   ├── attendance/
│   │   │   ├── reports/
│   │   │   ├── pending/
│   │   │   ├── kiosk/
│   │   │   └── layout.tsx
│   │   ├── api/                     # Next.js API routes (optional)
│   │   └── layout.tsx
│   ├── components/                  # React components
│   │   ├── common/                  # Shared components
│   │   ├── dashboard/
│   │   ├── personnel/
│   │   └── attendance/
│   ├── lib/                         # Utilities
│   │   ├── api-client.ts            # Axios instance
│   │   ├── auth.ts                  # Auth helpers
│   │   └── query-client.ts          # TanStack Query setup
│   ├── hooks/                       # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePersonnel.ts
│   │   └── useAttendance.ts
│   ├── types/                       # TypeScript types
│   │   ├── models.ts                # Mirror backend models
│   │   └── api.ts                   # API response types
│   ├── public/                      # Static assets
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.js
│
├── backend/                         # Flask API
│   ├── api/                         # API blueprints
│   │   ├── __init__.py
│   │   ├── auth.py                  # JWT auth endpoints
│   │   ├── personnel.py             # Personnel CRUD API
│   │   ├── attendance.py            # Attendance API
│   │   ├── reports.py               # Reports API
│   │   ├── dashboard.py             # Dashboard stats API
│   │   ├── pending.py               # Approval API
│   │   └── face.py                  # Face recognition API
│   ├── models/                      # SQLAlchemy models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── personnel.py
│   │   ├── attendance.py
│   │   └── enums.py
│   ├── services/                    # Business logic
│   │   ├── auth_service.py
│   │   ├── personnel_service.py
│   │   ├── attendance_service.py
│   │   └── face_service.py
│   ├── utils/                       # Utilities
│   │   ├── auth.py                  # JWT helpers
│   │   ├── validators.py
│   │   └── decorators.py
│   ├── face_rec_module/             # Face recognition (unchanged)
│   │   ├── face_service.py
│   │   └── yolov11n-face.pt
│   ├── static/                      # Uploaded files only
│   │   └── uploads/
│   ├── app.py                       # Flask app factory
│   ├── config.py                    # Configuration
│   ├── requirements.txt
│   └── .env
│
├── docker-compose.yml               # Local development setup
├── .gitignore
└── README.md
```

---

## Feasibility Assessment

### ✅ What Makes This Migration Feasible

1. **Existing API endpoints**: You already have `/api/` routes that return JSON
2. **Clean separation**: Face recognition logic is already in a separate module
3. **Well-structured models**: SQLAlchemy models are easy to expose via REST API
4. **Stateless operations**: Most operations (CRUD) don't require server-side state
5. **Modern Python support**: Flask has excellent REST API frameworks (Flask-RESTX)

### ⚠️ Challenges to Address

1. **Authentication migration**: Flask-Login → JWT tokens
2. **File uploads**: Handling face images and attendance photos via API
3. **Session management**: Converting server-side sessions to client-side tokens
4. **Real-time features**: Dashboard clock and live updates need websockets or polling
5. **Face recognition**: Large models need to stay on backend (OK - not a blocker)

### 🎯 Effort Estimate

| Component | Complexity | Time Estimate |
|-----------|-----------|---------------|
| Backend API refactor | Medium | 2-3 weeks |
| Frontend setup | Low | 1 week |
| Auth migration | Medium | 1 week |
| Personnel module | Low | 1 week |
| Attendance module | Medium | 2 weeks |
| Reports module | Medium | 1-2 weeks |
| Dashboard | Low-Medium | 1 week |
| Testing & debugging | High | 2 weeks |
| **Total** | | **10-13 weeks** |

---

## Migration Benefits

### For Development

- **Better separation of concerns**: Frontend and backend are independent
- **Parallel development**: Frontend and backend teams can work simultaneously
- **Modern tooling**: TypeScript, hot reload, better DX
- **Component reusability**: React components can be shared across modules
- **Type safety**: TypeScript + Python type hints = fewer runtime errors
- **Easier testing**: Unit test React components and API endpoints separately

### For Users

- **Faster page transitions**: Client-side routing (no full page reloads)
- **Better UX**: Loading states, optimistic updates, smooth animations
- **Offline capabilities**: Progressive Web App (PWA) support
- **Mobile-friendly**: Responsive React components with MUI
- **Real-time updates**: Easier to implement websockets or polling

### For Deployment

- **Scalability**: Frontend and backend can scale independently
- **CDN support**: Static Next.js build can be served via CDN (faster)
- **Multiple frontends**: Same API can serve web, mobile app, or kiosk
- **Easier DevOps**: Docker containers for each service

---

## Migration Challenges

### 1. Authentication

**Current**: Flask-Login with server-side sessions

**New**: JWT tokens stored in httpOnly cookies or localStorage

**Solution**:
- Backend: Flask-JWT-Extended for token generation/validation
- Frontend: Store token in httpOnly cookie (more secure than localStorage)
- Middleware: Next.js middleware to check token validity

### 2. File Uploads

**Current**: Flask handles multipart form data directly

**New**: API accepts multipart/form-data or base64 encoded images

**Solution**:
- Use `multipart/form-data` for face registration (multiple images)
- Use base64 for attendance capture (webcam snapshots)
- Backend processes files the same way, just different input format

### 3. Real-Time Dashboard

**Current**: JavaScript polls `/api/time` every second

**New**: Same approach, or use Server-Sent Events (SSE)

**Solution**:
- Option 1: TanStack Query with short refetch interval
- Option 2: WebSocket connection for real-time updates (overkill for now)
- Option 3: Next.js Server Components with streaming (experimental)

### 4. Face Recognition

**Current**: Models loaded in Flask memory, processed synchronously

**New**: Same, but API endpoint must handle CORS and larger payloads

**Solution**:
- Face recognition stays 100% on backend
- Frontend sends base64 image via POST
- Backend processes and returns JSON response
- No changes to face_rec_module needed

---

## Step-by-Step Migration Plan

### Phase 1: Preparation (Week 1)

1. **Audit current API endpoints**
   - Document all existing `/api/` routes
   - Identify what's missing (most CRUD operations return HTML)
   - Define complete API contract (see API Contract section below)

2. **Set up project structure**
   - Create `frontend/` and `backend/` directories
   - Initialize Next.js app with TypeScript
   - Refactor Flask app to `backend/` directory

3. **Database backup**
   - Full backup of production database
   - Set up separate dev database for testing

### Phase 2: Backend API (Weeks 2-4)

1. **Install dependencies**
   ```bash
   pip install flask-jwt-extended flask-cors flask-restx marshmallow
   ```

2. **Create API blueprints**
   - `/api/v1/auth` - Login, logout, refresh token, me
   - `/api/v1/personnel` - Full CRUD + face registration
   - `/api/v1/attendance` - Full CRUD + capture
   - `/api/v1/reports` - Generate and export reports
   - `/api/v1/dashboard` - Statistics and recent activity
   - `/api/v1/pending` - Approval workflow
   - `/api/v1/users` - User management (admin only)

3. **Implement JWT authentication**
   - Replace Flask-Login with Flask-JWT-Extended
   - Create access tokens (15 min expiry) and refresh tokens (7 days)
   - Add decorators: `@jwt_required()`, `@admin_required`, `@station_required`

4. **Enable CORS**
   ```python
   from flask_cors import CORS
   CORS(app, supports_credentials=True, origins=["http://localhost:3000"])
   ```

5. **Migrate existing routes to API**
   - Convert all HTML-returning routes to JSON responses
   - Standardize response format:
     ```json
     {
       "success": true,
       "data": {...},
       "message": "Operation successful"
     }
     ```

6. **Test API with Postman/Insomnia**

### Phase 3: Frontend Setup (Week 5)

1. **Initialize Next.js**
   ```bash
   npx create-next-app@latest frontend --typescript --app --tailwind --eslint
   cd frontend
   npm install @mui/material @emotion/react @emotion/styled
   npm install @tanstack/react-query axios
   npm install react-hook-form zod date-fns chart.js react-chartjs-2
   ```

2. **Configure API client**
   ```typescript
   // lib/api-client.ts
   import axios from 'axios';
   
   export const apiClient = axios.create({
     baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1',
     withCredentials: true,
   });
   
   // Add interceptors for auth token
   apiClient.interceptors.request.use((config) => {
     const token = localStorage.getItem('access_token');
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

3. **Set up TanStack Query**
   ```typescript
   // lib/query-client.ts
   import { QueryClient } from '@tanstack/react-query';
   
   export const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         refetchOnWindowFocus: false,
       },
     },
   });
   ```

4. **Create TypeScript types**
   - Mirror backend models in `types/models.ts`
   - Define API response types in `types/api.ts`

### Phase 4: Authentication (Week 6)

1. **Login page**
   ```typescript
   // app/(auth)/login/page.tsx
   'use client';
   
   import { useAuth } from '@/hooks/useAuth';
   
   export default function LoginPage() {
     const { login, isLoading } = useAuth();
     
     const handleSubmit = async (e: FormEvent) => {
       e.preventDefault();
       await login(username, password);
     };
     
     return (
       // Login form with MUI components
     );
   }
   ```

2. **Auth hook**
   ```typescript
   // hooks/useAuth.ts
   import { useMutation } from '@tanstack/react-query';
   import { apiClient } from '@/lib/api-client';
   
   export function useAuth() {
     const loginMutation = useMutation({
       mutationFn: async (credentials) => {
         const response = await apiClient.post('/auth/login', credentials);
         localStorage.setItem('access_token', response.data.access_token);
         return response.data;
       },
     });
     
     return {
       login: loginMutation.mutate,
       isLoading: loginMutation.isPending,
     };
   }
   ```

3. **Protected routes middleware**
   ```typescript
   // middleware.ts
   import { NextResponse } from 'next/server';
   
   export function middleware(request: Request) {
     const token = request.cookies.get('access_token');
     
     if (!token) {
       return NextResponse.redirect(new URL('/login', request.url));
     }
     
     return NextResponse.next();
   }
   
   export const config = {
     matcher: ['/dashboard/:path*', '/personnel/:path*', '/attendance/:path*'],
   };
   ```

### Phase 5: Core Modules (Weeks 7-10)

Migrate modules in this order:

1. **Dashboard** (Week 7)
   - Stats cards (Present, Absent, Late)
   - Charts (Chart.js or Recharts)
   - Recent activity table
   - Real-time clock

2. **Personnel Management** (Week 8)
   - Personnel list (DataTable or MUI DataGrid)
   - Add/Edit personnel forms
   - Face registration with webcam
   - Profile image upload

3. **Attendance** (Week 9)
   - Attendance capture with webcam
   - Manual attendance entry
   - Attendance history table
   - Edit/delete attendance

4. **Reports & Pending** (Week 10)
   - Report filters and generation
   - Export to Excel/PDF
   - Pending approval list
   - Approve/reject actions

### Phase 6: Testing & Refinement (Weeks 11-12)

1. **Unit tests**
   - React components (Jest + React Testing Library)
   - API endpoints (pytest)

2. **Integration tests**
   - End-to-end flows (Playwright or Cypress)

3. **Performance optimization**
   - Image optimization
   - Code splitting
   - Lazy loading

4. **Accessibility**
   - Keyboard navigation
   - Screen reader support
   - ARIA labels

### Phase 7: Deployment (Week 13)

1. **Backend deployment**
   - Deploy Flask API to AWS/DigitalOcean
   - Configure environment variables
   - Set up PM2 or systemd service

2. **Frontend deployment**
   - Build Next.js for production: `npm run build`
   - Deploy to Vercel (easiest) or AWS S3 + CloudFront
   - Configure environment variables

3. **Database migration**
   - No schema changes needed (same database)
   - Update connection string in backend

---

## Code Examples

### Backend: JWT Authentication

```python
# backend/api/auth.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from werkzeug.security import check_password_hash
from models import User, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT tokens"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    user = User.query.filter(
        (User.username == username) | (User.email == username)
    ).first()
    
    if not user or not check_password_hash(user.password, password):
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    
    if not user.is_active:
        return jsonify({'success': False, 'message': 'Account is inactive'}), 403
    
    # Create tokens
    access_token = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)
    
    return jsonify({
        'success': True,
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'station_type': user.station_type.value
        }
    })

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    return jsonify({
        'success': True,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'is_admin': user.is_admin,
            'station_type': user.station_type.value
        }
    })
```

### Backend: Personnel API

```python
# backend/api/personnel.py
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import Personnel, User, db

personnel_bp = Blueprint('personnel', __name__)

@personnel_bp.route('/', methods=['GET'])
@jwt_required()
def list_personnel():
    """Get personnel list with station filtering"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Admin sees all, station users see only their personnel
    if user.is_admin:
        personnel = Personnel.query.all()
    else:
        personnel = Personnel.query.filter_by(station_id=user.id).all()
    
    return jsonify({
        'success': True,
        'data': [p.to_dict() for p in personnel]
    })

@personnel_bp.route('/<int:id>', methods=['GET'])
@jwt_required()
def get_personnel(id):
    """Get single personnel details"""
    personnel = Personnel.query.get_or_404(id)
    
    # Check access
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user.is_admin and personnel.station_id != user.id:
        return jsonify({'success': False, 'message': 'Access denied'}), 403
    
    return jsonify({
        'success': True,
        'data': personnel.to_dict()
    })

@personnel_bp.route('/', methods=['POST'])
@jwt_required()
def create_personnel():
    """Create new personnel"""
    data = request.get_json()
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    # Set station_id based on user permissions
    station_id = data.get('station_id') if user.is_admin else user.id
    
    personnel = Personnel(
        first_name=data['first_name'],
        last_name=data['last_name'],
        rank=data['rank'],
        station_id=station_id
    )
    
    db.session.add(personnel)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'data': personnel.to_dict(),
        'message': 'Personnel created successfully'
    }), 201
```

### Frontend: Personnel List

```typescript
// app/(dashboard)/personnel/page.tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { DataGrid } from '@mui/x-data-grid';
import { Box, Button, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { apiClient } from '@/lib/api-client';
import { Personnel } from '@/types/models';

export default function PersonnelPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['personnel'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Personnel[] }>('/personnel');
      return response.data.data;
    },
  });

  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'full_name', headerName: 'Name', width: 200 },
    { field: 'rank', headerName: 'Rank', width: 150 },
    { field: 'station', headerName: 'Station', width: 150 },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Personnel Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />}>
          Add Personnel
        </Button>
      </Box>

      <DataGrid
        rows={data || []}
        columns={columns}
        loading={isLoading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: { paginationModel: { pageSize: 10 } },
        }}
      />
    </Box>
  );
}
```

### Frontend: Attendance Capture

```typescript
// components/attendance/AttendanceCapture.tsx
'use client';

import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Box, Button, Typography } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import { apiClient } from '@/lib/api-client';

export function AttendanceCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const captureMutation = useMutation({
    mutationFn: async (imageData: string) => {
      const response = await apiClient.post('/attendance/capture', {
        main_image: imageData,
      });
      return response.data;
    },
    onSuccess: (data) => {
      alert(`Attendance recorded: ${data.message}`);
    },
    onError: (error) => {
      alert('Failed to capture attendance');
    },
  });

  const startCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      setIsCapturing(true);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg').split(',')[1]; // base64
    captureMutation.mutate(imageData);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Attendance Capture
      </Typography>

      <Box sx={{ position: 'relative', width: 640, height: 480, bgcolor: 'black' }}>
        <video ref={videoRef} autoPlay style={{ width: '100%', height: '100%' }} />
      </Box>

      <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
        {!isCapturing ? (
          <Button variant="contained" onClick={startCamera}>
            Start Camera
          </Button>
        ) : (
          <Button
            variant="contained"
            color="success"
            startIcon={<CameraAltIcon />}
            onClick={capturePhoto}
            disabled={captureMutation.isPending}
          >
            {captureMutation.isPending ? 'Processing...' : 'Capture'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
```

---

## API Contract

Complete REST API specification for all endpoints.

### Base URL

```
http://localhost:5000/api/v1
```

### Authentication

All protected endpoints require `Authorization: Bearer <token>` header.

### Endpoints

#### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/auth/login` | Login with username/password | No |
| POST | `/auth/logout` | Logout (invalidate token) | Yes |
| POST | `/auth/refresh` | Refresh access token | Yes (refresh token) |
| GET | `/auth/me` | Get current user info | Yes |

#### Personnel

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/personnel` | List all personnel | Yes |
| GET | `/personnel/:id` | Get personnel details | Yes |
| POST | `/personnel` | Create personnel | Yes |
| PUT | `/personnel/:id` | Update personnel | Yes |
| DELETE | `/personnel/:id` | Delete personnel | Yes (admin) |
| POST | `/personnel/:id/face` | Register face images | Yes |
| GET | `/personnel/:id/attendance` | Get attendance history | Yes |

#### Attendance

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/attendance` | List attendance records | Yes |
| GET | `/attendance/:id` | Get attendance details | Yes |
| POST | `/attendance/capture` | Capture attendance (face recognition) | Yes |
| POST | `/attendance/manual` | Manual attendance entry | Yes |
| PUT | `/attendance/:id` | Update attendance | Yes |
| DELETE | `/attendance/:id` | Delete attendance | Yes (admin) |

#### Dashboard

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/dashboard/stats` | Get today's statistics | Yes |
| GET | `/dashboard/recent` | Recent attendance records | Yes |
| GET | `/dashboard/charts` | Chart data (weekly/monthly) | Yes |
| GET | `/dashboard/time` | Current server time | Yes |

#### Reports

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/reports` | Generate report | Yes |
| GET | `/reports/export` | Export to Excel/CSV | Yes |
| GET | `/reports/monthly` | Monthly summary | Yes |

#### Pending

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/pending` | List pending approvals | Yes (admin) |
| POST | `/pending/:id/approve` | Approve attendance | Yes (admin) |
| POST | `/pending/:id/reject` | Reject attendance | Yes (admin) |

#### Users (Admin Only)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/users` | List all users | Yes (admin) |
| POST | `/users` | Create user | Yes (admin) |
| PUT | `/users/:id` | Update user | Yes (admin) |
| DELETE | `/users/:id` | Delete user | Yes (admin) |
| POST | `/users/:id/deactivate` | Deactivate user | Yes (admin) |

---

## Deployment Strategy

### Development Environment

**Docker Compose Setup** (Recommended for local development):

```yaml
# docker-compose.yml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: bfp_sorsogon_attendance
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      DATABASE_URL: mysql+pymysql://root:root@mysql/bfp_sorsogon_attendance
      SECRET_KEY: dev-secret-key
      JWT_SECRET_KEY: dev-jwt-secret
    volumes:
      - ./backend:/app
      - /app/.venv
    depends_on:
      - mysql

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:5000/api/v1
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  mysql_data:
```

**Start development:**
```bash
docker-compose up
```

### Production Deployment

#### Option 1: Single Server (Small Scale)

**Stack:**
- Ubuntu 22.04 LTS
- Nginx as reverse proxy
- Gunicorn for Flask backend
- PM2 for Next.js frontend
- MySQL database

**Architecture:**
```
Internet
   ↓
Nginx (80/443)
   ├→ Next.js (3000) - Frontend
   └→ Gunicorn (5000) - Backend API
        ↓
      MySQL (3306)
```

**Nginx Configuration:**
```nginx
# /etc/nginx/sites-available/bfp-attendance

upstream backend {
    server 127.0.0.1:5000;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name attendance.bfp-sorsogon.gov.ph;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # CORS headers (if needed)
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    }

    # Static files from backend
    location /static {
        alias /var/www/bfp-attendance/backend/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

**Backend systemd service:**
```ini
# /etc/systemd/system/bfp-backend.service
[Unit]
Description=BFP Attendance Backend API
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/bfp-attendance/backend
Environment="PATH=/var/www/bfp-attendance/backend/.venv/bin"
ExecStart=/var/www/bfp-attendance/backend/.venv/bin/gunicorn -w 1 -b 127.0.0.1:5000 app:create_app()
Restart=always

[Install]
WantedBy=multi-user.target
```

**Frontend PM2 setup:**
```bash
cd /var/www/bfp-attendance/frontend
npm run build
pm2 start npm --name "bfp-frontend" -- start
pm2 save
pm2 startup
```

#### Option 2: AWS (Scalable)

**Stack:**
- **Frontend**: AWS Amplify or Vercel (easiest) or S3 + CloudFront
- **Backend**: ECS Fargate or EC2 with Auto Scaling
- **Database**: RDS MySQL
- **Load Balancer**: Application Load Balancer
- **Storage**: S3 for uploaded images
- **CDN**: CloudFront for static assets

**Architecture:**
```
CloudFront (CDN)
   ↓
Next.js on Vercel or Amplify
   ↓
ALB (Load Balancer)
   ↓
ECS Fargate (Backend API)
   ↓
RDS MySQL
```

**Advantages:**
- Auto-scaling based on traffic
- High availability (multi-AZ)
- Managed services (less maintenance)
- CDN for fast global access

**Estimated Cost** (for small deployment):
- Vercel: Free (Hobby) or $20/month (Pro)
- ECS Fargate: ~$30-50/month (1 task, 0.5 vCPU, 2GB RAM)
- RDS MySQL: ~$15-30/month (db.t3.micro)
- ALB: ~$20/month
- **Total**: ~$85-120/month

#### Option 3: Vercel + Railway/Render (Simplest)

**Stack:**
- **Frontend**: Vercel (free or $20/month)
- **Backend**: Railway or Render ($7-20/month)
- **Database**: Railway MySQL or PlanetScale ($0-10/month)

**Pros:**
- Zero DevOps - fully managed
- Git push to deploy
- Automatic SSL certificates
- Environment variable management

**Cons:**
- Less control over infrastructure
- May have cold starts (depending on plan)

**Steps:**
1. Push backend to GitHub
2. Connect Railway to GitHub repo (backend folder)
3. Deploy database on Railway
4. Push frontend to GitHub
5. Connect Vercel to GitHub repo (frontend folder)
6. Set environment variables on both platforms
7. Done!

### Database Migration Strategy

**Zero-downtime migration:**

1. **Keep existing database schema** - No changes needed
2. **Run both systems in parallel** temporarily
3. **Gradual cutover**:
   - Week 1: New system in staging (test with sample users)
   - Week 2: New system available as beta (optional use)
   - Week 3: Make new system primary, keep old as fallback
   - Week 4: Decommission old system

---

## Timeline Estimate

### Detailed Breakdown

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1: Preparation** | Project setup, API audit, database backup | 1 week | None |
| **Phase 2: Backend API** | JWT auth, CRUD endpoints, testing | 3 weeks | Phase 1 |
| **Phase 3: Frontend Setup** | Next.js init, API client, types | 1 week | Phase 2 (parallel) |
| **Phase 4: Authentication** | Login, protected routes, middleware | 1 week | Phase 2, 3 |
| **Phase 5: Dashboard** | Stats, charts, real-time clock | 1 week | Phase 4 |
| **Phase 6: Personnel** | List, add/edit, face registration | 1 week | Phase 4 |
| **Phase 7: Attendance** | Capture, manual entry, history | 2 weeks | Phase 4, 6 |
| **Phase 8: Reports** | Filters, generation, export | 1 week | Phase 4, 7 |
| **Phase 9: Pending/Admin** | Approval workflow, user management | 1 week | Phase 4 |
| **Phase 10: Testing** | Unit, integration, E2E tests | 2 weeks | All phases |
| **Phase 11: Deployment** | Production setup, migration | 1 week | Phase 10 |
| **Total** | | **15 weeks** | (~3.5 months) |

### Accelerated Timeline (With Team)

If you have 2-3 developers working in parallel:

- **Backend developer**: Focus on API (Phases 2, 10)
- **Frontend developer**: Focus on UI (Phases 3-9)
- **Full-stack**: Handle integration and deployment (Phases 1, 11)

**Reduced timeline: 8-10 weeks** (~2 months)

---

## Risk Mitigation

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Face recognition breaks during migration | High | Keep face_rec_module unchanged; only change how it's called |
| JWT token security issues | High | Use httpOnly cookies, short expiry, refresh tokens |
| Large face detection models don't work in Docker | Medium | Test Docker build early; ensure PyTorch works in container |
| Performance degradation | Medium | Load test API endpoints; optimize database queries |
| CORS issues | Low | Configure CORS properly; test from different origins |

### Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Extended downtime during deployment | High | Deploy during off-hours; have rollback plan |
| Users unfamiliar with new UI | Medium | Provide training; keep UI similar to current system |
| Data loss during migration | Critical | Multiple backups; test migration on staging first |
| Budget overrun | Medium | Start with free tiers; scale up only when needed |

---

## Final Recommendations

### Should You Migrate?

**YES, if:**
- ✅ You want a modern, maintainable codebase
- ✅ You plan to add mobile app in the future
- ✅ You need better performance and UX
- ✅ You have 2-3 months for development
- ✅ You want independent frontend/backend scaling

**NO (or DELAY), if:**
- ❌ Current system works perfectly and no new features needed
- ❌ Budget is extremely tight (< $100/month for hosting)
- ❌ No developer resources available
- ❌ Deadline is less than 2 months

### Migration Strategy Recommendation

**Best approach for BFP Sorsogon:**

1. **Start with API-first backend** (Phases 1-2)
   - This alone improves the system (allows future mobile app)
   - Can still use existing Jinja templates temporarily
   - Low risk, high value

2. **Pilot with one module** (Phase 6 - Personnel)
   - Build Next.js frontend for Personnel module only
   - Test with small group of users
   - Learn lessons before migrating everything

3. **Gradual rollout** (Phases 7-9)
   - Migrate one module at a time
   - Users can use old system for unmigrated features
   - Reduce risk of total system failure

4. **Full cutover** (Phase 11)
   - Once all modules tested, switch completely
   - Keep old system as read-only backup for 1 month

### Tech Stack Recommendation

**For BFP Sorsogon specifically:**

**Backend:**
- Flask + Flask-JWT-Extended ✅ (familiar, proven)
- SQLAlchemy + MySQL ✅ (keep existing)
- Face recognition module ✅ (no changes)
- Deploy on: Railway or single EC2 instance

**Frontend:**
- Next.js 14 with App Router ✅
- TypeScript ✅ (catch errors early)
- Material-UI (MUI) ✅ (matches your style rules)
- TanStack Query ✅ (best React data fetching library)
- Deploy on: Vercel (free tier is enough for start)

**Rationale:**
- Low learning curve (Next.js is popular, good docs)
- Free/cheap hosting options
- Great developer experience
- Production-ready out of the box

---

## Next Steps

### Immediate Actions (This Week)

1. **Discuss with team**
   - Share this document
   - Get buy-in from stakeholders
   - Confirm timeline and budget

2. **Set up development environment**
   - Create new repo or branch: `feature/nextjs-migration`
   - Set up Docker Compose for local development
   - Test that current system still works

3. **Start API audit**
   - Document all current routes
   - Identify which are HTML vs JSON
   - Create API specification document

### First Sprint (Week 1-2)

1. **Backend refactoring**
   - Create `backend/` directory structure
   - Install Flask-JWT-Extended
   - Implement `/api/v1/auth` endpoints
   - Test with Postman

2. **Frontend initialization**
   - Create Next.js app with TypeScript
   - Set up API client with axios
   - Create basic layout and login page
   - Test connection to backend API

### Proof of Concept (Week 3-4)

**Goal**: Working login + dashboard with real data

**Deliverable**: Demo video showing:
- User logs in with Next.js frontend
- JWT token is received and stored
- Dashboard loads with real statistics from API
- Protected routes work correctly

**Success criteria**:
- ✅ Authentication works end-to-end
- ✅ API returns JSON correctly
- ✅ Frontend renders data from backend
- ✅ No CORS errors
- ✅ Looks good on mobile and desktop

Once POC is successful, proceed with full migration.

---

## Resources

### Documentation

- **Next.js**: https://nextjs.org/docs
- **TanStack Query**: https://tanstack.com/query/latest/docs/react/overview
- **Material-UI**: https://mui.com/material-ui/getting-started/
- **Flask-JWT-Extended**: https://flask-jwt-extended.readthedocs.io/
- **Flask-RESTX**: https://flask-restx.readthedocs.io/

### Learning Resources

- **Next.js 14 Tutorial**: https://www.youtube.com/watch?v=ZVnjOPwW4ZA
- **TanStack Query Guide**: https://www.youtube.com/watch?v=8K1N3fE-cDs
- **Flask REST API**: https://www.youtube.com/watch?v=s_ht4AKnWZg

### Tools

- **API Testing**: Postman, Insomnia, or Thunder Client (VS Code)
- **Database Management**: MySQL Workbench or DBeaver
- **API Documentation**: Swagger UI (auto-generated with Flask-RESTX)
- **E2E Testing**: Playwright or Cypress

---

## Conclusion

Migrating to Next.js + Flask API architecture is **feasible and recommended** for the BFP Attendance System. The current codebase is well-structured, making the migration straightforward.

**Key Takeaways:**

1. ✅ **Feasibility**: Yes, definitely doable
2. ⏱️ **Timeline**: 2-3 months with 1-2 developers
3. 💰 **Cost**: $0-150/month (depending on hosting choice)
4. 📈 **Benefits**: Better UX, maintainability, scalability
5. ⚠️ **Risks**: Manageable with proper planning and testing

**Recommendation**: Start with a **proof of concept** (4 weeks) to validate the approach, then proceed with full migration if successful.

Good luck with the migration! 🚀

---

**Questions? Need help?**

Feel free to reach out if you need:
- Code reviews during migration
- Architecture decisions
- Deployment assistance
- Performance optimization
- Security audits

The biggest challenge will be time and resources, not technical feasibility. The architecture is solid and the migration path is clear.