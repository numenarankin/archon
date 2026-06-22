"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOutIcon } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface NavUserProps {
	name: string;
	email: string;
	avatarUrl?: string | null;
}

/** Up-to-two-letter initials for the avatar fallback. */
function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function NavUser({ name, email, avatarUrl }: NavUserProps) {
	const user = { name, email, avatar: avatarUrl ?? undefined };

	async function handleSignOut() {
		// Clear the Supabase session cookies, then hard-navigate. Proxy sees no
		// session and redirects to /auth. (No-op when Supabase isn't configured.)
		try {
			await getSupabaseBrowser().auth.signOut();
		} catch {
			// Even if sign-out errors, fall through to the redirect.
		}
		window.location.href = "/auth";
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						aria-label="Account menu"
						className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					/>
				}
			>
				<Avatar className="size-8">
					<AvatarImage src={user.avatar} />
					<AvatarFallback>{initials(user.name)}</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60">
				<div className="flex items-center gap-3 px-1.5 py-1.5">
					<Avatar className="size-10">
						<AvatarImage src={user.avatar} />
						<AvatarFallback>{initials(user.name)}</AvatarFallback>
					</Avatar>
					<div className="min-w-0">
						<div className="font-medium text-foreground">{user.name}</div>
						<div className="max-w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-muted-foreground text-xs">
							{user.email}
						</div>
					</div>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						className="w-full cursor-pointer"
						variant="destructive"
						onClick={handleSignOut}
					>
						<LogOutIcon />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
