const express = require('express');
const axios = require('axios');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { coordinates } = req.body || {};
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'coordinates must be an array of [lng, lat] pairs.' });
    }

    const apiKey = process.env.ORS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'ORS_API_KEY is not set on the server.' });
    }

    const response = await axios.post(
      'https://api.heigit.org/v2/directions/driving-car',
      { coordinates },
      {
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    return res.json(response.data);
  } catch (err) {
    console.error('ORS proxy error:', err?.response?.data || err?.message || err);
    return res.status(500).json({ error: 'Route fetch failed' });
  }
});

module.exports = router;
