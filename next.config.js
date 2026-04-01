/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    PORT: process.env.PORT || '3002',
  },
};

module.exports = nextConfig;
