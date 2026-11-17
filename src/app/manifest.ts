import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Task Manager",
    short_name: "Tasks",
    description: "Assign, track and prove every task across your teams.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0A84FF",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Notifications", url: "/notifications", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Team Chat", url: "/team-chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
