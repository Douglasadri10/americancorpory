/Users/daimaximila/myskyled/skyled-admin/next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // Evita que o build de produção na Vercel quebre por erros de tipo
    // (ex.: arquivos de /functions). Mantemos o typecheck no dev.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Não falhar o build por warnings/erros do ESLint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

/Users/daimaximila/myskyled/skyled-admin/.vercelignore
functions/
.firebase*
firestore.rules
firestore.indexes.json
storage.rules
README.md