// Basit ön yüz yapay zeka istemcisi
// Denemek için önce `/yapay-zeka/api` uç noktasına POST isteği dener;
// sunucu yoksa kural tabanlı fallback cevap döner.

const LOCAL_AI_ENDPOINTS = [
  '/yapay-zeka/api',
  window.location.hostname ? `${window.location.protocol}//${window.location.hostname}:3001/yapay-zeka/api` : 'http://localhost:3001/yapay-zeka/api'
];

function getRandomResponse(choices) {
  return choices[Math.floor(Math.random() * choices.length)];
}

function normalizeMessage(text) {
  return String(text || '').toLowerCase().trim();
}

export async function getAIResponse(message, history = []) {
  if (!message) return '';

  const payload = { message, history };

  for (const endpoint of LOCAL_AI_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data && (data.reply || data.response)) {
        return data.reply || data.response;
      }
    } catch (e) {
      // ignore and try next endpoint
    }
  }

  const m = normalizeMessage(message);
  const lastUser = Array.isArray(history) && history.length ? history.filter(item => item.role === 'user').slice(-1)[0] : null;
  const repeatedPrompt = lastUser && normalizeMessage(lastUser.content) === m;
  const fallbackSeed = repeatedPrompt ? 'repeat' : 'fresh';

  if (/(merhaba|selam|naber|hello|hi)/.test(m)) {
    return getRandomResponse([
      'Merhaba! Ne hakkında konuşmak istersin?',
      'Selam! Sorunuzu bekliyorum.',
      'Hoş geldiniz! Size nasıl yardımcı olabilirim?' 
    ]);
  }
  if (/(trend|popüler|öne çıkan|öne çıkan içerik)/.test(m)) {
    return getRandomResponse([
      'Bugün trendde kısa videolar, teknoloji haberleri ve ramazan etkinlikleri var.',
      'Trendlerde şu an en çok kısa videolar, topluluk paylaşımları ve güncel haberler dikkat çekiyor.',
      'Popüler içerikler arasında en çok canlı yayın duyuruları ve eğlenceli paylaşım formatları var.'
    ]);
  }
  if (/(rapor|istatistik|analiz)/.test(m)) {
    return getRandomResponse([
      'Elimde güncel rapor yok, ama etkileşim özetini oluşturmak istersen adım adım yardımcı olabilirim.',
      'Şu anda rapor verisi yok; hangi konuda analiz istediğini söylersen, ona göre yönlendireyim.',
      'Raporlar hazır değil; istersen kullanıcı davranışları veya trafik trendleri hakkında genel bir değerlendirme sunabilirim.'
    ]);
  }
  if (/(nasıl|yapılır|yöntem|adım)/.test(m)) {
    return getRandomResponse([
      'Bu konuda adım adım yardımcı olabilirim; lütfen hangi işlemi yapmak istediğini yaz.',
      'Hangi adımı öğrenmek istediğini belirtirsen, sana bir rehber hazırlayabilirim.',
      'Bana ne yapmak istediğini söyle, ben de sana yol haritası çıkartayım.'
    ]);
  }

  if (fallbackSeed === 'repeat') {
    return getRandomResponse([
      'Bunu daha önce sormuştun; aynı soruya farklı bir açıdan bakmamı ister misin?',
      'Aynı konu üzerinde tekrarlandığın için farklı bir yaklaşım sunayım: neye odaklanmak istersin?',
      'Tekrar eden sorulara daha farklı cevap vermeye çalışıyorum. Lütfen konuyu biraz daha açar mısın?'
    ]);
  }

  return getRandomResponse([
    'Sohbet etmeye hazırım. Ne hakkında konuşmak istersiniz?',
    'Farklı bir konu veya soru sorarak sohbeti zenginleştirebilirsiniz.',
    'Sana daha iyi yardımcı olabilmem için biraz daha ayrıntı verebilir misin?'
  ]);
  if (/(merhaba|selam|naber|hello|hi)/.test(m)) {
    return getRandomResponse([
      'Merhaba! Nasıl yardımcı olabilirim?',
      'Selam! Sorunuzu bekliyorum.',
      'Hoş geldiniz! Size nasıl yardımcı olabilirim?'
    ]);
  }
  if (/(trend|popüler|öne çıkan|öne çıkan içerik)/.test(m)) {
    return getRandomResponse([
      'Bugün popüler içerikler arasında kısa video, teknoloji haberleri ve ramazan etkinlikleri var.',
      'Şu anda trendlerde en çok kısa videolar, etkinlik duyuruları ve sosyal medya paylaşımları dikkat çekiyor.',
      'Trendler genelde kısa video formatları, güncel teknoloji ve topluluk paylaşımları etrafında dönüyor.'
    ]);
  }
  if (/(rapor|istatistik|analiz)/.test(m)) {
    return getRandomResponse([
      'Elimde güncel rapor yok; ama istersen etkileşim özetini hazırlayabilirim.',
      'Şu anda rapor verisi yok, ancak platform davranışları hakkında genel bir değerlendirme sunabilirim.',
      'Raporlar doğrudan hazırlanmadı; hangi konu üzerinde analiz istediğinizi söyleyin.'
    ]);
  }
  if (/(nasıl|yapılır|yöntem|adım)/.test(m)) {
    return getRandomResponse([
      'Bu konuda adım adım yardımcı olabilirim; lütfen hangi işlemi yapmak istediğinizi yazın.',
      'Adım adım rehber için önce ne yapmak istediğinizi belirtin.',
      'Bu konu için bir kontrol listesi hazırlayabilirim; detay verir misiniz?'
    ]);
  }

  return getRandomResponse([
    'Sohbet etmeye hazırım. Ne hakkında konuşmak istersiniz?',
    'Şu anda cevap veremiyorum ama başka bir konu deneyebilirsiniz.',
    'Daha çeşitli bir sohbet için farklı bir soru sorabilirsiniz.'
  ]);
}

// Kısayol olarak global eklendi, modül içinden de kullanılabilir
window.yapayZekaClient = { getAIResponse };
