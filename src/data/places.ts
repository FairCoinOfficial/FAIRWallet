/**
 * Sample list of places that accept FairCoin.
 *
 * This is a hardcoded seed used by the "Places that accept FairCoin" map
 * screen while there is no backend directory. Coordinates are sourced from
 * publicly-known FairCoop community nodes and partner locations (mostly in
 * Spain, where the FairCoin community is historically concentrated), plus a
 * few international entries so the map is visibly populated anywhere.
 *
 * When a real directory backend lands, replace the static `PLACES` array
 * with a fetched/cached collection and keep the `Place` type + helpers.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlaceCategory =
  | "cafe"
  | "restaurant"
  | "shop"
  | "service"
  | "atm"
  | "other";

export interface Place {
  /** Stable, unique identifier (also used as the map marker id). */
  id: string;
  /** Display name of the place. */
  name: string;
  /** High-level category used for iconography and filtering. */
  category: PlaceCategory;
  /** Optional short description or tagline. */
  description?: string;
  /** Street address (single line). */
  address: string;
  /** City / town. */
  city: string;
  /** ISO country name. */
  country: string;
  /** Latitude in degrees (WGS84). */
  latitude: number;
  /** Longitude in degrees (WGS84). */
  longitude: number;
  /** Optional remote logo URL. */
  logoUrl?: string;
  /** Optional website URL. */
  website?: string;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const PLACES: readonly Place[] = [
  {
    id: "bar-rosa-barcelona",
    name: "Bar Rosa",
    category: "restaurant",
    description: "Tapas bar in Gracia accepting FairCoin.",
    address: "Carrer de Verdi, 7",
    city: "Barcelona",
    country: "Spain",
    latitude: 41.4036,
    longitude: 2.1557,
  },
  {
    id: "calafou-colonia",
    name: "Calafou",
    category: "service",
    description: "Post-capitalist eco-industrial colony.",
    address: "Ctra. de la Pobla de Claramunt, s/n",
    city: "Vallbona d'Anoia",
    country: "Spain",
    latitude: 41.5394,
    longitude: 1.692,
    website: "https://calafou.org",
  },
  {
    id: "cafe-comercial-madrid",
    name: "Café Fair",
    category: "cafe",
    description: "Specialty coffee shop supporting cooperative projects.",
    address: "Calle de Fuencarral, 124",
    city: "Madrid",
    country: "Spain",
    latitude: 40.4313,
    longitude: -3.7024,
  },
  {
    id: "ecoxarxa-valencia",
    name: "Ecoxarxa València",
    category: "shop",
    description: "Cooperative market with local organic produce.",
    address: "Carrer de la Reina, 45",
    city: "Valencia",
    country: "Spain",
    latitude: 39.4609,
    longitude: -0.3254,
  },
  {
    id: "faircoop-bilbao",
    name: "FairCoop Bilbao",
    category: "service",
    description: "Local FairCoop hub and exchange point.",
    address: "Kale Nagusia, 20",
    city: "Bilbao",
    country: "Spain",
    latitude: 43.2612,
    longitude: -2.9253,
  },
  {
    id: "fair-atm-sevilla",
    name: "Fair ATM Sevilla",
    category: "atm",
    description: "FairCoin cash-in / cash-out point.",
    address: "Calle Sierpes, 48",
    city: "Seville",
    country: "Spain",
    latitude: 37.3891,
    longitude: -5.9931,
  },
  {
    id: "panaderia-zaragoza",
    name: "Panadería Justa",
    category: "shop",
    description: "Artisan bakery and community-supported grocery.",
    address: "Calle Alfonso I, 15",
    city: "Zaragoza",
    country: "Spain",
    latitude: 41.6523,
    longitude: -0.8782,
  },
  {
    id: "cooperativa-malaga",
    name: "Cooperativa Verde",
    category: "shop",
    description: "Organic food cooperative.",
    address: "Calle Larios, 5",
    city: "Málaga",
    country: "Spain",
    latitude: 36.7213,
    longitude: -4.4214,
  },
  {
    id: "taller-granada",
    name: "Taller Cooperativo",
    category: "service",
    description: "Bike and electronics repair workshop.",
    address: "Calle Elvira, 41",
    city: "Granada",
    country: "Spain",
    latitude: 37.1773,
    longitude: -3.5986,
  },
  {
    id: "restaurante-vegetal-palma",
    name: "Restaurante Vegetal",
    category: "restaurant",
    description: "Plant-based restaurant, FairCoin friendly.",
    address: "Carrer dels Oms, 22",
    city: "Palma",
    country: "Spain",
    latitude: 39.5741,
    longitude: 2.6503,
  },
  {
    id: "kafeneio-athens",
    name: "Kafeneio Koinos",
    category: "cafe",
    description: "Community café in Exarcheia.",
    address: "Themistokleous 70",
    city: "Athens",
    country: "Greece",
    latitude: 37.9869,
    longitude: 23.7303,
  },
  {
    id: "markthalle-berlin",
    name: "Markthalle Fair",
    category: "shop",
    description: "Weekly cooperative market stall.",
    address: "Eisenbahnstraße 42",
    city: "Berlin",
    country: "Germany",
    latitude: 52.5052,
    longitude: 13.4271,
  },
  {
    id: "cafe-ljubljana",
    name: "Café Metelkova",
    category: "cafe",
    description: "Autonomous cultural center café.",
    address: "Masarykova cesta 24",
    city: "Ljubljana",
    country: "Slovenia",
    latitude: 46.0569,
    longitude: 14.5142,
  },
  {
    id: "fair-hub-lisbon",
    name: "Fair Hub Lisboa",
    category: "service",
    description: "Co-working and FairCoin exchange point.",
    address: "Rua das Janelas Verdes, 9",
    city: "Lisbon",
    country: "Portugal",
    latitude: 38.706,
    longitude: -9.1605,
  },
  {
    id: "cooperativa-porto",
    name: "Cooperativa do Porto",
    category: "shop",
    description: "Consumer cooperative accepting FairCoin.",
    address: "Rua de Santa Catarina, 312",
    city: "Porto",
    country: "Portugal",
    latitude: 41.1499,
    longitude: -8.6073,
  },
  {
    id: "fair-atm-paris",
    name: "Fair ATM Paris",
    category: "atm",
    description: "FairCoin exchange kiosk.",
    address: "Rue de Belleville, 55",
    city: "Paris",
    country: "France",
    latitude: 48.8724,
    longitude: 2.3767,
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Compute the great-circle distance between two coordinates in kilometres
 * using the Haversine formula.
 *
 * This is an approximation (treats the Earth as a perfect sphere) but it is
 * more than accurate enough for the "how far is this café" use-case and
 * avoids pulling in a third-party geolib.
 */
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}
