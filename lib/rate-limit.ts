/**
 * Simple in-memory per-theme rate limiter
 *
 * This limits download count increments to prevent artificial inflation.
 * Key format: {ip}:{author}/{slug} for per-theme tracking
 *
 * Note: This works for single Vercel instance. For multi-instance deployments,
 * each instance maintains its own cache, which provides partial protection.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private cache: Map<string, RateLimitEntry> = new Map();
  private maxEntries: number;
  private windowMs: number;
  private maxRequests: number;

  constructor(
    options: {
      maxEntries?: number;
      windowMs?: number;
      maxRequests?: number;
    } = {},
  ) {
    this.maxEntries = options.maxEntries ?? 10000; // Max keys to track
    this.windowMs = options.windowMs ?? 30 * 60 * 1000; // 30 minute window
    this.maxRequests = options.maxRequests ?? 1; // 1 request per window
  }

  /**
   * Check if the given key is rate limited
   * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked
   */
  check(key: string): { limited: boolean; retryAfter?: number } {
    const now = Date.now();

    // Clean up expired entries periodically (1 in 100 requests)
    if (Math.random() < 0.01) {
      this.cleanup(now);
    }

    const entry = this.cache.get(key);

    if (!entry || now > entry.resetAt) {
      // New window - allow and create entry
      this.cache.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });

      // Enforce max entries (simple LRU: delete oldest)
      if (this.cache.size > this.maxEntries) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey !== undefined) {
          this.cache.delete(firstKey);
        }
      }

      return { limited: false };
    }

    if (entry.count >= this.maxRequests) {
      // Rate limited
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { limited: true, retryAfter };
    }

    // Increment count
    entry.count++;
    return { limited: false };
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetAt) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Per-theme rate limiter for download count increments
 * Allows 1 download increment per IP per theme per 30 minutes
 * This prevents inflating a specific theme's count while allowing normal usage
 */
export const downloadRateLimiter = new RateLimiter({
  maxEntries: 10000,
  windowMs: 30 * 60 * 1000, // 30 minutes
  maxRequests: 1, // 1 per theme per window
});

/**
 * Get client IP from request headers
 * Vercel sets x-forwarded-for, fallback to x-real-ip
 */
export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, get the first one
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback (shouldn't happen in production)
  return "unknown";
}
