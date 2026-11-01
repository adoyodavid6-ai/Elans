import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elans: AI Automation & Growth",
    short_name: "Elans",
    description: "AI automation and growth systems for businesses in Kenya and East Africa.",
    start_url: "/",
    display: "standalone",
    background_color: "#FCFCFC",
    theme_color: "#6A012A",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
