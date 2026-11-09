import type { Metadata } from "next";
import CommunityPage from "./community-client";

export const metadata: Metadata = { title: "Community | Salah Tracker", description: "Daily reflections, helpful resources, and updates from Salah Tracker." };

export default function Page() {
  return <CommunityPage />;
}
