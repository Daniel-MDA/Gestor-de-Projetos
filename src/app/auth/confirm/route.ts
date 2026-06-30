import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
 
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
 
  // Destino padrão pós-confirmação
  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
 
  if (!token_hash || !type) {
    redirectTo.pathname = "/login";
    redirectTo.searchParams.set("erro", "link_invalido");
    return NextResponse.redirect(redirectTo);
  }
 
  const supabase = await createClient();
 
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash,
  });
 
  if (error) {
    redirectTo.pathname = "/login";
redirectTo.searchParams.set("erro", "link_expirado");
    return NextResponse.redirect(redirectTo);
  }
 
  // Sucesso. Decide destino conforme o tipo:
  if (type === "recovery") {
    redirectTo.pathname = "/auth/redefinir-senha";
  } else {
    redirectTo.pathname = "/";
  }
 
  redirectTo.searchParams.delete("erro");
  return NextResponse.redirect(redirectTo);
}
