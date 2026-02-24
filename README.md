# SosyalTrend (Node.js Backend)

Bu çalışma dizininde front-end statik dosyalar (`*.html`, `assets/js/app.js` vb.) bulunur.
Firebase bağımlılığı kaldırıldı ve tüm veri/kimlik işlemleri artık bir Node.js
/Express sunucusu üzerinden gerçekleştirilecektir.

## Başlarken
1. Node.js (>=16) kurulu olduğundan emin olun.
2. Terminalde proje kök dizinine geçin:
   ```powershell
   cd c:\Users\offic\OneDrive\sosyaltrend
   ```
3. Bağımlılıkları yükleyin:
   ```powershell
   npm install
   ```
4. Sunucuyu çalıştırın:
   ```powershell
   npm start
   ```
   Servis varsayılan olarak `http://localhost:3000` adresinde dinleyecektir.

> **Not:** Giriş, kayıt ve şifre sıfırlama artık kendi sayfalarına ayrıldı ve `auth/` klasörü altına taşındı.
> * Giriş için `/auth/login.html` (sayfada ayrıca Google ile Giriş düğmesi var).
> * Kayıt için `/auth/register.html` (Google ile Kayıt butonu da mevcut).
> * Şifremi unuttum için `/auth/forgot.html`.
> Eskiden bu formlar tek sayfada birleşikti; artık bağımsız sayfalarda ve `auth` alt klasöründeler.
> Eskiden tüm formlar tek bir sayfada birleşikti; yeni yapıda bağımsız
> sayfalardan istediklerinizi kullanabilirsiniz.

### Google ile giriş / kayıt (opsiyonel)
Bu repoya Google OAuth desteği eklendi; kullanıcılar Google hesaplarıyla
kaydolup giriş yapabilirler. Bunu etkinleştirmek için:

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   üzerinden yeni bir OAuth 2.0 istemcisi oluşturun. Yönlendirme URI'si olarak
   `http://localhost:3000/auth/google/callback` belirleyin.
2. Ortam değişkenleri olarak `GOOGLE_CLIENT_ID` ve `GOOGLE_CLIENT_SECRET` değerlerini
   ayarlayın (örneğin Windows PowerShell'de
   `set GOOGLE_CLIENT_ID=...`).
3. Sunucuyu yukarıdaki gibi başlatın; paketler `passport` ve
   `passport-google-oauth20` zaten `package.json`'a eklenmiştir.  

Başarılı giriş sonrası kullanıcı `data.json` içerisine eklenir (e‑posta zaten
mevcutsa ona bağlanır) ve standart oturum mekanizmasıyla `index.html`'e
yönlendirilir. Bu ayarları kullanmak istemiyorsanız hiç dikkate almayabilirsiniz –
mevcut e‑posta/şifre akışı halen çalışmaya devam eder.

### Şifreleme ve çevrimdışı çalışma

Kayıt/giriş formları artık \*istemci tarafında\* SHA‑256 ile şifrelenecek
(öncesinde düz metin gönderilmez). Sunucuya ulaşılabiliyorsa parola bcrypt
kullanılarak ilave bir kat daha işlenir ve `data.json` içine öyle kaydedilir.

Ayrıca sunucuya erişim sağlanamadığında çalışmayı sürdüren basit bir yedek
mevcut:

* `api.js` içinde lokal `localStorage` tabanlı bir kullanıcı dizini tutulur.
* Kayıt yapılırsa hesabınız yerelde saklanır; girişler önce sunucu denenir,
  başarısız olursa yerel veriyle eşleşen hash kontrol edilir.
* Oturumlar `sessionStorage` üzerinden korunur; `logout()` hem sunucuyu hem
yerelsel oturumu temizler.

Bu sayede Node.js kurulumu yapılamayan bir ortamda bile tarayıcı içi kayıt ve
oturum açma deneyimi sağlanır; şifreler dosyada düz okunamaz halde, sadece
hashleri bulunur. (Üretim kullanımı için elbette gerçek bir sunucu ve TLS
gereklidir.)

## Yapı
- `server.js` - basit Express sunucusu; kullanıcıların, arkadaş taleplerinin, vb.
  saklandığı hafif bir `data.json` dosyasını okur/yazmaktadır.
- `data.json` - başlangıç verileri. İçine kullanıcı/mesaj ekledikçe güncellenir.
- `assets/js/api.js` - front-end tarafından çağrılan API katmanı. Her bir
  fonksiyon `fetch` kullanarak `/api/...` uç noktalarına istek yollar.

## Veriyi sıfırlamak
Firebase'den tamamen ayrılıp Node.js tabanlı bir backend'e geçtiğimiz için
data dosyası da artık proje kökünde `data.json` şeklinde tutuluyor. Aşağıdaki
adımlarla her şeyi temizleyip yeniden başlamanız mümkün:

1. Sunucu durdurulmuşsa terminalde proje dizinine girin (`cd …/sosyaltrend`).
2. `npm run reset` komutunu çalıştırın; bu `data.json` içini boş bir kullanıcı/
   gönderi dizisiyle tekrar yazar.  (Eğer dosya yoksa otomatik olarak oluşturur.)
3. Alternatif olarak doğrudan dosyayı silmek ya da elle düzenlemek de yeterli.
4. Sonrasında `npm start` ile sunucu yeniden başlatın ve tarayıcıda `http://localhost:3000` adresini açın.

Tüm HTML, CSS ve JS dosyaları aynı kaldığından, görünüm ve ön yüz kodunu
bozmanıza gerek yok; sadece veri katmanını sıfırlamış olursunuz. Yeni bir proje
eşleştirmek isterseniz mevcut dizini kopyalayabilir, gerektiğinde `package.json`
ve `reset.js` gibi yardımcı dosyaları da taşımayı unutmayın.

## Front-end değişiklikleri
- `assets/js/app.js` içerisindeki Firebase `import` ifadeleri kaldırıldı.
- Kayıt işlemi artık hem e‑posta hem de kullanıcı adı benzersizliğini kontrol eder.- `onAuthStateChanged` yerine `initAuth()` fonksiyonu kullanılıyor.
- `loadSuggestions`, `sendFriendRequestToUid` gibi işlevler API ile
  konuşacak şekilde yeniden yazıldı. Diğer fonksiyonlar için benzer dönüşüm
  adımları takip edilebilir.

## Geçiş Stratejisi
1. `api.js`'e daha fazla fonksiyon ekleyin.
2. `app.js`'daki Firebase bağımlılıklarını adım adım bu fonksiyon ve backend
   çağrılarıyla değiştirin.
3. Backend tarafında `server.js`'de yeni uç noktalar (ör. `posts`,
   `comments`, `storage` vb.) ekleyin.
4. Gerekirse veritabanınızı (MongoDB, PostgreSQL, vb.) kullanarak `db`'yi
   daha sağlam hale getirin.

> **Not:** Site halihazırda birçok sayfa (mesajlar, profil, yönetici paneli vb.)
> eski Firebase tabanlı kod içeriyor. Bunlar yeni Node.js API ile çalışmayacaktır.
> Şu an için bu sayfalara yalnızca basit bir yer tutucu eklenmiştir; tam işlevsellik
> için her bir sayfadaki `<script>` bloklarını aynı yaklaşım doğrultusunda
> yeniden yazmanız gerekecektir.

---
Bu yapı sayesinde verilerin üzerindeki tam kontrol size geçmiş olur; ileride
Firebase'den tamamen ayrılıp, kendi sunucunuz üzerinde istediğiniz teknolojiyi
kullanabilirsiniz.
