import { Metadata } from "next";
import SchedulePageClient from "@/components/schedule/SchedulePageClient";

export const metadata: Metadata = {
  title: "Schedule | BFP Sorsogon",
  description: "Manage personnel schedules and shifting",
};

export default function SchedulePage() {
  return <SchedulePageClient />;
}
