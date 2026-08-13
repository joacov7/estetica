/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Block cross-origin framing (clickjacking) of the dashboard.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Don't let browsers MIME-sniff responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer leakage to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Drop powerful features we never use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Enforce HTTPS for two years (site is served over TLS on Vercel).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  poweredByHeader: false, // don't advertise the framework
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
