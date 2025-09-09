/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/dashboard/tarifs', destination: '/dashboard/abonnement', permanent: true },
    ];
  },
};

export default nextConfig;
