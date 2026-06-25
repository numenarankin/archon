import type { ReactNode } from "react";
import {
	HomeIcon,
	FilesIcon,
	MailIcon,
	CompassIcon,
	ListTodoIcon,
	CalendarIcon,
	UsersIcon,
	CalculatorIcon,
	BarChart3Icon,
	LineChartIcon,
	MapIcon,
	WalletIcon,
	LandmarkIcon,
	SettingsIcon,
	GemIcon,
	KanbanIcon,
	HandshakeIcon,
} from "lucide-react";
import { SparkleIcon } from "@/components/ai/sparkle-icon";
import type { PermissionKey } from "@/lib/settings/org";

export type SidebarNavItem = {
	title: string;
	path?: string;
	icon?: ReactNode;
	isActive?: boolean;
	subItems?: SidebarNavItem[];
	/**
	 * Capability required to see this item. An array means "any of these".
	 * Omit for items everyone can reach (Home, Settings).
	 */
	permission?: PermissionKey | PermissionKey[];
};

export type SidebarNavGroup = {
	label?: string;
	items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
	{
		label: "Overview",
		items: [
			{
				title: "Home",
				path: "/",
				icon: <HomeIcon />,
				// The home page is the Archon chat overview, so it's only useful
				// (and only reachable — see app/page.tsx) with `use_ai`.
				permission: "use_ai",
			},
			{
				title: "Files",
				path: "/files",
				icon: <FilesIcon />,
				permission: "manage_files",
			},
			{
				// No dedicated permission yet — visible to everyone, like Settings.
				title: "Email",
				path: "/email",
				icon: <MailIcon />,
			},
			{
				title: "Archon",
				path: "/archon",
				icon: <SparkleIcon />,
				permission: "use_ai",
			},
			{
				title: "Tasks",
				path: "/tasks",
				icon: <ListTodoIcon />,
				permission: "manage_tasks",
			},
			{
				title: "Calendar",
				path: "/calendar",
				icon: <CalendarIcon />,
				permission: ["manage_personal_calendar", "manage_org_calendar"],
			},
			{
				title: "Projects",
				path: "/projects",
				icon: <CompassIcon />,
				permission: "manage_projects",
			},
		],
	},
	{
		label: "Numena",
		items: [
			{
				// No dedicated permission yet — visible to everyone, like Email.
				title: "Prospecting",
				path: "/numena",
				icon: <GemIcon />,
			},
			{
				title: "Pipeline",
				path: "/numena/pipeline",
				icon: <KanbanIcon />,
			},
			{
				title: "KPIs",
				path: "/numena-kpis",
				icon: <LineChartIcon />,
			},
			{
				// Mercury bank dashboard. No dedicated permission — visible to
				// everyone, like Email; gated only by the MERCURY_API_KEY env.
				title: "Finance",
				path: "/finance",
				icon: <LandmarkIcon />,
			},
		],
	},
	{
		label: "Wildcat",
		items: [
			{
				title: "Pipeline",
				path: "/wildcat/pipeline",
				icon: <KanbanIcon />,
			},
			{
				title: "Sales",
				path: "/wildcat/sales",
				icon: <HandshakeIcon />,
			},
			{
				title: "Map",
				path: "/map",
				icon: <MapIcon />,
				permission: "view_well_files",
			},
			{
				title: "People",
				path: "/people",
				icon: <UsersIcon />,
				permission: ["view_royalty_owners", "manage_royalty_owners"],
			},
			{
				title: "Accounting",
				path: "/accounting",
				icon: <CalculatorIcon />,
				permission: ["view_accounting", "manage_accounting"],
			},
			{
				title: "Analytics",
				path: "/analytics",
				icon: <BarChart3Icon />,
				permission: "view_analytics",
			},
		],
	},
	{
		label: "Personal",
		items: [
			{
				// No dedicated permission — personal budgeting is visible to
				// everyone, like Email.
				title: "Budgeting",
				path: "/budgeting",
				icon: <WalletIcon />,
			},
		],
	},
	{
		label: "Administration",
		items: [
			{
				title: "Settings",
				path: "/settings",
				icon: <SettingsIcon />,
			},
		],
	},
];

export const footerNavLinks: SidebarNavItem[] = [];

export const navLinks: SidebarNavItem[] = [
	...navGroups.flatMap((group) =>
		group.items.flatMap((item) =>
			item.subItems?.length ? [item, ...item.subItems] : [item]
		)
	),
	...footerNavLinks,
];
