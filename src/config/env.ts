/** Central config — everything environment-specific comes from here, never hardcoded in features. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:2040';
