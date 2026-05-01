// pages/results/[postalA]/[postalB]/[category].js
// Shared results page — both User 1 and User 2 open this URL and see the same thing
// URL: inbetween.sg/results/068896/310123/cafe

import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

const CATEGORY_ICONS = {
  cafe: '☕', restaurant: '🍜', bar: '🍻',
  park: '🌿', mall: '🛍️', dessert: '🍦',
};
const PRICE_LABELS = ['', '$', '$$', '$$$', '$$$$'];

function distKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function midpoint(a, b) {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

export default function ResultsPage() {
  const router = useRouter();
  const { postalA, postalB, category } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  const catIcon = CATEGORY_ICONS[category] || '📍';
  const catLabel = category ? category.charAt(0).toUpperCase() + category.slice(1) : '';
  const shareUrl = `https://inbetween.sg/results/${postalA}/${postalB}/${category}`;

  // Load results as soon as we have the route params
  useEffect(() => {
    if (!postalA || !postalB || !category) return;
    loadResults();
  }, [postalA, postalB, category]);

  // Init map when results ready
  useEffect(() => {
    if (!results || !window.google) return;
    const { mid, coordA, coordB, venues } = results;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: mid, zoom: 14,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { elementType: 'geometry', stylers: [{ color: '#f4f7f2' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dfc4' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e8f0e4' }] },
        ],
        disableDefaultUI: true, zoomControl: true,
      });
    } else {
      mapInstanceRef.current.setCenter(mid);
    }

    setTimeout(() => {
      if (mapInstanceRef.current) {
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
        mapInstanceRef.current.setCenter(mid);
      }
    }, 100);

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    const map = mapInstanceRef.current;

    markersRef.current.push(new window.google.maps.Marker({
      position: coordA, map,
      label: { text: 'A', color: 'white', fontWeight: 'bold', fontSize: '12px' },
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#3A7A6A', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    }));
    markersRef.current.push(new window.google.maps.Marker({
      position: coordB, map,
      label: { text: 'B', color: 'white', fontWeight: 'bold', fontSize: '12px' },
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#7BAF6F', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    }));
    markersRef.current.push(new window.google.maps.Marker({
      position: mid, map,
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#4A7C45', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
    }));
    venues.forEach((v, i) => {
      markersRef.current.push(new window.google.maps.Marker({
        position: { lat: v.lat, lng: v.lng }, map,
        label: { text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#1A2618', fillOpacity: 0.85, strokeColor: '#fff', strokeWeight: 1.5 },
      }));
    });
  }, [results]);

  async function loadResults() {
    setLoading(true);
    setError('');
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/geocode?postal=${postalA}`).then(r => r.json()),
        fetch(`/api/geocode?postal=${postalB}`).then(r => r.json()),
      ]);

      if (resA.error) throw new Error('Could not find location A');
      if (resB.error) throw new Error('Could not find location B');

      const coordA = { lat: resA.lat, lng: resA.lng };
      const coordB = { lat: resB.lat, lng: resB.lng };
      const mid = midpoint(coordA, coordB);
      const dist = distKm(coordA, coordB);

      const venueRes = await fetch(`/api/venues?lat=${mid.lat}&lng=${mid.lng}&category=${category}`).then(r => r.json());
      if (venueRes.error) throw new Error(venueRes.error);

      const venues = venueRes.venues.map(v => ({
        ...v,
        distFromMid: distKm(mid, { lat: v.lat, lng: v.lng }),
      }));

      setResults({
        coordA, coordB, mid, dist, venues,
        labelA: resA.address, labelB: resB.address,
      });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://wa.me/?text=Here%20are%20our%20meetup%20spots%20%F0%9F%93%8D%20${url}`);
  }

  return (
    <>
      <Head>
        <title>inbetween.sg — our meetup spots</title>
        <meta name="description" content="Here are the spots inbetween you both. Open this link to see the same results." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        <script src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`} async />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --cream: #F4F7F2; --warm-white: #F8FAF6; --sand: #DDE8D8; --tan: #B8CCAF;
          --brown: #5C7A52; --dark: #1A2618;
          --accent: #4A7C45; --accent-light: #DFF0DA; --accent-dark: #2F5C2A;
          --matcha: #7BAF6F; --matcha-pale: #EBF4E7; --sage: #8FAF84;
          --teal: #3A7A6A; --radius: 16px; --radius-sm: 10px;
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'DM Sans', sans-serif; background: var(--cream); color: var(--dark); min-height: 100vh; font-size: 15px; line-height: 1.6; }

        nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(244,247,242,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--sand); padding: 0 2rem; height: 60px; display: flex; align-items: center; justify-content: space-between; }
        .nav-logo { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 400; color: var(--dark); letter-spacing: -0.3px; text-decoration: none; }
        .nav-logo span { color: var(--matcha); font-style: italic; }

        .hero { padding: 100px 2rem 40px; text-align: center; max-width: 640px; margin: 0 auto; }
        .hero-eyebrow { display: inline-flex; align-items: center; gap: 6px; background: var(--matcha-pale); color: var(--accent-dark); border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 500; margin-bottom: 1rem; }
        .hero-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--matcha); }
        .hero h1 { font-family: 'Fraunces', serif; font-size: clamp(28px, 5vw, 44px); font-weight: 300; line-height: 1.15; letter-spacing: -0.8px; margin-bottom: 0.75rem; }
        .hero h1 em { font-style: italic; color: var(--matcha); }
        .hero p { font-size: 14px; color: var(--brown); line-height: 1.7; font-weight: 300; }

        /* Location pills */
        .location-pills { display: flex; align-items: center; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 1.25rem auto 0; max-width: 640px; padding: 0 2rem; }
        .loc-pill { display: flex; align-items: center; gap: 6px; background: var(--warm-white); border: 1px solid var(--sand); border-radius: 20px; padding: 6px 14px; font-size: 12px; color: var(--dark); }
        .loc-pill .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .loc-pill .dot.a { background: var(--teal); }
        .loc-pill .dot.b { background: var(--matcha); }
        .loc-divider { font-size: 12px; color: var(--tan); }

        /* Loading */
        .loading-state { text-align: center; padding: 4rem 2rem; }
        .loading-state p { font-size: 14px; color: var(--brown); margin-top: 1rem; }
        .loading-dots span { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--matcha); margin: 0 3px; animation: bounce 1.2s infinite ease-in-out; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }

        .error-msg { max-width: 640px; margin: 2rem auto; padding: 10px 14px; background: #fef0f0; border: 1px solid #f5c6c6; border-radius: var(--radius-sm); font-size: 13px; color: #c0392b; text-align: center; }

        /* Results */
        .results-section { max-width: 640px; margin: 1.5rem auto 0; padding: 0 0 2rem; }
        .map-container { border-radius: var(--radius); height: 320px; overflow: hidden; position: relative; margin-bottom: 1.5rem; border: 1px solid var(--sand); background: var(--sand); }
        .map-container > div { width: 100%; height: 320px; display: block; }
        .midpoint-badge { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%); background: white; border-radius: 20px; padding: 6px 16px; font-size: 12px; font-weight: 500; color: var(--dark); box-shadow: 0 2px 12px rgba(0,0,0,0.12); display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .badge-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--matcha); flex-shrink: 0; }

        .venues-header { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 1rem; }
        .venues-header h2 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 400; letter-spacing: -0.3px; }
        .venues-header span { font-size: 12px; color: var(--brown); }
        .venues-grid { display: flex; flex-direction: column; gap: 10px; }

        .venue-card { background: var(--warm-white); border: 1px solid var(--sand); border-radius: var(--radius-sm); padding: 14px 16px; display: flex; align-items: center; gap: 14px; transition: border-color 0.2s, box-shadow 0.2s; text-decoration: none; color: inherit; }
        .venue-card:hover { border-color: var(--matcha); box-shadow: 0 2px 16px rgba(74,124,69,0.12); }
        .venue-card.featured { border-color: var(--accent); border-width: 1.5px; }
        .venue-num { width: 28px; height: 28px; border-radius: 50%; background: var(--dark); color: white; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .venue-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; background: var(--cream); }
        .venue-info { flex: 1; min-width: 0; }
        .venue-name { font-weight: 500; font-size: 14px; margin-bottom: 3px; }
        .venue-meta { font-size: 12px; color: var(--brown); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .sep { color: var(--tan); }
        .venue-dist { font-size: 11px; font-weight: 500; color: var(--accent); }
        .venue-badge { font-size: 10px; font-weight: 500; background: var(--matcha-pale); color: var(--accent-dark); border-radius: 6px; padding: 2px 8px; white-space: nowrap; }
        .open-badge { font-size: 10px; font-weight: 500; background: #e8f5e9; color: #2e7d32; border-radius: 6px; padding: 2px 8px; }
        .closed-badge { font-size: 10px; font-weight: 500; background: #fce4e4; color: #c62828; border-radius: 6px; padding: 2px 8px; }
        .star { color: #7BAF6F; }

        /* Share strip */
        .share-strip { margin-top: 1.5rem; background: var(--dark); border-radius: var(--radius); padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .share-left h3 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 16px; color: white; margin-bottom: 2px; }
        .share-left p { font-size: 12px; color: var(--sage); }
        .share-url { font-size: 11px; background: rgba(255,255,255,0.08); border-radius: 6px; padding: 5px 10px; color: var(--sage); font-family: monospace; margin-top: 6px; display: inline-block; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .share-btns { display: flex; gap: 8px; }
        .share-btn { padding: 9px 18px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s; }
        .share-btn:hover { opacity: 0.85; }
        .share-btn.copy { background: rgba(255,255,255,0.12); color: white; }
        .share-btn.wa { background: #25D366; color: white; }

        .try-own { margin-top: 1rem; margin-bottom: 3rem; text-align: center; padding: 1.25rem; background: var(--warm-white); border: 1px solid var(--sand); border-radius: var(--radius); }
        .try-own p { font-size: 13px; color: var(--brown); margin-bottom: 10px; }
        .try-own a { display: inline-block; background: var(--dark); color: white; border-radius: 20px; padding: 9px 20px; font-size: 13px; font-weight: 500; text-decoration: none; }

        footer { border-top: 1px solid var(--sand); padding: 1.5rem 2rem; text-align: center; font-size: 12px; color: var(--tan); }
        footer a { color: var(--brown); text-decoration: none; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease forwards; }

        @media (max-width: 600px) {
          nav { padding: 0 1rem; }
          .hero { padding: 85px 1rem 30px; }
          .results-section { margin: 1rem 1rem 0; }
          .share-strip { flex-direction: column; align-items: flex-start; }
          .location-pills { padding: 0 1rem; }
        }
      `}</style>

      <nav>
        <a href="/" className="nav-logo">in<span>between</span>.sg</a>
      </nav>

      <section className="hero">
        <div className="hero-eyebrow"><div className="hero-dot" /> shared results</div>
        <h1>Your <em>inbetween</em> spots</h1>
        <p>Both of you can see these — open this link anytime to come back to your results.</p>
      </section>

      {/* Location pills */}
      {postalA && postalB && (
        <div className="location-pills">
          <div className="loc-pill"><div className="dot a" /> {postalA}</div>
          <div className="loc-divider">↔</div>
          <div className="loc-pill"><div className="dot b" /> {postalB}</div>
          <div className="loc-divider">·</div>
          <div className="loc-pill">{catIcon} {catLabel}</div>
        </div>
      )}

      {loading && (
        <div className="loading-state">
          <div className="loading-dots"><span /><span /><span /></div>
          <p>Finding your inbetween spots…</p>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {results && (
        <div className="results-section fade-up" id="results-section">
          <div className="map-container">
            <div ref={mapRef} />
            <div className="midpoint-badge">
              <div className="badge-dot" />
              <span>{results.dist.toFixed(1)} km apart · midpoint found</span>
            </div>
          </div>

          <div className="venues-header">
            <h2>Spots near the middle</h2>
            <span>{results.venues.length} place{results.venues.length !== 1 ? 's' : ''} found</span>
          </div>

          <div className="venues-grid">
            {results.venues.length === 0 && (
              <p style={{ color: 'var(--brown)', fontSize: 14 }}>No {catLabel.toLowerCase()}s found near the midpoint.</p>
            )}
            {results.venues.map((v, i) => (
              <a
                key={v.placeId}
                className={`venue-card${i === 0 ? ' featured' : ''}`}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name)}&query_place_id=${v.placeId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="venue-num">{i + 1}</div>
                <div className="venue-icon">{catIcon}</div>
                <div className="venue-info">
                  <div className="venue-name">{v.name}</div>
                  <div className="venue-meta">
                    {v.rating && <><span className="star">★</span><span>{v.rating} ({v.totalRatings.toLocaleString()})</span><span className="sep">·</span></>}
                    {v.priceLevel && <><span>{PRICE_LABELS[v.priceLevel]}</span><span className="sep">·</span></>}
                    <span className="venue-dist">{v.distFromMid.toFixed(2)} km from midpoint</span>
                    {v.isOpen === true && <><span className="sep">·</span><span className="open-badge">Open now</span></>}
                    {v.isOpen === false && <><span className="sep">·</span><span className="closed-badge">Closed</span></>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--tan)', marginTop: 2 }}>{v.address}</div>
                </div>
                {i === 0 && <div className="venue-badge">Top pick</div>}
              </a>
            ))}
          </div>

          {/* Share strip */}
          <div className="share-strip">
            <div className="share-left">
              <h3>Share with your friend</h3>
              <p>Anyone with this link sees the same spots</p>
              <div className="share-url">{shareUrl}</div>
            </div>
            <div className="share-btns">
              <button className="share-btn copy" onClick={copyLink}>{copied ? 'Copied!' : 'Copy link'}</button>
              <button className="share-btn wa" onClick={shareWhatsApp}>WhatsApp</button>
            </div>
          </div>

          <div className="try-own">
            <p>Want to find your own inbetween spot? 🌿</p>
            <a href="/">Try inbetween.sg</a>
          </div>
        </div>
      )}

      <footer>
        <p>© 2026 inbetween.sg &nbsp;·&nbsp; Built in Singapore 🇸🇬</p>
      </footer>
    </>
  );
}
