/**
 * Outbound number selection for local presence: dial from the owned number
 * whose area code is closest to the prospect's, so the call looks local.
 *
 * Pure + framework-free so it is unit-testable independent of telephony.
 * Algorithm: exact area-code match -> same state -> nearest centroid -> first.
 */

export interface OutboundNumber {
  e164: string;
  areaCode: string;
  region?: string;
  active?: boolean;
}

interface Centroid {
  state: string;
  lat: number;
  lng: number;
}

/**
 * NANP area-code centroids. Not exhaustive — covers the oil-patch states we care
 * about plus major metros, and degrades gracefully for codes not listed (they
 * just fall through to the "first active" branch). Extend as numbers are added.
 */
export const AREA_CODE_CENTROIDS: Record<string, Centroid> = {
  // West Texas / Permian
  "432": { state: "TX", lat: 31.99, lng: -102.08 }, // Midland/Odessa
  "325": { state: "TX", lat: 32.45, lng: -99.73 }, // Abilene/San Angelo
  "806": { state: "TX", lat: 33.58, lng: -101.86 }, // Lubbock/Amarillo
  // Texas metros
  "214": { state: "TX", lat: 32.78, lng: -96.8 },
  "469": { state: "TX", lat: 32.78, lng: -96.8 },
  "972": { state: "TX", lat: 32.9, lng: -96.84 },
  "817": { state: "TX", lat: 32.75, lng: -97.33 },
  "682": { state: "TX", lat: 32.75, lng: -97.33 },
  "713": { state: "TX", lat: 29.76, lng: -95.37 },
  "281": { state: "TX", lat: 29.76, lng: -95.37 },
  "832": { state: "TX", lat: 29.76, lng: -95.37 },
  "346": { state: "TX", lat: 29.76, lng: -95.37 },
  "512": { state: "TX", lat: 30.27, lng: -97.74 },
  "737": { state: "TX", lat: 30.27, lng: -97.74 },
  "210": { state: "TX", lat: 29.42, lng: -98.49 },
  "726": { state: "TX", lat: 29.42, lng: -98.49 },
  "361": { state: "TX", lat: 27.8, lng: -97.4 },
  "409": { state: "TX", lat: 29.9, lng: -93.94 },
  "915": { state: "TX", lat: 31.76, lng: -106.49 }, // El Paso
  "940": { state: "TX", lat: 33.91, lng: -98.49 },
  "903": { state: "TX", lat: 32.35, lng: -95.3 },
  "979": { state: "TX", lat: 30.63, lng: -96.33 },
  "254": { state: "TX", lat: 31.55, lng: -97.15 },
  // New Mexico
  "575": { state: "NM", lat: 32.69, lng: -103.13 }, // Hobbs/Carlsbad
  "505": { state: "NM", lat: 35.08, lng: -106.65 }, // Albuquerque
  // Oklahoma
  "405": { state: "OK", lat: 35.47, lng: -97.52 },
  "580": { state: "OK", lat: 34.61, lng: -98.39 },
  "918": { state: "OK", lat: 36.15, lng: -95.99 },
  "539": { state: "OK", lat: 36.15, lng: -95.99 },
  // Louisiana
  "318": { state: "LA", lat: 32.51, lng: -93.75 },
  "337": { state: "LA", lat: 30.22, lng: -92.02 },
  "225": { state: "LA", lat: 30.45, lng: -91.19 },
  "504": { state: "LA", lat: 29.95, lng: -90.07 },
  // Kansas
  "316": { state: "KS", lat: 37.69, lng: -97.34 },
  "620": { state: "KS", lat: 37.04, lng: -98.0 },
  "785": { state: "KS", lat: 39.05, lng: -95.69 },
  "913": { state: "KS", lat: 39.11, lng: -94.74 },
  // Colorado
  "970": { state: "CO", lat: 40.42, lng: -104.71 }, // Greeley/DJ Basin
  "303": { state: "CO", lat: 39.74, lng: -104.99 },
  "720": { state: "CO", lat: 39.74, lng: -104.99 },
  "719": { state: "CO", lat: 38.83, lng: -104.82 },
  // Wyoming / North Dakota / Montana
  "307": { state: "WY", lat: 42.85, lng: -106.32 }, // Casper
  "701": { state: "ND", lat: 47.92, lng: -103.3 }, // Williston basin
  "406": { state: "MT", lat: 46.6, lng: -112.04 },
  // Other majors (fallback diversity)
  "212": { state: "NY", lat: 40.71, lng: -74.01 },
  "312": { state: "IL", lat: 41.88, lng: -87.63 },
  "213": { state: "CA", lat: 34.05, lng: -118.24 },
  "415": { state: "CA", lat: 37.77, lng: -122.42 },
  "602": { state: "AZ", lat: 33.45, lng: -112.07 },
};

/** Best-effort NANP area code from a phone string. */
export function areaCodeOf(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return national.length >= 10 ? national.slice(0, 3) : null;
}

function haversine(a: Centroid, b: Centroid): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(h)); // proportional to distance; units irrelevant
}

/**
 * Choose the best outbound number for a target area code:
 * exact match -> same state -> nearest centroid -> first active number.
 */
export function pickOutboundNumber(
  targetAreaCode: string | null,
  numbers: OutboundNumber[]
): OutboundNumber | null {
  const active = numbers.filter((n) => n.active !== false);
  if (active.length === 0) return null;

  if (targetAreaCode) {
    const exact = active.find((n) => n.areaCode === targetAreaCode);
    if (exact) return exact;

    const target = AREA_CODE_CENTROIDS[targetAreaCode];
    if (target) {
      const sameState = active.filter(
        (n) => AREA_CODE_CENTROIDS[n.areaCode]?.state === target.state
      );
      const pool = (sameState.length ? sameState : active).filter(
        (n) => AREA_CODE_CENTROIDS[n.areaCode]
      );
      if (pool.length > 0) {
        let best = pool[0];
        let bestDist = Infinity;
        for (const n of pool) {
          const c = AREA_CODE_CENTROIDS[n.areaCode];
          const d = c ? haversine(target, c) : Infinity;
          if (d < bestDist) {
            bestDist = d;
            best = n;
          }
        }
        return best;
      }
    }
  }

  return active[0];
}
