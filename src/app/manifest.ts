import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZUARI Site", short_name: "ZUARI", description: "Site capture for construction teams",
    start_url: "/site", scope: "/", display: "standalone", background_color: "#F5F2EA", theme_color: "#123C36",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
