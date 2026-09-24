import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

try {
  const src = path.join(process.cwd(), 'Mahalaya_Registration_Assets_CLEAN_FINAL (2)');
  const dest = path.join(process.cwd(), 'public', 'mahalaya_registration_assets');
  if (fs.existsSync(src)) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
    console.log("Clean assets successfully copied to public folder!");
  }
} catch (e) {
  console.error("Asset copy failed:", e);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.1.29.216', '10.202.132.203', '10.75.225.203', '10.235.219.203'],
};

export default nextConfig;
