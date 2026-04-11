/**
 * DNS seed resolution for discovering FairCoin P2P peers.
 *
 * Strategies (in order of preference):
 *  1. Native DNS via Node.js `dns` module (Electron only, provided via IPC)
 *  2. DNS-over-HTTPS (DoH) using Cloudflare or Google (works on mobile & web)
 *  3. Hardcoded fallback peers (last resort)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** DNS resolver provided by the Electron main process via IPC. */
export interface NativeDnsResolver {
  resolve4(hostname: string): Promise<string[]>;
}

interface DoHAnswer {
  type: number;
  data: string;
}

interface DoHResponse {
  Answer?: DoHAnswer[];
}

// ---------------------------------------------------------------------------
// Hardcoded fallback peers
// ---------------------------------------------------------------------------

const FALLBACK_PEERS: ReadonlyArray<string> = [
  "185.117.75.34",
  "185.117.75.35",
  "45.32.144.91",
  "104.238.159.110",
];

// ---------------------------------------------------------------------------
// DNS-over-HTTPS resolvers
// ---------------------------------------------------------------------------

const DOH_ENDPOINTS: ReadonlyArray<string> = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

/**
 * Resolve a hostname to IPv4 addresses using DNS-over-HTTPS.
 * Tries each DoH endpoint in order until one succeeds.
 */
async function resolveViaDoH(hostname: string): Promise<string[]> {
  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const url = `${endpoint}?name=${encodeURIComponent(hostname)}&type=A`;
      const response = await fetch(url, {
        headers: { Accept: "application/dns-json" },
      });

      if (!response.ok) {
        continue;
      }

      const json: DoHResponse = await response.json() as DoHResponse;

      if (!json.Answer || json.Answer.length === 0) {
        continue;
      }

      // Type 1 = A record (IPv4)
      const ipv4Addresses = json.Answer
        .filter((answer: DoHAnswer) => answer.type === 1)
        .map((answer: DoHAnswer) => answer.data);

      if (ipv4Addresses.length > 0) {
        return ipv4Addresses;
      }
    } catch {
      // Individual DoH endpoint failed (network error, timeout, etc.)
      // — try the next endpoint in the list.
      continue;
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve DNS seed hostnames into peer IP addresses.
 *
 * @param seeds - Array of DNS seed hostnames (e.g. ["seed1.fairco.in"])
 * @param nativeResolver - Optional native DNS resolver (Electron only)
 * @returns Array of unique IPv4 address strings
 */
export async function resolveDNSSeeds(
  seeds: readonly string[],
  nativeResolver?: NativeDnsResolver,
): Promise<string[]> {
  const allAddresses = new Set<string>();

  // Resolve all seeds concurrently
  const results = await Promise.allSettled(
    seeds.map(async (seed) => {
      // Try native resolver first (Electron)
      if (nativeResolver) {
        try {
          return await nativeResolver.resolve4(seed);
        } catch {
          // Native DNS resolution failed for this seed — fall through to DoH.
        }
      }

      // Fall back to DNS-over-HTTPS
      return resolveViaDoH(seed);
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const addr of result.value) {
        allAddresses.add(addr);
      }
    }
  }

  // If DNS resolution returned nothing, use fallback peers
  if (allAddresses.size === 0) {
    for (const addr of FALLBACK_PEERS) {
      allAddresses.add(addr);
    }
  }

  return Array.from(allAddresses);
}

/**
 * Get the hardcoded fallback peer addresses.
 */
export function getFallbackPeers(): readonly string[] {
  return FALLBACK_PEERS;
}
