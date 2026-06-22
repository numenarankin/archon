"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { navLinks } from "@/components/app-shared";
import { useBreadcrumbLabel } from "@/components/breadcrumb-context";

/** Title-cases a URL slug as a fallback before the page registers its label. */
function prettifySlug(slug: string): string {
	return slug
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

/** Click-to-edit trailing crumb (used to rename a project). */
function EditableCrumb({
	value,
	onCommit,
}: {
	value: string;
	onCommit: (name: string) => void;
}) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (editing) inputRef.current?.select();
	}, [editing]);

	function commit() {
		setEditing(false);
		const trimmed = draft.trim();
		if (trimmed && trimmed !== value) onCommit(trimmed);
	}

	if (editing) {
		return (
			<input
				ref={inputRef}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						commit();
					} else if (e.key === "Escape") {
						e.preventDefault();
						setDraft(value);
						setEditing(false);
					}
				}}
				className="w-40 rounded border border-border bg-background px-1.5 py-0.5 text-foreground outline-none focus:ring-1 focus:ring-ring"
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => {
				setDraft(value);
				setEditing(true);
			}}
			title="Click to rename"
			className="rounded px-1 hover:bg-accent"
		>
			{value}
		</button>
	);
}

export function AppBreadcrumbs() {
	const pathname = usePathname();
	const ctx = useBreadcrumbLabel();
	const segments = pathname.split("/").filter(Boolean);

	const section =
		navLinks.find((item) => item.path === `/${segments[0]}`) ??
		(segments.length === 0
			? navLinks.find((item) => item.path === "/")
			: undefined);

	if (!section?.title) {
		return null;
	}

	const isDetail = segments.length > 1;
	const detailLabel = ctx?.label ?? prettifySlug(segments[1] ?? "");
	const rename = ctx?.rename ?? null;

	return (
		<Breadcrumb>
			<BreadcrumbList>
				<BreadcrumbItem>
					{isDetail && section.path ? (
						<BreadcrumbLink
							render={<Link href={section.path} />}
							className="flex items-center gap-2 [&>svg]:size-3.5"
						>
							{section.icon}
							{section.title}
						</BreadcrumbLink>
					) : (
						<BreadcrumbPage className="flex items-center gap-2 [&>svg]:size-3.5">
							{section.icon}
							{section.title}
						</BreadcrumbPage>
					)}
				</BreadcrumbItem>
				{isDetail && (
					<>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							{rename ? (
									<EditableCrumb value={detailLabel} onCommit={rename} />
								) : (
									<BreadcrumbPage>{detailLabel}</BreadcrumbPage>
								)}
						</BreadcrumbItem>
					</>
				)}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
