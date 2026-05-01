// pages/api/venues.js
// Proxies Google Places Nearby Search server-side
// Google API key never exposed to the browser

const CATEGORY_MAP = {
  cafe:       'cafe',
  restaurant: 'restaurant',
  bar:        'bar',
  park:       'park',
  mall:       'shopping_mall',
  dessert:    'bakery',
};

export default async function handler(req, res) {
  const { lat, lng, category } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat/lng' });
  }

  const type = CATEGORY_MAP[category] || 'cafe';
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const radius = 1500; // 1.5km around midpoint

  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Google Places responded with ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places error: ${data.status}`);
    }

    const venues = (data.results || []).slice(0, 5).map(place => ({
      name: place.name,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || 0,
      address: place.vicinity,
      placeId: place.place_id,
      lat: place.geometry.location.lat,
      lng: place.geometry.location.lng,
      isOpen: place.opening_hours?.open_now ?? null,
      priceLevel: place.price_level ?? null,
      photo: place.photos?.[0]?.photo_reference || null,
    }));

    return res.status(200).json({ venues });

  } catch (err) {
    console.error('Venues error:', err);
    return res.status(500).json({ error: 'Venue search failed' });
  }
}
