export type Role = "admin" | "station_user" | "kiosk";
export type AttendanceType = "time_in" | "time_out";
export type AttendanceStatus = "confirmed" | "pending" | "rejected";
export type PersonnelSection = "admin" | "operation";

export interface Station {
  id: number;
  name: string;
  location: string;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  stationId: number;
  isActive: boolean;
  profilePicture?: string;
  mustChangePassword: boolean;
}

export interface Personnel {
  id: number;
  firstName: string;
  lastName: string;
  rank: string;
  section: PersonnelSection;
  stationId: number;
  imagePath?: string;
  isActive: boolean;
  dateCreated: string;
  address?: string;
  contactNumber?: string;
  gender?: string;
}

export interface AttendanceRecord {
  id: number;
  personnelId: number;
  type: AttendanceType;
  status: AttendanceStatus;
  confidence?: number;
  imagePath?: string;
  createdBy: number;
  createdAt: string;
  modifiedBy?: number;
  modifiedAt?: string;
}

export interface PendingApproval {
  id: number;
  personnelId: number;
  confidence: number;
  imagePath: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedBy?: number;
  reviewedAt?: string;
  createdAt: string;
}

export interface DailyAttendanceSummary {
  personnelId: number;
  personnelName: string;
  rank: string;
  date: string;
  firstIn: string | null; // ISO string
  lastOut: string | null; // ISO string
  firstInId: number | null;
  lastOutId: number | null;
}
