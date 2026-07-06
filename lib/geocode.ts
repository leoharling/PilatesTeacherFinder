// City-level geocoding via Nominatim (OpenStreetMap). One request per intake
// submission — far below the 1 req/s rate limit. Failure is non-fatal: the
// teacher is saved without coordinates and flagged in the admin.
export async function geocode(
  postalCode: string,
  city: string,
  country: string
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    postalcode: postalCode,
    city,
    country,
    format: 'jsonv2',
    limit: '1',
  });
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': 'PilatesTeacherFinder/1.0 (leoharling@gmx.de)',
        },
      }
    );
    if (!res.ok) return null;
    const results = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!Array.isArray(results) || results.length === 0) return null;
    const lat = Number.parseFloat(results[0].lat);
    const lng = Number.parseFloat(results[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
