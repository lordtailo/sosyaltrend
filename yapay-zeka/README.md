# Yapay Zeka — Entegrasyon

Bu klasör `stbot` (site bot) ile ön yüz entegrasyonu için basit bir istemci sağlar.

Dosyalar:
- `ai-client.js` — Ön yüzdeki basit istemci. Öncelikle `/yapay-zeka/api` uç noktasına POST isteği dener; sunucu yoksa kural tabanlı fallback cevap döner.

Kurulum / Kullanım:
1. `stbot/index.html` sayfasında "Yapay Zeka ile Sohbet Et" butonuna tıklayın. Bu buton `assets/js/stbot.js` içindeki `openStBotChat()` ile chat penceresini açar.
2. Sunucu tabanlı gerçek model kullanmak istiyorsanız, bir POST `/yapay-zeka/api` uç noktası oluşturun. İstek gövdesi: `{ message: string }`. Yanıt örneği: `{ reply: string }`.

Geliştirme önerileri:
- Güçlü bir model için arka uçta OpenAI veya başka bir LLM sağlayıcısını kullanabilirsiniz. API anahtarlarını sunucuda güvenli şekilde saklayın.
- Kullanıcı oturum bilgilerini (yönetici doğrulaması) geçerli hale getirin; yalnızca yetkili kullanıcıların erişimine izin verin.
- Sohbet geçmişini sunucuda tutarak bağlam sağlayın.

Örnek: bir kullanıcının sayfasından sohbeti açmak ve konuşma bazlı geçmiş temizleme

1. Kullanıcının profil sayfasına aşağıdaki butonu ekleyin (örnek):

```html
<button onclick="openStBotChat('user-123','Ahmet Yılmaz')">Yapay Zeka ile Sohbet Et</button>
```

2. Açılan sohbet penceresinin üstündeki `🗑️ Geçmişi Sil` butonuna tıklayın; önce "Sadece benden sil" seçeneği (yerel), eğer admin iseniz ikinci adımda "Herkesten sil" (sunucu uç noktası `/yapay-zeka/clear-conversation`) çalışır.

3. Sunucu uç noktası `POST /yapay-zeka/clear-conversation` gövdesi örneği: `{ "conversationId": "user-123" }`.

İsterseniz arka uç (Node.js Express örneği) veya OpenAI entegrasyonu için örnek bir `server.js` dosyası oluşturabilirim.

Sunucu Proxy Örneği
-------------------

Bu repo altında basit bir Node.js Express proxy sunucusu eklenmiştir (`server.js`). Bu sunucu istemciden gelen `{ message }` isteklerini alır, OpenAI Chat Completions API'sine iletir ve `{ reply }` şeklinde yanıt döner.

Hızlı kurulum:

1. `yapay-zeka` klasörüne gidin:

	cd yapay-zeka

2. Bağımlılıkları kurun:

	npm install

3. `.env` oluşturun veya `OPENAI_API_KEY` ortam değişkenini ayarlayın.

4. Sunucuyu başlatın:

	npm start

Sunucu, varsayılan olarak `http://localhost:3001` üzerinde çalışır ve istemcinin `ai-client.js` içindeki `/yapay-zeka/api` çağrısını karşılar.

Not: Ana site içindeki `openStBotChat()` tabanlı yönetici sohbeti artık önce bu OpenAI proxy uç noktasına bağlanmaya çalışır. Sunucu çalışmadığında, yerel kurallar hala yedek cevaplar üretir.

Güvenlik notları:
- `OPENAI_API_KEY` kesinlikle istemci tarafına konulmamalıdır.
- Üretimde sunucuyu HTTPS arkasında ve kimlik doğrulama ile çalıştırın. `clear-conversation` ve `clear-all` uç noktaları şu anda uygulama içinde "Not implemented" olarak bırakılmıştır — eğer sunucu tarafı sohbet geçmişi saklıyorsanız, bu uç noktaları güvenli bir şekilde uygulayın.

İsterseniz bu sunucuyu dağıtım için yapılandırıp, istek başına maliyeti azaltmak ve gecikmeyi kısaltmak için önbellekleme veya akış (streaming) desteği ekleyebilirim.
