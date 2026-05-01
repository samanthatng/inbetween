// pages/index.js
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const CATEGORY_ICONS = {
  cafe: '☕',
  restaurant: '🍜',
  bar: '🍻',
  park: '🌿',
  mall: '🛍️',
  dessert: '🍦',
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

export default function Home() {
  const [postalA, setPostalA] = useState('');
  const [postalB, setPostalB] = useState('');
  const [category, setCategory] = useState('cafe');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [shareCode] = useState(() => Math.random().toString(36).slice(2, 7));
  const [copied, setCopied] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  // Init Google Map once results are available
  useEffect(() => {
    if (!results || !window.google) return;

    const { mid, coordA, coordB, venues } = results;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
        center: mid,
        zoom: 14,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          { elementType: 'geometry', stylers: [{ color: '#f4f7f2' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c8dfc4' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e8f0e4' }] },
        ],
        disableDefaultUI: true,
        zoomControl: true,
      });
    } else {
      mapInstanceRef.current.setCenter(mid);
    }

    // Force map to resize after DOM settles
    setTimeout(() => {
      if (mapInstanceRef.current) {
        window.google.maps.event.trigger(mapInstanceRef.current, 'resize');
        mapInstanceRef.current.setCenter(mid);
      }
    }, 100);

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const map = mapInstanceRef.current;

    // Pin A
    markersRef.current.push(new window.google.maps.Marker({
      position: coordA, map,
      label: { text: 'A', color: 'white', fontWeight: 'bold', fontSize: '12px' },
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#3A7A6A', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    }));

    // Pin B
    markersRef.current.push(new window.google.maps.Marker({
      position: coordB, map,
      label: { text: 'B', color: 'white', fontWeight: 'bold', fontSize: '12px' },
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: '#7BAF6F', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 },
    }));

    // Midpoint
    markersRef.current.push(new window.google.maps.Marker({
      position: mid, map,
      icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#4A7C45', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2.5 },
    }));

    // Venue markers
    venues.forEach((v, i) => {
      markersRef.current.push(new window.google.maps.Marker({
        position: { lat: v.lat, lng: v.lng }, map,
        label: { text: String(i + 1), color: 'white', fontWeight: 'bold', fontSize: '11px' },
        icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 12, fillColor: '#1A2618', fillOpacity: 0.85, strokeColor: '#fff', strokeWeight: 1.5 },
      }));
    });

  }, [results]);

  async function handleContact(e) {
    e.preventDefault();
    setContactLoading(true);
    setContactError('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setContactSent(true);
      setContactForm({ name: '', email: '', message: '' });
    } catch (err) {
      setContactError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setContactLoading(false);
    }
  }

  async function handleFind() {
    setError('');
    if (!postalA || !postalB) {
      setError('Please enter both postal codes.');
      return;
    }
    if (!/^\d{6}$/.test(postalA) || !/^\d{6}$/.test(postalB)) {
      setError('Singapore postal codes are 6 digits, e.g. 068896');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      // Geocode both postal codes
      const [resA, resB] = await Promise.all([
        fetch(`/api/geocode?postal=${postalA}`).then(r => r.json()),
        fetch(`/api/geocode?postal=${postalB}`).then(r => r.json()),
      ]);

      if (resA.error) throw new Error(`Location A: ${resA.error}`);
      if (resB.error) throw new Error(`Location B: ${resB.error}`);

      const coordA = { lat: resA.lat, lng: resA.lng };
      const coordB = { lat: resB.lat, lng: resB.lng };
      const mid = midpoint(coordA, coordB);
      const dist = distKm(coordA, coordB);

      // Fetch venues near midpoint
      const venueRes = await fetch(`/api/venues?lat=${mid.lat}&lng=${mid.lng}&category=${category}`).then(r => r.json());
      if (venueRes.error) throw new Error(venueRes.error);

      // Add distance from midpoint to each venue
      const venues = venueRes.venues.map(v => ({
        ...v,
        distFromMid: distKm(mid, { lat: v.lat, lng: v.lng }),
      }));

      setResults({ coordA, coordB, mid, dist, venues, labelA: resA.address, labelB: resB.address });

      setTimeout(() => {
        document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }


  return (
    <>
      <Head>
        <title>inbetween.sg — meet me halfway</title>
        <meta name="description" content="Singapore's meetup recommender. Find the perfect spot between you and your friend." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
          async
        />
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

        nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: rgba(244,247,242,0.92); backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--sand); padding: 0 2rem; height: 60px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .nav-logo { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 400; color: var(--dark); letter-spacing: -0.3px; }
        .nav-logo span { color: var(--matcha); font-style: italic; }
        .nav-links { display: flex; gap: 1.5rem; align-items: center; }
        .nav-links a { font-size: 13px; color: var(--brown); text-decoration: none; transition: color 0.2s; }
        .nav-links a:hover { color: var(--dark); }
        .nav-cta { background: var(--accent); color: white; border: none; border-radius: 20px; padding: 7px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s; font-family: 'DM Sans', sans-serif; }
        .nav-cta:hover { background: var(--accent-dark); }

        .hero { padding: 120px 2rem 80px; text-align: center; max-width: 680px; margin: 0 auto; }
        .hero-eyebrow { display: inline-flex; align-items: center; gap: 6px; background: var(--matcha-pale); color: var(--accent-dark); border-radius: 20px; padding: 5px 14px; font-size: 12px; font-weight: 500; letter-spacing: 0.3px; margin-bottom: 1.5rem; }
        .hero-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--matcha); }
        .hero h1 { font-family: 'Fraunces', serif; font-size: clamp(40px, 7vw, 64px); font-weight: 300; line-height: 1.1; letter-spacing: -1px; margin-bottom: 1rem; color: var(--dark); }
        .hero h1 em { font-style: italic; color: var(--matcha); }
        .hero p { font-size: 17px; color: var(--brown); max-width: 440px; margin: 0 auto 2.5rem; line-height: 1.7; font-weight: 300; }

        .card { background: var(--warm-white); border: 1px solid var(--sand); border-radius: 24px; padding: 2rem; max-width: 640px; margin: 0 auto; box-shadow: 0 4px 40px rgba(26,38,24,0.07); }
        .input-group { display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.25rem; }
        .location-input { display: flex; align-items: center; gap: 10px; background: var(--cream); border: 1.5px solid var(--sand); border-radius: var(--radius-sm); padding: 12px 14px; transition: border-color 0.2s, box-shadow 0.2s; }
        .location-input:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--matcha-pale); }
        .loc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .loc-dot.a { background: var(--teal); }
        .loc-dot.b { background: var(--matcha); }
        .location-input input { border: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--dark); flex: 1; outline: none; }
        .location-input input::placeholder { color: var(--tan); }
        .input-label { font-size: 11px; color: var(--brown); font-weight: 500; white-space: nowrap; }

        .divider-row { display: flex; align-items: center; gap: 10px; margin: 0 0 1.25rem; font-size: 11px; color: var(--tan); letter-spacing: 0.5px; }
        .divider-row::before, .divider-row::after { content: ''; flex: 1; height: 1px; background: var(--sand); }

        .chip-label { font-size: 12px; color: var(--brown); margin-bottom: 8px; font-weight: 500; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1.5rem; }
        .chip { display: flex; align-items: center; gap: 5px; padding: 7px 14px; border-radius: 20px; border: 1.5px solid var(--sand); background: var(--cream); font-size: 13px; color: var(--brown); cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; font-weight: 400; }
        .chip.active { background: var(--dark); color: white; border-color: var(--dark); }
        .chip:hover:not(.active) { border-color: var(--matcha); color: var(--accent-dark); }

        .find-btn { width: 100%; padding: 15px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); font-family: 'Fraunces', serif; font-size: 17px; font-weight: 400; font-style: italic; cursor: pointer; transition: background 0.2s, transform 0.1s; letter-spacing: -0.2px; }
        .find-btn:hover:not(:disabled) { background: var(--accent-dark); }
        .find-btn:active:not(:disabled) { transform: scale(0.99); }
        .find-btn:disabled { background: var(--tan); cursor: not-allowed; }

        .error-msg { margin-top: 12px; padding: 10px 14px; background: #fef0f0; border: 1px solid #f5c6c6; border-radius: var(--radius-sm); font-size: 13px; color: #c0392b; }

        .results-section { max-width: 640px; margin: 2rem auto 0; }

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

        .share-options { margin-top: 1.5rem; margin-bottom: 4rem; }
        .share-options-header { margin-bottom: 1rem; }
        .share-options-header h3 { font-family: 'Fraunces', serif; font-weight: 400; font-size: 20px; letter-spacing: -0.3px; margin-bottom: 2px; }
        .share-options-header p { font-size: 13px; color: var(--brown); }
        .share-option-cards { display: flex; flex-direction: column; gap: 10px; }
        .share-option-card { background: var(--dark); border-radius: var(--radius); padding: 1.25rem 1.5rem; display: flex; align-items: flex-start; gap: 14px; flex-wrap: wrap; }
        .share-option-icon { font-size: 22px; flex-shrink: 0; margin-top: 2px; }
        .share-option-info { flex: 1; min-width: 0; }
        .share-option-info strong { display: block; font-size: 14px; font-weight: 500; color: white; margin-bottom: 3px; }
        .share-option-info span { display: block; font-size: 12px; color: var(--sage); line-height: 1.5; margin-bottom: 8px; }
        .share-url-small { font-size: 11px; background: rgba(255,255,255,0.08); border-radius: 6px; padding: 4px 10px; color: var(--sage); font-family: monospace; display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .share-option-btns { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
        .share-btn { padding: 9px 18px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: 'DM Sans', sans-serif; transition: opacity 0.15s; }
        .share-btn:hover { opacity: 0.85; }
        .share-btn.copy { background: rgba(255,255,255,0.12); color: white; }
        .share-btn.wa { background: #25D366; color: white; }

        .how-section { max-width: 640px; margin: 5rem auto 0; padding: 0 0 4rem; }
        .how-section h2 { font-family: 'Fraunces', serif; font-weight: 300; font-size: 32px; letter-spacing: -0.5px; margin-bottom: 2rem; text-align: center; }
        .how-section h2 em { font-style: italic; color: var(--matcha); }
        .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; }
        .step { background: var(--warm-white); border: 1px solid var(--sand); border-radius: var(--radius); padding: 1.25rem; text-align: center; }
        .step-num { width: 32px; height: 32px; border-radius: 50%; background: var(--matcha-pale); color: var(--accent-dark); font-weight: 500; font-size: 13px; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; }
        .step p { font-size: 13px; color: var(--brown); line-height: 1.6; }
        .step strong { display: block; font-size: 14px; color: var(--dark); margin-bottom: 4px; }

        footer { border-top: 1px solid var(--sand); padding: 1.5rem 2rem; text-align: center; font-size: 12px; color: var(--tan); }
        footer a { color: var(--brown); text-decoration: none; }

        .contact-section { max-width: 640px; margin: 4rem auto 0; padding: 0 0 5rem; }
        .contact-inner { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; }
        .contact-form-wrap { background: var(--warm-white); border: 1px solid var(--sand); border-radius: 24px; padding: 1.75rem; box-shadow: 0 4px 40px rgba(26,38,24,0.06); }
        .contact-success { text-align: center; padding: 2rem 1rem; }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 1rem; }
        .form-label { font-size: 12px; font-weight: 500; color: var(--brown); }
        .form-input { background: var(--cream); border: 1.5px solid var(--sand); border-radius: var(--radius-sm); padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: var(--dark); outline: none; transition: border-color 0.2s, box-shadow 0.2s; width: 100%; resize: none; }
        .form-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--matcha-pale); }
        .form-input::placeholder { color: var(--tan); }
        .form-textarea { line-height: 1.6; }
        .form-error { font-size: 13px; color: #c0392b; background: #fef0f0; border: 1px solid #f5c6c6; border-radius: var(--radius-sm); padding: 8px 12px; margin-bottom: 12px; }
        .form-submit { width: 100%; padding: 13px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); font-family: 'Fraunces', serif; font-size: 16px; font-weight: 400; font-style: italic; cursor: pointer; transition: background 0.2s; letter-spacing: -0.2px; display: flex; align-items: center; justify-content: center; gap: 4px; }
        .form-submit:hover:not(:disabled) { background: var(--accent-dark); }
        .form-submit:disabled { background: var(--tan); cursor: not-allowed; }

        @media (max-width: 600px) {
          .contact-section { margin: 3rem 1rem 0; padding: 0 0 3rem; }
          .contact-inner { grid-template-columns: 1fr; gap: 1.5rem; }
        }

        .spinner { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: white; margin: 0 2px; animation: bounce 1.2s infinite ease-in-out; }
        .spinner:nth-child(2) { animation-delay: 0.2s; }
        .spinner:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.4s ease forwards; }

        @media (max-width: 600px) {
          nav { padding: 0 1rem; }
          .hero { padding: 90px 1rem 50px; }
          .card { margin: 0 1rem; border-radius: 16px; padding: 1.25rem; }
          .results-section { margin: 1.5rem 1rem 0; }
          .how-section { margin: 3rem 1rem 0; padding: 0 0 2rem; }
          .share-option-card { flex-direction: column; }
          .share-option-btns { width: 100%; }
        }
      `}</style>

      {/* NAV */}
      <nav>
        <div className="nav-logo">in<span>between</span>.sg</div>
        <div className="nav-links">
          <a href="#how">how it works</a>
          <button className="nav-cta" onClick={() => document.querySelector('.card')?.scrollIntoView({ behavior: 'smooth' })}>try it</button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-eyebrow"><div className="hero-dot" /> Singapore's meetup recommender</div>
        <h1>Can you meet me <em>halfway?</em></h1>
        <p>Enter where you both are. We'll find the perfect spot in between.</p>
      </section>

      {/* MAIN CARD */}
      <div className="card">
        <div className="input-group">
          <div className="location-input">
            <div className="loc-dot a" />
            <input
              type="text" inputMode="numeric" maxLength={6}
              placeholder="Your location's postal code (e.g. 068896)"
              value={postalA}
              onChange={e => setPostalA(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleFind()}
            />
            <span className="input-label">You</span>
          </div>
          <div className="location-input">
            <div className="loc-dot b" />
            <input
              type="text" inputMode="numeric" maxLength={6}
              placeholder="Friend's postal code (e.g. 310123)"
              value={postalB}
              onChange={e => setPostalB(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => e.key === 'Enter' && handleFind()}
            />
            <span className="input-label">Friend</span>
          </div>
        </div>

        <div className="divider-row">LOOKING FOR</div>

        <div className="chip-label">What kind of place?</div>
        <div className="chips">
          {Object.entries(CATEGORY_ICONS).map(([cat, icon]) => (
            <button key={cat} className={`chip${category === cat ? ' active' : ''}`} onClick={() => setCategory(cat)}>
              {icon} {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <button className="find-btn" disabled={loading} onClick={handleFind}>
          {loading
            ? <span><span className="spinner" /><span className="spinner" /><span className="spinner" /></span>
            : 'find our inbetween →'}
        </button>

        {error && <div className="error-msg">{error}</div>}
      </div>

      {/* RESULTS */}
      {results && (
        <div className="results-section fade-up" id="results-section">

          {/* MAP */}
          <div className="map-container">
            <div ref={mapRef} />
            <div className="midpoint-badge">
              <div className="badge-dot" />
              <span>{results.dist.toFixed(1)} km apart · midpoint found</span>
            </div>
          </div>

          {/* VENUES */}
          <div className="venues-header">
            <h2>Spots near the middle</h2>
            <span>{results.venues.length} place{results.venues.length !== 1 ? 's' : ''} found</span>
          </div>

          <div className="venues-grid">
            {results.venues.length === 0 && (
              <p style={{ color: 'var(--brown)', fontSize: 14 }}>No {category}s found near the midpoint. Try a different category.</p>
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
                <div className="venue-icon">{CATEGORY_ICONS[category]}</div>
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

          {/* SHARE — TWO OPTIONS */}
          <div className="share-options">
            <div className="share-options-header">
              <h3>Share with your friend</h3>
              <p>Pick how you'd like to share</p>
            </div>
            <div className="share-option-cards">

              {/* Option 1 — Share final results */}
              <div className="share-option-card">
                <div className="share-option-icon">📍</div>
                <div className="share-option-info">
                  <strong>Share these results</strong>
                  <span>Friend sees the same spots immediately — no input needed</span>
                  <div className="share-url-small">inbetween.sg/results/{postalA}/{postalB}/{category}</div>
                </div>
                <div className="share-option-btns">
                  <button className="share-btn copy" onClick={() => {
                    navigator.clipboard.writeText(`https://inbetween.sg/results/${postalA}/${postalB}/${category}`).then(() => { setCopied('results'); setTimeout(() => setCopied(''), 2000); });
                  }}>{copied === 'results' ? 'Copied!' : 'Copy'}</button>
                  <button className="share-btn wa" onClick={() => {
                    const url = encodeURIComponent(`https://inbetween.sg/results/${postalA}/${postalB}/${category}`);
                    window.open(`https://wa.me/?text=Here%20are%20our%20meetup%20spots%20%F0%9F%93%8D%20${url}`);
                  }}>WhatsApp</button>
                </div>
              </div>

              {/* Option 2 — Let friend enter location */}
              <div className="share-option-card">
                <div className="share-option-icon">📬</div>
                <div className="share-option-info">
                  <strong>Let friend enter their location</strong>
                  <span>Friend adds their postal code — midpoint recalculates from their side</span>
                  <div className="share-url-small">inbetween.sg/r/{postalA}/{category}</div>
                </div>
                <div className="share-option-btns">
                  <button className="share-btn copy" onClick={() => {
                    navigator.clipboard.writeText(`https://inbetween.sg/r/${postalA}/${category}`).then(() => { setCopied('invite'); setTimeout(() => setCopied(''), 2000); });
                  }}>{copied === 'invite' ? 'Copied!' : 'Copy'}</button>
                  <button className="share-btn wa" onClick={() => {
                    const url = encodeURIComponent(`https://inbetween.sg/r/${postalA}/${category}`);
                    window.open(`https://wa.me/?text=Hey%20where%20are%20you%3F%20Let%27s%20find%20a%20spot%20inbetween%20us%20%F0%9F%93%8D%20${url}`);
                  }}>WhatsApp</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* HOW IT WORKS */}
      <section className="how-section" id="how">
        <h2>how it <em>works</em></h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <strong>Drop your postal codes</strong>
            <p>Enter both Singapore postal codes. We handle the rest.</p>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <strong>We find the middle</strong>
            <p>We calculate the geographic midpoint and surface great spots nearby.</p>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <strong>Share &amp; decide</strong>
            <p>Send your friend the link. Pick a place, go meet.</p>
          </div>
        </div>
      </section>

      {/* CONTACT SECTION */}
      <section className="contact-section" id="contact">
        <div className="contact-inner">
          <div className="contact-left">
            <div className="hero-eyebrow" style={{ marginBottom: '1rem' }}><div className="hero-dot" /> get in touch</div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontWeight: 300, fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: '1rem' }}>
              Want to <em style={{ fontStyle: 'italic', color: 'var(--matcha)' }}>collaborate</em><br />or partner up?
            </h2>
            <p style={{ fontSize: 15, color: 'var(--brown)', lineHeight: 1.7, fontWeight: 300, maxWidth: 300 }}>
              Whether it's a partnership, advertising, or just a good idea — drop your details and I'll get back to you.
            </p>
          </div>
          <div className="contact-form-wrap">
            {contactSent ? (
              <div className="contact-success">
                <div style={{ fontSize: 32, marginBottom: 12 }}>🌿</div>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontWeight: 400, fontSize: 20, marginBottom: 8 }}>Got it!</h3>
                <p style={{ fontSize: 14, color: 'var(--brown)' }}>Thanks for reaching out — I'll be in touch soon.</p>
              </div>
            ) : (
              <form className="contact-form" onSubmit={handleContact}>
                <div className="form-group">
                  <label className="form-label">Name</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="Your name"
                    value={contactForm.name}
                    onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="your@email.com"
                    value={contactForm.email}
                    onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="What's on your mind?"
                    value={contactForm.message}
                    onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                    required
                    rows={3}
                  />
                </div>
                {contactError && <div className="form-error">{contactError}</div>}
                <button className="form-submit" type="submit" disabled={contactLoading}>
                  {contactLoading ? <><span className="spinner" /><span className="spinner" /><span className="spinner" /></> : 'Send message →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer>
        <p>© 2026 inbetween.sg &nbsp;·&nbsp; <a href="#how">how it works</a> &nbsp;·&nbsp; <a href="#contact">contact</a> &nbsp;·&nbsp; Built in Singapore 🇸🇬</p>
      </footer>
    </>
  );
}
