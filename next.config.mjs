/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage public buckets (host set via env at deploy time)
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
