import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server.ts";

/** Finishes email sign-in: swaps the one-time code for a session, then sends the user on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/questionnaire", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
