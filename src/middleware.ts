/**
 * Middleware to protect routes that require authentication
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
  '/orders',
  '/inventory',
  '/cutting-plans',
];

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Check if the path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    path === route || path.startsWith(`${route}/`)
  );
  
  // If it's not a protected route, allow the request
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // Get the session token from cookies or headers
  const sessionToken = request.cookies.get('sessionToken')?.value;
  
  // If there's no session token, redirect to login
  if (!sessionToken) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', path);
    return NextResponse.redirect(loginUrl);
  }
  
  // Allow the request to continue
  return NextResponse.next();
}

// Configure the middleware to run on specific paths
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/orders/:path*',
    '/inventory/:path*',
    '/cutting-plans/:path*',
  ],
};