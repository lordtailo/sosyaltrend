// Basit ön yüz yapay zeka istemcisi
// Denemek için önce `/yapay-zeka/api` uç noktasına POST isteği yapar;
// sunucu yoksa kural tabanlı fallback cevabı döner.

export async function getAIResponse(message) {
  if (!message) return '';
  // Deneme: proxy/servis varsa ona istek at
  try {
    const resp = await fetch('/yapay-zeka/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data.reply || data.response || JSON.stringify(data);
    }
  } catch (e) {
    // ignore, fallback
  }

  // Basit kural tabanlı cevap (çevrimdışı mod)
  const m = message.toLowerCase();
  if (m.includes('trend') || m.includes('popüler')) {
    return 'Bugün öne çıkan içerikler: kısa video, teknoloji haberleri ve ramazan etkinlikleri.';
  }
  if (m.includes('rapor') || m.includes('istatistik')) {
    return 'Son raporlar hazır değil; isterseniz kullanıcı etkileşim özetini oluşturabilirim.';
  }
  if (m.includes('nasıl') || m.includes('yapılır')) {
    return 'Bu konuda adım adım rehber isterseniz örnek bir kontrol listesi sunabilirim.';
  }

  return 'Şu anda çevrimdışı moddayım — daha sonra tekrar deneyin veya bir yöneticiye başvurun.';
}

// Kısayol olarak global eklendi, modül içinden de kullanılabilir
window.yapayZekaClient = { getAIResponse };
