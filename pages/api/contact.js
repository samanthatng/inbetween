// pages/api/contact.js
// Saves contact form submissions to Google Sheets via SheetDB
// Free tier: 500 requests/month — plenty for MVP
// Setup: create a Google Sheet, connect it at sheetdb.io, paste the API URL in Vercel env vars
 
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { name, email, message } = req.body;
 
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }
 
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
 
  try {
    const sheetdbUrl = process.env.SHEETDB_API_URL;
 
    if (!sheetdbUrl) {
      // Graceful fallback if SheetDB not configured yet — logs to Vercel console
      console.log('SheetDB not configured. Submission:', { name, email, message });
      return res.status(200).json({ success: true });
    }
 
    const response = await fetch(sheetdbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          timestamp: new Date().toISOString(),
          name,
          email,
          message,
        }],
        sheet: 'Sheet1',
      }),
    });
 
    if (!response.ok) {
      const errBody = await response.text();
      console.error('SheetDB error response:', response.status, errBody);
      throw new Error('SheetDB write failed');
    }
 
    const result = await response.json();
    console.log('SheetDB success:', result);
 
    return res.status(200).json({ success: true });
 
  } catch (err) {
    console.error('Contact error:', err);
    return res.status(500).json({ error: 'Failed to send. Please try again.' });
  }
}
