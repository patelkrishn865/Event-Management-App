/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/auth/login",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*"
      }
    ]
  }
};

export default nextConfig;
