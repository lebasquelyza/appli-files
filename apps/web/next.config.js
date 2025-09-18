/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Marque @upstash/* comme externes côté server pour éviter la résolution pendant le build
      config.externals = config.externals || [];
      config.externals.push({
        '@upstash/redis': 'commonjs @upstash/redis',
        '@upstash/ratelimit': 'commonjs @upstash/ratelimit',
      });
    }
    return config;
  },
};

module.exports = nextConfig;

