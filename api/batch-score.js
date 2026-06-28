// api/batch-score.js
// ReRoute AI — Toplu Yolcu Skorlama ve Önceliklendirme API
// POST /api/batch-score
// Body: { passengers: [{ name, tier, connMin, cabin, special }, ...] }
// Response: { processedAt, count, results: [...skora göre sıralı...] }

const { computeScore } = require('./score.js');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      status: "ok",
      message: "ReRoute AI Toplu Skorlama API'si çalışıyor.",
      usage: {
        method: "POST",
        endpoint: "/api/batch-score",
        body_example: {
          passengers: [
            { name: "Elif Yıldırım", tier: "Elite Plus", connMin: 38, cabin: "Business", special: false },
            { name: "Sarah Connors", tier: "Classic", connMin: 70, cabin: "Economy Comfort", special: true }
          ]
        }
      }
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  try {
    const body = req.body || {};
    const passengers = body.passengers;

    if (!Array.isArray(passengers) || passengers.length === 0) {
      throw new Error("passengers alanı boş olmayan bir dizi olmalı.");
    }
    if (passengers.length > 2000) {
      throw new Error("Tek istekte en fazla 2000 yolcu işlenebilir.");
    }

    const startTime = Date.now();

    const results = passengers.map((p, idx) => {
      try {
        const scored = computeScore(p);
        return { name: p.name || `Yolcu #${idx + 1}`, ...scored };
      } catch (err) {
        return { name: p.name || `Yolcu #${idx + 1}`, error: err.message };
      }
    });

    // hatasız olanları skora göre büyükten küçüğe sırala, hatalıları sona koy
    const valid = results.filter(r => !r.error).sort((a, b) => b.total - a.total);
    const invalid = results.filter(r => r.error);

    const processingMs = Date.now() - startTime;

    res.status(200).json({
      processedAt: new Date().toISOString(),
      count: passengers.length,
      processingMs,
      highPriorityCount: valid.filter(r => r.priorityLabel === "YÜKSEK ÖNCELİK").length,
      results: [...valid, ...invalid]
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
