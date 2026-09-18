module.exports = async function handler(req, res) {
  const address = req.query.address;
  if (!address) {
    res.status(400).json({ error: 'Missing address' });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.status !== 'OK' || !data.results || !data.results[0]) {
      res.status(400).json({ error: `Could not locate that address (status: ${data.status})` });
      return;
    }
    const loc = data.results[0].geometry.location;
    res.status(200).json({ lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address });
  } catch (err) {
    res.status(500).json({ error: 'Geocoding request failed: ' + err.message });
  }
};
