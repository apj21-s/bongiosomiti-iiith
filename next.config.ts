import type { NextConfig } from "next";

// The registration artwork used to be copied here at build time from a second
// copy in the repo root. That source was byte-identical to the committed
// public/mahalaya_registration_assets, so it has been quarantined in others/
// and the copy - which wrote to the filesystem during the build - is gone.

// Response headers applied site-wide. No Content-Security-Policy yet: the pages
// rely heavily on inline styles and Google Fonts, so a policy needs to be built
// and tested in report-only mode first.
const securityHeaders = [
  // Stop the browser from second-guessing declared content types.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Keep referrers off third parties while preserving same-origin analytics.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The admin console and pass pages should never be framed by another site.
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // The gate scanner needs the camera; nothing else needs any of these.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  // Vercel serves this over HTTPS. Left without includeSubDomains/preload so it
  // makes no promises on behalf of other hosts.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.1.29.216', '10.202.132.203', '10.75.225.203', '10.235.219.203'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
