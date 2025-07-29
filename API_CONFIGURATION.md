# API Configuration Guide

This document explains how the API URLs are configured in the frontend application.

## Environment Variables

The application uses environment variables to configure API endpoints dynamically:

### Required Environment Variables

- `NEXT_PUBLIC_API_URL`: The base URL for your backend API

### Configuration Files

1. **`.env`** - Local development configuration
2. **`.env.example`** - Template showing required variables
3. **`src/lib/api-config.ts`** - Centralized API configuration

## Usage Examples

### Local Development
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Production
```bash
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

### Development with ngrok
```bash
NEXT_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app/api
```

## API Endpoints Structure

All API endpoints are centrally managed in `src/lib/api-config.ts`:

- **AUTH_ENDPOINTS**: Authentication related endpoints
- **MASTER_ENDPOINTS**: Master data endpoints (users, clients, papers, orders)
- **PRODUCTION_ENDPOINTS**: Production and planning endpoints

## Benefits of This Approach

1. **Environment Flexibility**: Easy to switch between development, staging, and production
2. **Centralized Management**: All API URLs in one place
3. **Type Safety**: TypeScript interfaces for all API calls
4. **Consistent Headers**: Standardized request headers across all API calls
5. **Easy Maintenance**: Single point of configuration for URL changes

## Migration Completed

✅ All hardcoded URLs have been replaced with dynamic configuration
✅ Centralized API configuration implemented
✅ Environment variable support added
✅ Example configuration provided

## Files Updated

- `src/lib/users.ts` - Removed hardcoded ngrok URLs
- `src/lib/api-config.ts` - Already properly configured
- All other lib files - Already using centralized configuration
- All page components - Already using centralized configuration