import type { MetadataRoute } from "next";

// PWA: телефонның басты экранына қосу. Service worker 10-кезеңде (push хабарламалар) қосылады.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "GrantUp — ҰБТ-ға дайындық",
    short_name: "GrantUp",
    description: "ҰБТ-ға дайындық платформасы: сабақтар, тесттер, сынақ ҰБТ, AI-тьютор.",
    lang: "kk",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f8ff",
    theme_color: "#0047ff",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
