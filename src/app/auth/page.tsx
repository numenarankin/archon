import { AuthPage } from "@/components/auth/auth-page";

export default async function Auth({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <AuthPage initialMode={mode === "signup" ? "signup" : undefined} />;
}
