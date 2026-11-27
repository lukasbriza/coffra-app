// Route segment config must be a literal export in the route file — Next 16 (Turbopack)
// statically parses it and cannot follow a re-export. The component + metadata come from the module.
export const dynamic = 'force-dynamic'

export { DashboardPage as default, generateMetadata } from '@/modules/dashboard/page'
