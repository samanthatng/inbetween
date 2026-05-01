# inbetween.sg

Singapore's meetup recommender — find the perfect spot between two locations.

## Setup

### 1. Environment Variables

Create a `.env.local` file in the root (never commit this):

```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
ONEMAP_TOKEN=your_onemap_token_here
```

### 2. Vercel Deployment

In your Vercel project dashboard → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key (server-side) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Your Google Maps API key (client-side, for map display) |
| `ONEMAP_TOKEN` | Your OneMap API token |

### 3. APIs Required

Enable these in Google Cloud Console:
- Maps JavaScript API
- Places API
- Geocoding API

OneMap registration: https://developers.onemap.sg/register/

## Stack

- Next.js 14
- Google Maps JS SDK (interactive map)
- Google Places API (venue search, proxied server-side)
- OneMap API (Singapore postal code geocoding, proxied server-side)
