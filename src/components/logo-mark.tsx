import type React from "react";

/** Archon logo: an outlined circle with a filled dot in the middle. */
export function LogoMark(props: React.ComponentProps<"svg">) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			{...props}
		>
			<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
			<circle cx="12" cy="12" r="3" fill="currentColor" />
		</svg>
	);
}
