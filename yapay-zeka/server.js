const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || null;

// Simple in-memory rate limit per IP (naive)
const rateMap = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX = 60; // max requests per window

function checkRate(ip) {
  const now = Date.now();
  const entry = rateMap.get(ip) || { ts: now, count: 0 };
  if (now - entry.ts > RATE_WINDOW_MS) {
    entry.ts = now; entry.count = 1;
    rateMap.set(ip, entry);
    return true;
  }
  entry.count++;
  rateMap.set(ip, entry);
  return entry.count <= RATE_MAX;
}

app.post('/yapay-zeka/api', async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  if (!checkRate(ip)) return res.status(429).json({ error: 'Çok fazla istek, lütfen yavaşlayın.' });

  if (!OPENAI_API_KEY) return res.status(500).json({ error: 'Sunucu yapılandırılmamış: OPENAI_API_KEY eksik.' });
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message alanı gerekli.' });

  try {
    const payload = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: 'SosyaLTrend destek asistanı. Kısa ve net Türkçe cevaplar ver. Güvenlik, kişisel veri paylaşımı ve moderasyon kurallarına dikkat et.' },
        { role: 'user', content: String(message) }
      ],
      max_tokens: 800,
      temperature: 0.2,
    };

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const t = await r.text();
      return res.status(r.status).json({ error: t || r.statusText });
    }

    const data = await r.json();
    const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
    return res.json({ reply });
  } catch (e) {
    console.error('proxy error', e);
    return res.status(500).json({ error: e.message || String(e) });
  }
});

// Admin-only placeholder endpoints for clearing server-side histories (optional implementation)
app.post('/yapay-zeka/clear-conversation', (req, res) => {
  const token = req.headers['x-admin-token'] || req.body?.adminToken;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(403).send('Unauthorized');
  // Implement server-side deletion of conversation records if using server storage.
  return res.status(501).send('Not implemented on this server.');
});

app.post('/yapay-zeka/clear-all', (req, res) => {
  const token = req.headers['x-admin-token'] || req.body?.adminToken;
  if (!ADMIN_TOKEN || token !== ADMIN_TOKEN) return res.status(403).send('Unauthorized');
  // Dangerous operation: not implemented. If you want this, implement with care.
  return res.status(501).send('Not implemented on this server.');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`yapay-zeka proxy listening on http://localhost:${PORT}`));
