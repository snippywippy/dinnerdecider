function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

module.exports = async function handler(req, res) {
  const { lat, lng, radiusMiles } = req.query;
  if (!lat || !lng) {
    res.status(400).json({ error: 'Missing lat/lng' });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }
  const radiusMeters = Math.round((parseFloat(radiusMiles) || 8) * 1609.34);

  try {
    let allResults = [];
    let pageToken = null;
    let pageCount = 0;

    do {
      let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=restaurant&key=${key}`;
      if (pageToken) {
        url += `&pagetoken=${pageToken}`;
        await delay(2000); // Google requires a short delay before a page token becomes valid
      }
      const r = await fetch(url);
      const data = await r.json();
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        res.status(400).json({ error: `Search failed (status: ${data.status})` });
        return;
      }
      allResults = allResults.concat(data.results || []);
      pageToken = data.next_page_token || null;
      pageCount++;
    } while (pageToken && allResults.length < 60 && pageCount < 3);

    res.status(200).json({ results: allResults });
  } catch (err) {
    res.status(500).json({ error: 'Nearby search failed: ' + err.message });
  }
};
