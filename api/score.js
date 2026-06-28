// api/score.js
// ReRoute AI — Öncelik Skorlama Motoru API
// POST /api/score
// Body: { tier: "Elite Plus"|"Elite"|"Classic", connMin: number, cabin: "Business"|"Economy Comfort"|"Economy", special: boolean }
// Response: { total, breakdown: {...}, priorityLabel, recommendation }

const TIER_VALUES = { "Elite Plus": 100, "Elite": 65, "Classic": 25 };
const CABIN_VALUES = { "Business": 100, "Economy Comfort": 60, "Economy": 35 };

// Bağlantı riski: kalan süre azaldıkça risk artar.
// <=20 dakika kaldıysa risk maksimum (100), >=240 dakika kaldıysa risk minimum (0)
function computeConnectionRisk(connMin) {
  const clamped = Math.max(0, Math.min(100, Math.round(100 - ((connMin - 20) / (240 - 20)) * 100)));
  return clamped;
}

function computeScore({ tier, connMin, cabin, special }) {
  const tierVal = TIER_VALUES[tier];
  const cabinVal = CABIN_VALUES[cabin];

  if (tierVal === undefined) throw new Error(`Geçersiz tier değeri: ${tier}. Beklenen: Elite Plus, Elite, Classic`);
  if (cabinVal === undefined) throw new Error(`Geçersiz cabin değeri: ${cabin}. Beklenen: Business, Economy Comfort, Economy`);
  if (typeof connMin !== 'number' || connMin < 0) throw new Error(`connMin pozitif bir sayı olmalı, alınan: ${connMin}`);

  const connRisk = computeConnectionRisk(connMin);
  const specialVal = special ? 100 : 0;

  // Ağırlıklı formül: Sadakat %35, Bağlantı Riski %35, Bilet Sınıfı %20, Özel İhtiyaç %10
  const tierWeighted = tierVal * 0.35;
  const connWeighted = connRisk * 0.35;
  const cabinWeighted = cabinVal * 0.20;
  const specialWeighted = specialVal * 0.10;

  const total = Math.round(tierWeighted + connWeighted + cabinWeighted + specialWeighted);

  let priorityLabel;
  if (total >= 75) priorityLabel = "YÜKSEK ÖNCELİK";
  else if (total >= 45) priorityLabel = "ORTA ÖNCELİK";
  else priorityLabel = "DÜŞÜK ÖNCELİK";

  const actions = [];
  if (total >= 75) actions.push("Öncelikli Yeniden Atama");
  if (tier === "Elite Plus") actions.push("Lounge Erişimi");
  if (connRisk >= 60 && tier === "Classic") actions.push("Otel");
  if (total >= 45 && total < 75) actions.push("İkram");
  if (special) actions.push("Yer Hizmetleri Bildirimi");

  let priorityLabelLower;
  if (total >= 75) priorityLabelLower = "yüksek öncelikli";
  else if (total >= 45) priorityLabelLower = "orta öncelikli";
  else priorityLabelLower = "düşük öncelikli";

  let recommendation = `Bu yolcu ${priorityLabelLower} grupta. `;
  if (connRisk >= 80) recommendation += `Bağlantı süresi kritik (${connMin} dk) — acil alternatif uçuş ataması önerilir. `;
  if (special) recommendation += `Özel hizmet ihtiyacı tespit edildi — yer hizmetlerine otomatik bildirim önerilir.`;

  return {
    input: { tier, connMin, cabin, special: !!special },
    breakdown: {
      tier: { raw: tierVal, weight: 0.35, weighted: Math.round(tierWeighted) },
      connectionRisk: { raw: connRisk, weight: 0.35, weighted: Math.round(connWeighted) },
      cabin: { raw: cabinVal, weight: 0.20, weighted: Math.round(cabinWeighted) },
      specialNeed: { raw: specialVal, weight: 0.10, weighted: Math.round(specialWeighted) }
    },
    total,
    priorityLabel,
    recommendedActions: [...new Set(actions)],
    recommendation: recommendation.trim()
  };
}

module.exports = (req, res) => {
  // CORS — demo'nun farklı origin'den (örn. claude.ai artifact veya başka bir host) çağırabilmesi için
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    // Tarayıcıdan direkt ziyaret edilirse API'nin canlı olduğunu ve nasıl kullanılacağını göster
    res.status(200).json({
      status: "ok",
      message: "ReRoute AI Skorlama API'si çalışıyor.",
      usage: {
        method: "POST",
        endpoint: "/api/score",
        body_example: { tier: "Elite Plus", connMin: 38, cabin: "Business", special: false }
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
    const result = computeScore(body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports.computeScore = computeScore;
