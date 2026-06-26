import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    // Compatibilidade com bookmarks antigos: /dashboard foi migrado para /tarefas.
    return [
      {
        source: "/dashboard",
        destination: "/tarefas",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
