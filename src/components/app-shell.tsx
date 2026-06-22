"use client";

import { usePathname } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { AppMain } from "@/components/app-main";
import { AiDrawer } from "@/components/ai/ai-drawer";
import { VoiceController } from "@/components/ai/voice-controller";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { Can, PermissionsProvider } from "@/components/auth/permissions-context";
import type { Profile } from "@/lib/settings/profile";
import type { PermissionKey } from "@/lib/settings/org";

/** Routes that render full-screen, outside the app chrome (sidebar/topbar). */
const BARE_ROUTES = ["/auth", "/onboarding", "/invite"];

export function AppShell({
	children,
	profile,
	userEmail,
	permissions,
}: {
	children: React.ReactNode;
	profile: Profile;
	userEmail: string;
	permissions: PermissionKey[];
}) {
	const pathname = usePathname();
	const bare = BARE_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`)
	);
	if (bare) {
		return <>{children}</>;
	}

	return (
		<PermissionsProvider permissions={permissions}>
		<BreadcrumbProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset className="min-w-0">
					<AppHeader profile={profile} userEmail={userEmail} />
					<AppMain>{children}</AppMain>
					{/* Inside the inset so its overlay centers within the content
					    area (not the full viewport) and tracks sidebar width. */}
					<Can permission="use_ai">
						<VoiceController />
					</Can>
				</SidebarInset>
				<Can permission="use_ai">
					<AiDrawer />
				</Can>
			</SidebarProvider>
		</BreadcrumbProvider>
		</PermissionsProvider>
	);
}
