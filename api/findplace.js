module.exports = async function handler(req, res) {
  const query = req.query.query;
  if (!query) {
    res.status(400).json({ error: 'Missing query' });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }
  try {
    const fields = 'place_id,name,formatted_address,geometry,price_level,types,rating,user_ratings_total';
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=${fields}&key=${key}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.status !== 'OK' || !data.candidates || !data.candidates[0]) {
      res.status(400).json({ error: `No match found (status: ${data.status})` });
      return;
    }
    const c = data.candidates[0];
    res.status(200).json({
      place_id: c.place_id,
      name: c.name,
      formatted_address: c.formatted_address,
      lat: c.geometry.location.lat,
      lng: c.geometry.location.lng,
      price_level: c.price_level,
      types: c.types,
      rating: c.rating,
      user_ratings_total: c.user_ratings_total
    });
  } catch (err) {
    res.status(500).json({ error: 'Find place failed: ' + err.message });
  }
};
