/**
 * Middleware to protect routes and implement role-based access control
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define role-based route permissions
const roleBasedRoutes = {
  admin: [
    '/roll-tracking',
    '/mou-reports',
    '/mou',
    '/dashboard',
    '/orders',
    '/inventory',
    '/cutting-plans',
    '/planning',
    '/masters',
    '/reports',
    '/weight-update',
    '/wastage',
    '/in-out',
    '/dispatch',
    '/past-dispatch',
    '/plan-weights',
    '/challan',
    '/qr-scanner',
    '/hour-calculator',
    '/settings'
  ],
  order_puncher: [
    '/masters/orders',
    '/masters/clients',
    '/masters/papers',
    '/hour-calculator',
  ],
  security: [
    '/in-out',
    '/hour-calculator',
    '/masters/materials',
    '/masters/clients',
  ],
  co_admin: [
    '/dashboard',
    '/orders',
    '/dispatch',
    '/masters'
  ],
  weight_update: [
    '/weight-update',
  ],
  mou: [
    '/mou',
    '/mou-reports',
    '/hour-calculator',
  ],
  production: [
    '/dashboard',
    '/reports',
    '/masters/pending-orders',
    '/qr-scanner',
    '/hour-calculator',
  ],
  accountant: [
    '/masters',
    '/weight-update',
    '/dispatch',
    '/reports',
    '/challan',
    '/past-dispatch',
    '/masters/',
    '/wastage/materials',
    '/in-out',
  ],
  dispatch: [
    '/dispatch',
    '/plan-weights',
    '/hour-calculator',
  ],
  sales_person: [
    '/masters/orders',
    '/masters/clients',
    '/masters/pending-orders',
    '/dispatch/history'
  ],
};

// Define public routes that don't require authentication
const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/',
  '/access-denied',
];

export function middleware(request: NextRequest) {
  // Get the path of the request
  const path = request.nextUrl.pathname;

  // Check if it's a static file (SVG, PNG, JPG, etc.)
  if (path.match(/.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$/)) {
    return NextResponse.next();
  }

  // Check if the path is a public route
  const isPublicRoute = publicRoutes.some(route =>
    path === route || path.startsWith(`${route}/`)
  );

  // If it's a public route, allow the request
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Get user role from cookies
  const userRole = request.cookies.get('user_role')?.value;
  const username = request.cookies.get('username')?.value;

  // If no auth info, redirect to login
  if (!username || !userRole) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', path);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user's role has access to this route
  const allowedRoutes = roleBasedRoutes[userRole as keyof typeof roleBasedRoutes];
  const hasAccess = allowedRoutes?.some(route =>
    path === route || path.startsWith(`${route}/`)
  );

  // If user doesn't have access, redirect to access denied page
  if (!hasAccess) {
    const accessDeniedUrl = new URL('/access-denied', request.url);
    return NextResponse.redirect(accessDeniedUrl);
  }

  return NextResponse.next();
}

// Configure the middleware to run on all routes
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};