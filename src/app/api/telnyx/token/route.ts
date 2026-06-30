import { forbidUnlessPermitted } from "@/lib/auth/permissions";
import { hasTelnyx, mintWebrtcToken } from "@/lib/wildcat/telephony/telnyx";

/** POST -> { token }: a short-lived WebRTC JWT for the signed-in rep's dialer. */
export async function POST() {
  const denied = await forbidUnlessPermitted("view_sales");
  if (denied) return denied;

  if (!hasTelnyx()) {
    return new Response("Telnyx not configured", { status: 503 });
  }

  try {
    const token = await mintWebrtcToken();
    return Response.json({ token });
  } catch (error) {
    const message = error instanceof Error ? error.message : "token error";
    return new Response(message, { status: 502 });
  }
}
