import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error || errorDescription) {
        console.error('Auth callback error from Supabase:', error, errorDescription);
        const msg = errorDescription || error || 'Authentication failed. Please try again.';
        return NextResponse.redirect(
            new URL(`/auth/login?error=${encodeURIComponent(msg)}`, request.url)
        );
    }

    if (code) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        );

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Successfully exchanged code for session
            return NextResponse.redirect(new URL(next, request.url));
        }

        // If there's an error exchanging the code
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
            new URL(`/auth/login?error=${encodeURIComponent('Invalid or expired link. Please try again.')}`, request.url)
        );
    }

    // If there's no code, redirect to login with error
    return NextResponse.redirect(
        new URL('/auth/login?error=missing_code', request.url)
    );
}
