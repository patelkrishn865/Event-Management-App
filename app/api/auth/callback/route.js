import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Authentication Callback Handler
 * Handles the PKCE code exchange and redirects users after verification/password reset links.
 */
export async function GET(request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')

    // 'next' is the path to redirect to after successful login
    // Falls back to /dashboard if not provided
    const next = searchParams.get('next') ?? '/dashboard'

    // 'type' tells us if this is a signup, recovery, magiclink, etc.
    const type = searchParams.get('type')

    // Log incoming request for debugging
    console.log('Auth Callback Debug:', { code: !!code, type, next })

    // 1. Handle errors forwarded by Supabase in the URL
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error || errorDescription) {
        console.error('Auth Callback Error:', error, errorDescription)
        const msg = errorDescription || error || 'Authentication failed'
        return NextResponse.redirect(`${origin}/auth/login?error=${encodeURIComponent(msg)}`)
    }

    // 2. Process the PKCE code
    if (code) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll()
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            )
                        } catch {
                            // This can be ignored if middleware is handling cookie refreshes
                        }
                    },
                },
            }
        )

        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!exchangeError) {
            // Determine final destination
            // Forced fallback for password recovery often arrives without 'next'
            const finalDestination = type === 'recovery' ? '/auth/reset-password' : next

            console.log('Auth Success, Redirecting to:', finalDestination)
            return NextResponse.redirect(`${origin}${finalDestination}`)
        }

        // Handle exchange failure (e.g., token already used or expired)
        console.error('Code Exchange Failure:', exchangeError)
        return NextResponse.redirect(
            `${origin}/auth/login?error=${encodeURIComponent('The link is invalid or has expired.')}`
        )
    }

    // 3. Fallback for missing code
    // This happens if the link is clicked but contains no PKCE code
    console.warn('Auth Callback: Missing code parameter')
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`)
}
