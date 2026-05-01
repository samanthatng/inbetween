// pages/api/geocode.js
// Proxies postal code lookups to OneMap API
// Keys never exposed to the browser

export default async function handler(req, res) {
  const { postal } = req.query;

  if (!postal) {
    return res.status(400).json({ error: 'Missing postal code' });
  }

  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(postal)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

    const response = await fetch(url, {
      headers: {
        'Authorization': process.env.ONEMAP_TOKEN,
      },
    });

    if (!response.ok) {
      throw new Error(`OneMap responded with ${response.status}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'Postal code not found' });
    }

    const result = data.results[0];
    return res.status(200).json({
      lat: parseFloat(result.LATITUDE),
      lng: parseFloat(result.LONGITUDE),
      address: result.ADDRESS,
      building: result.BUILDING,
      postalCode: result.POSTAL,
    });

  } catch (err) {
    console.error('Geocode error:', err);
    return res.status(500).json({ error: 'Geocoding failed' });
  }
}
