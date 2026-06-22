import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { DecorIcon } from "@/components/decor-icon";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { NavUser } from "@/components/nav-user";
import { AiDrawerTrigger } from "@/components/ai/ai-drawer-trigger";
import { VoiceModeToggle } from "@/components/ai/voice-mode-toggle";
import { PriceTicker } from "@/components/price-ticker";
import { Can } from "@/components/auth/permissions-context";
import { displayFirstName } from "@/lib/user";
import type { Profile } from "@/lib/settings/profile";

// AppHeader lives inside the client AppShell, so it can't fetch data itself
// (an async client component loops on an uncached promise). The profile + the
// session email are fetched in the server layout and passed down.
export function AppHeader({
	profile,
	userEmail,
}: {
	profile: Profile;
	userEmail: string;
}) {
	const name = profile.name.trim() || displayFirstName(null, userEmail);
	return (
		<header
			className={cn(
				"sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 md:px-6",
				"bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/50"
			)}
		>
			<DecorIcon className="hidden md:block" position="bottom-left" />
			<div className="flex items-center gap-3">
				<CustomSidebarTrigger />
				<Separator
					className="mr-2 h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<AppBreadcrumbs />
			</div>
			<div className="flex items-center gap-3">
				<PriceTicker />
				{/* Voice + Archon triggers only for users who hold `use_ai`. */}
				<Can permission="use_ai">
					<VoiceModeToggle />
					<AiDrawerTrigger />
				</Can>
				<Separator
					className="h-4 data-[orientation=vertical]:self-center"
					orientation="vertical"
				/>
				<NavUser
					name={name}
					email={userEmail}
					avatarUrl={profile.avatarUrl}
				/>
			</div>
		</header>
	);
}
