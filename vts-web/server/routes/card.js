const express = require('express');
const router = express.Router();

const EREVEALER_URL = process.env.EREVEALER_URL || 'http://localhost:5050';

router.post('/read', async (req, res) => {
  try {
    const response = await fetch(`${EREVEALER_URL}/api/operation/ReadCard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ReadCardInfo: true,
        ReadPersonalInfo: true,
        ReadAddressDetails: true,
        ReadBiometrics: false,
        ReadEmploymentInfo: false,
        ReadImmigrationDetails: false,
        ReadTrafficDetails: false,
        SilentReading: false,
        ReaderIndex: -1,
        ReaderName: '',
        OutputFormat: 'JSON',
        ValidateCard: false
      })
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'eRevealer returned an error', status: response.status });
    }

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error('[CARD] Read failed:', err.message);
    res.status(503).json({
      error: 'Card reader service unavailable',
      detail: err.message
    });
  }
});

router.get('/status', async (req, res) => {
  try {
    const response = await fetch(`${EREVEALER_URL}/api/health`);
    res.json({ available: response.ok });
  } catch {
    res.json({ available: false });
  }
});

module.exports = router;