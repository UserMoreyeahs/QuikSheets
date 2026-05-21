/** @type {import('next').NextConfig} */
const nextConfig = {
  // Move Next's dev-mode indicator pill from the default bottom-left
  // (where it overlapped our status bar's A1/Sheet1 breadcrumb) to
  // bottom-right, tucked next to the scratchpad button. Production
  // builds never render the indicator regardless.
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
