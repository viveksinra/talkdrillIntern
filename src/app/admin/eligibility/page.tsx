import { redirect } from 'next/navigation';

/**
 * Route alias. AppShell's admin nav links the Eligibility tab to /admin/eligibility,
 * while the screen itself lives at /admin/rules (rules builder + eligibility board).
 * Redirecting here keeps the tab working without duplicating the page.
 */
export default function AdminEligibilityAliasPage() {
  redirect('/admin/rules');
}
