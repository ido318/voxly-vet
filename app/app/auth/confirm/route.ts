import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/safe-next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_OTP_TYPES = [
  "recovery",
  "email",
  "signup",
  "invite",
  "magiclink",
  "email_change",
] as const;

type OtpType = (typeof VALID_OTP_TYPES)[number];

function isOtpType(value: string | null): value is OtpType {
  return (VALID_OTP_TYPES as readonly string[]).includes(value ?? "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"), "/login/reset-password");

  if (tokenHash && isOtpType(type)) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

    if (!error) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = next;
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login/forgot-password";
  errorUrl.search = "";
  errorUrl.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(errorUrl);
}
