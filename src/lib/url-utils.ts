/**
 * Utility functions for handling URLs in different deployment scenarios
 */

/**
 * Gets the base URL for the application
 * Works in both client and server environments
 */
export function getBaseUrl(): string {
  // In browser, use relative URLs
  if (typeof window !== 'undefined') {
    return '';
  }

  // On server, try to determine the base URL from environment
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback for development
  return 'http://localhost:3000';
}

/**
 * Creates an absolute URL for API calls
 * @param path - The API path (e.g., '/api/rooms')
 * @returns Complete URL for the API endpoint
 */
export function createApiUrl(path: string): string {
  const baseUrl = getBaseUrl();
  
  // If we're in the browser, use relative URLs
  if (typeof window !== 'undefined') {
    return path;
  }

  // On server, create absolute URL
  return `${baseUrl}${path}`;
}

/**
 * Creates a client-safe fetch function that works in all environments
 * @param path - API path
 * @param options - Fetch options
 */
export async function apiRequest(path: string, options?: RequestInit) {
  const url = createApiUrl(path);
  
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
}

/**
 * For deployment scenarios where the app might be served from a subdirectory
 */
export function getAssetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return `${basePath}${path}`;
} 