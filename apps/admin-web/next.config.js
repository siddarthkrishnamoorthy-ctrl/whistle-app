/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@whistle/shared"],
  // Off intentionally: StrictMode double-invokes effects in dev, which made every
  // data-fetching useEffect fire its API twice in the Network tab (tenants, sports,
  // match-center, tournaments, crm, invoices, drills, assessments…). It's a dev-only
  // artifact — production already calls once — but disabling it makes dev match prod
  // so the "API called twice" noise goes away everywhere.
  reactStrictMode: false,
};

module.exports = nextConfig;
