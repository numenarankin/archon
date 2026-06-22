"use client";

import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/logo-mark";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
	footerNavLinks,
	navGroups,
	type SidebarNavGroup,
	type SidebarNavItem,
} from "@/components/app-shared";
import { NavGroup } from "@/components/nav-group";
import { usePermissions } from "@/components/auth/permissions-context";

/** Keep only items the user is allowed to see, then drop now-empty groups. */
function visibleGroups(
	groups: SidebarNavGroup[],
	allowed: ReadonlySet<string>
): SidebarNavGroup[] {
	const canSee = (item: SidebarNavItem): boolean => {
		if (!item.permission) return true;
		const wanted = Array.isArray(item.permission)
			? item.permission
			: [item.permission];
		return wanted.some((p) => allowed.has(p));
	};
	return groups
		.map((group) => ({ ...group, items: group.items.filter(canSee) }))
		.filter((group) => group.items.length > 0);
}

export function AppSidebar() {
	const permissions = usePermissions();
	const groups = visibleGroups(navGroups, permissions);
	return (
		<Sidebar
			className={cn(
				"*:data-[slot=sidebar-inner]:bg-background",
				"*:data-[slot=sidebar-inner]:dark:bg-[radial-gradient(60%_18%_at_10%_0%,--theme(--color-foreground/.08),transparent)]",
				"**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75"
			)}
			collapsible="icon"
			variant="sidebar"
		>
			<SidebarHeader className="h-14 justify-center border-b px-2">
				<SidebarMenuButton render={<a href="#link" />}><LogoMark className="size-8 shrink-0 text-foreground" /><span className="text-base font-semibold text-foreground!">Archon</span></SidebarMenuButton>
			</SidebarHeader>
			<SidebarContent>
				{groups.map((group, index) => (
					<NavGroup key={`sidebar-group-${index}`} {...group} />
				))}
			</SidebarContent>
			<SidebarFooter className="gap-0 p-0">
				{footerNavLinks.length > 0 && (
					<SidebarMenu className="border-t p-2">
						{footerNavLinks.map((item) => (
							<SidebarMenuItem key={item.title}>
								<SidebarMenuButton className="text-muted-foreground" isActive={item.isActive} size="sm" render={<a href={item.path} />}>{item.icon}<span>{item.title}</span></SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				)}
				<div className="border-t px-4 pt-4 pb-2 transition-opacity group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0">
					<p className="text-nowrap text-[9px] text-muted-foreground">
						© {new Date().getFullYear()} Wildcat Labs, Inc.
					</p>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
