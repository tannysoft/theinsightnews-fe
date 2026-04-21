/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permanent redirects for legacy URLs that people/search engines might
  // still hit. Posts used to live at /post/<slug>; they're now at /<slug>.
  async redirects() {
    return [
      {
        source: "/post/:slug",
        destination: "/:slug",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.theinsightnews.co",
      },
      {
        protocol: "https",
        hostname: "theinsightnews.co",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
      },
      {
        protocol: "https",
        hostname: "i0.wp.com",
      },
      {
        protocol: "https",
        hostname: "i1.wp.com",
      },
      {
        protocol: "https",
        hostname: "i2.wp.com",
      },
    ],
  },
};

export default nextConfig;
