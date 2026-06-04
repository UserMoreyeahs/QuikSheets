/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move Next's dev-mode indicator pill from the default bottom-left
  // (where it overlapped our status bar's A1/Sheet1 breadcrumb) to
  // bottom-right. Production builds never render the indicator regardless.
  devIndicators: {
    position: 'bottom-right',
  },
  // Tree-shake barrel-heavy UI deps so only the icons/primitives actually
  // used land in each chunk (lucide-react alone exports ~1.5k icons). Pure
  // build-time optimization — no runtime behavior change.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
    ],
  },
};

export default nextConfig;
