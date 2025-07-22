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

// Define public routes that don't require authentication
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/',
];

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;
  
  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some(route => 
    path === route || path.startsWith(`${route}/`)
  );
  
  // If it's a public route, allow the request
  if (isPublicRoute) {
    return NextResponse.next();
  }
  
  // Check if the path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    path === route || path.startsWith(`${route}/`)
  );
  
  // If it's not a protected route, allow the request
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // For protected routes, we'll handle the redirection in the client-side
  // since we can't access localStorage in middleware
  return NextResponse.next();
}

// Configure the middleware to run on all routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};