/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 도커(frontend/Dockerfile)가 .next/standalone 을 복사하므로 필요
  output: "standalone",
  // react-simple-maps + d3 계열은 ESM 이라 Next 에서 트랜스파일 필요 (안 하면 빌드 크래시)
  transpilePackages: [
    "react-simple-maps",
    "d3-geo", "d3-array", "d3-scale", "d3-color", "d3-interpolate",
    "d3-format", "d3-selection", "d3-zoom", "d3-transition", "d3-ease",
    "d3-timer", "d3-dispatch", "d3-drag",
    "topojson-client", "internmap", "delaunator", "robust-predicates",
  ],
};
export default nextConfig;
