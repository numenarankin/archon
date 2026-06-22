import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/app-shell";
import { getProfile } from "@/lib/settings/profile";
import { getSessionUser } from "@/lib/auth/session";
import { getCurrentPermissions } from "@/lib/auth/permissions";

const figtree = Figtree({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Archon",
  description: "Archon application",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [profile, user, { permissions }] = await Promise.all([
    getProfile(),
    getSessionUser(),
    getCurrentPermissions(),
  ]);
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <TooltipProvider>
          <AppShell
            profile={profile}
            userEmail={user?.email ?? ""}
            permissions={permissions}
          >
            {children}
          </AppShell>
        </TooltipProvider>
      </body>
    </html>
  );
}
