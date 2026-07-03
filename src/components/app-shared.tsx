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
	LifeBuoyIcon,
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
				permission: "use_ai",
			},
			{
				title: "Files",
				path: "/files",
				icon: <FilesIcon />,
				permission: "view_files",
			},
			{
				title: "Email",
				path: "/email",
				icon: <MailIcon />,
				permission: "view_email",
			},
			{
				title: "Support",
				path: "/support",
				icon: <LifeBuoyIcon />,
				permission: "view_email",
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
				permission: "view_tasks",
			},
			{
				title: "Calendar",
				path: "/calendar",
				icon: <CalendarIcon />,
				permission: "view_calendar",
			},
			{
				title: "Projects",
				path: "/projects",
				icon: <CompassIcon />,
				permission: "view_projects",
			},
		],
	},
	{
		label: "Numena",
		items: [
			{
				title: "Prospecting",
				path: "/numena/prospecting",
				icon: <GemIcon />,
				permission: "view_prospects",
			},
			{
				title: "Sales",
				path: "/numena/sales",
				icon: <HandshakeIcon />,
				permission: "view_prospects",
			},
			{
				title: "Pipeline",
				path: "/numena/pipeline",
				icon: <KanbanIcon />,
				permission: "view_pipeline",
			},
			{
				title: "KPIs",
				path: "/numena-kpis",
				icon: <LineChartIcon />,
				permission: "view_kpis",
			},
			{
				title: "Finance",
				path: "/finance",
				icon: <LandmarkIcon />,
				permission: "view_finance",
			},
		],
	},
	{
		label: "Wildcat",
		items: [
			{
				title: "Prospecting",
				path: "/wildcat/prospecting",
				icon: <GemIcon />,
				permission: "view_map",
			},
			{
				title: "Pipeline",
				path: "/wildcat/pipeline",
				icon: <KanbanIcon />,
				permission: "view_pipeline",
			},
			{
				title: "Sales",
				path: "/wildcat/sales",
				icon: <HandshakeIcon />,
				permission: "view_sales",
			},
			{
				title: "Map",
				path: "/map",
				icon: <MapIcon />,
				permission: "view_map",
			},
			{
				title: "People",
				path: "/people",
				icon: <UsersIcon />,
				permission: "view_people",
			},
			{
				title: "Accounting",
				path: "/accounting",
				icon: <CalculatorIcon />,
				permission: "view_accounting",
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
				title: "Budgeting",
				path: "/budgeting",
				icon: <WalletIcon />,
				permission: "view_budgeting",
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
