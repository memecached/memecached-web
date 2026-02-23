import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    },
  );

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  const pathname = request.nextUrl.pathname;

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // For authenticated page requests, check approval status and role
  // API routes are gated by getAuthenticatedUser() / getAdminUser() instead
  if (user && !pathname.startsWith("/api")) {
    const email = (user as Record<string, unknown>).email as string | undefined;
    if (email) {
      const { data: dbUser } = await supabase.from("users").select("status, role").eq("email", email).single();

      if (dbUser) {
        const { status, role } = dbUser;

        // Unapproved users: redirect to /pending
        if (status !== "approved" && !pathname.startsWith("/pending")) {
          const url = request.nextUrl.clone();
          url.pathname = "/pending";
          url.searchParams.set("status", status);
          return NextResponse.redirect(url);
        }

        // Approved users stuck on /pending: redirect to /
        if (status === "approved" && pathname.startsWith("/pending")) {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          url.searchParams.delete("status");
          return NextResponse.redirect(url);
        }

        // Non-admins trying to access /admin: redirect to /
        if (pathname.startsWith("/admin") && role !== "admin") {
          const url = request.nextUrl.clone();
          url.pathname = "/";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}
