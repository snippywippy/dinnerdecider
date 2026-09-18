// Given a comma-separated list of Google place_ids, returns whether each is open right now.
// Used right before spinning, so a place that's closed tonight never gets picked.
module.exports = async function handler(req, res) {
  const idsParam = req.query.ids || '';
  const ids = [...new Set(idsParam.split(',').map(s => s.trim()).filter(Boolean))].slice(0, 40);
  if (ids.length === 0) {
    res.status(200).json({ results: {} });
    return;
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'Server is missing GOOGLE_MAPS_API_KEY' });
    return;
  }
  try {
    const results = {};
    await Promise.all(ids.map(async (id) => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(id)}&fields=opening_hours&key=${key}`;
        const r = await fetch(url);
        const data = await r.json();
        if (data.status === 'OK' && data.result && data.result.opening_hours &&
            typeof data.result.opening_hours.open_now === 'boolean') {
          results[id] = data.result.opening_hours.open_now;
        } else {
          results[id] = null; // unknown — Google has no hours on file for this place
        }
      } catch (e) {
        results[id] = null;
      }
    }));
    res.status(200).json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Status check failed: ' + err.message });
  }
};
