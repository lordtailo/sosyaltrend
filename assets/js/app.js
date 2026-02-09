import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* Özel Günler ve Tarihte Bugün Veri Seti */
const ozelGunler = [
    // Resmi ve Özel Günler
    { ay: 0, gun: 1, baslik: "Yılbaşı", mesaj: "Yeni yılın tüm SosyalTrend ailesine huzur ve mutluluk getirmesini dileriz! 🎄✨" },
    { ay: 1, gun: 14, baslik: "Sevgililer Günü", mesaj: "Sevginin paylaştıkça çoğaldığı bir gün dileriz! ❤️" },
    { ay: 2, gun: 8, baslik: "Dünya Kadınlar Günü", mesaj: "Emeğiyle dünyayı güzelleştiren tüm kadınların günü kutlu olsun! 💐" },
    { ay: 2, gun: 18, baslik: "Çanakkale Zaferi", mesaj: "18 Mart Çanakkale Zaferi’nin yıl dönümünde şehitlerimizi minnetle anıyoruz. 🇹🇷" },
    { ay: 3, gun: 23, baslik: "Ulusal Egemenlik ve Çocuk Bayramı", mesaj: "23 Nisan kutlu olsun! Geleceğimiz çocuklara emanet. 🇹🇷" },
    { ay: 4, gun: 1, baslik: "Emek ve Dayanışma Günü", mesaj: "Tüm çalışanların 1 Mayıs işçi bayramı kutlu olsun! 🛠️" },
    { ay: 4, gun: 19, baslik: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", mesaj: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramımız kutlu olsun! 🇹🇷" },
    { ay: 6, gun: 15, baslik: "Demokrasi ve Milli Birlik Günü", mesaj: "15 Temmuz Demokrasi ve Milli Birlik Günü'nde şehitlerimizi anıyoruz." },
    { ay: 7, gun: 30, baslik: "Zafer Bayramı", mesaj: "30 Ağustos Zafer Bayramımız kutlu olsun! Başkomutan Atatürk ve silah arkadaşlarını saygıyla anıyoruz. 🇹🇷" },
    { ay: 9, gun: 29, baslik: "Cumhuriyet Bayramı", mesaj: "Cumhuriyetimizin yeni yaşını gururla kutluyoruz! 29 Ekim kutlu olsun! 🇹🇷" },
    { ay: 10, gun: 10, baslik: "Atatürk'ü Anma Günü", mesaj: "Cumhuriyetimizin kurucusu Gazi Mustafa Kemal Atatürk'ü saygı ve özlemle anıyoruz. 🖤" },
    { ay: 11, gun: 24, baslik: "Öğretmenler Günü", mesaj: "Gelecek nesilleri yetiştiren tüm öğretmenlerimizin günü kutlu olsun! 🎓" },

    // 2026 Dini Günler (Yaklaşık Tarihler - Diyanet Takvimine Göre)
    { ay: 1, gun: 18, baslik: "Ramazan Başlangıcı", mesaj: "Hoş geldin Ya Şehr-i Ramazan! İlk teravih bu akşam. 🌙" },
    { ay: 2, gun: 20, baslik: "Ramazan Bayramı", mesaj: "Ramazan Bayramınız mübarek olsun! Sevdiklerinizle nice mutlu bayramlara. 🍬" },
    { ay: 4, gun: 27, baslik: "Kurban Bayramı", mesaj: "Kurban Bayramınız kutlu olsun. Paylaşmanın ve dayanışmanın günü! 🐑" },
    { ay: 5, gun: 26, baslik: "Hicri Yılbaşı", mesaj: "Yeni Hicri yılın tüm İslam alemine hayırlar getirmesini dileriz." },
    { ay: 8, gun: 4, baslik: "Mevlid Kandili", mesaj: "Mevlid Kandiliniz mübarek, dualarınız kabul olsun. ✨" },
    { ay: 0, gun: 14, baslik: "Regaip Kandili", mesaj: "Mübarek Regaip Kandilinizi tebrik ederiz. ✨" },
    { ay: 1, gun: 12, baslik: "Miraç Kandili", mesaj: "Miraç Kandiliniz mübarek olsun. 🤲" },
    { ay: 2, gun: 2, baslik: "Berat Kandili", mesaj: "Berat Kandilimiz mübarek olsun. 🌙" },
    { ay: 2, gun: 16, baslik: "Kadir Gecesi", mesaj: "Kadir Geceniz mübarek olsun. 🙏" },
    { ay: 6, gun: 5, baslik: "Aşure Günü", mesaj: "Aşure Gününüz mübarek, birliğimiz daim olsun. 🥣" },
];

const tarihteBugun = [
    { ay: 0, gun: 29, baslik: "Tarihte Bugün", mesaj: "1923: Mustafa Kemal Atatürk, ilk Türkiye Cumhurbaşkanı seçildi. 🗳️" },
    { ay: 1, gun: 5, baslik: "Tarihte Bugün", mesaj: "1924: Türkiye'de ilk kadın avukat Süreyya Ağaoğlu görevine başladı. ⚖️" },
    { ay: 2, gun: 12, baslik: "Tarihte Bugün", mesaj: "1930: Türk parasının değerini koruma kanunu kabul edildi. ₺" },
    { ay: 3, gun: 25, baslik: "Tarihte Bugün", mesaj: "1915: Çanakkale Kara Savaşları başladı. 🛡️" },
    { ay: 4, gun: 29, baslik: "Tarihte Bugün", mesaj: "1953: Türkiye'nin ilk yerli uçağı 'Nu.D.38' Ankara'dan İstanbul'a uçtu. ✈️" },
    { ay: 8, gun: 9, baslik: "Tarihte Bugün", mesaj: "1928: Harf Devrimi'nin ilk adımı atıldı; yeni Türk alfabesi tanıtıldı. ✍️" },
    { ay: 11, gun: 5, baslik: "Tarihte Bugün", mesaj: "1934: Türk kadınına seçme ve seçilme hakkı tanındı! 🗳️" },
    { ay: 1, gun: 11, baslik: "Tarihte Bugün", mesaj: "deneme 🗳️" }
];

// Bileşenleri dinamik olarak yükleme fonksiyonu    
async function loadComponents() {
    // Diğer header/footer yükleme kodların...
    await loadSuggestions(); 
}
async function loadSuggestions() {
    const suggestionsContainer = document.getElementById('dynamic-suggestions-list');
    if (!suggestionsContainer) return;

    try {
        // Mevcut kullanıcının ID'sini al
        const currentUid = auth.currentUser ? auth.currentUser.uid : null;

        // Daha fazla kullanıcı çekip içinden eleme yapacağız (Daha iyi bir havuz için 20 kişi çektik)
        const q = query(collection(db, "users"), limit(20));
        const querySnapshot = await getDocs(q);
        
        let usersArray = [];
        querySnapshot.forEach((doc) => {
            // Sadece "ben olmayan" kullanıcıları diziye ekle
            if (doc.id !== currentUid) {
                usersArray.push({ id: doc.id, ...doc.data() });
            }
        });

        // Diziyi rastgele karıştır (Her yenilemede farklı kişiler gelsin)
        usersArray.sort(() => Math.random() - 0.5);

        // Sadece ilk 5 kişiyi seç
        const selectedUsers = usersArray.slice(0, 5);

        suggestionsContainer.innerHTML = ''; // Temizle

        if (selectedUsers.length === 0) {
            suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted);">Önerilecek kullanıcı bulunamadı.</div>';
            return;
        }

        selectedUsers.forEach((user) => {
            const userHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" onclick="window.location.href='.html?uid=${user.id}'">
                        <img src="${user.avatar || 'assets/img/default-avatar.png'}" style="width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--primary); object-fit: cover;">
                        <div style="max-width: 90px; overflow: hidden;">
                            <div style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.displayName || 'İsimsiz'}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">@${user.username || 'user'}</div>
                        </div>
                    </div>
                    <button onclick="followUser('${user.id}')" style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer;">Takip Et</button>
                </div>
            `;
            suggestionsContainer.insertAdjacentHTML('beforeend', userHtml);
        });
    } catch (error) {
        console.error("Öneriler yüklenirken hata:", error);
        suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:red;">Kullanıcılar yüklenemedi.</div>';
    }
}

// Sayfa yüklendiğinde çalıştır
document.addEventListener('DOMContentLoaded', loadComponents);

  const firebaseConfig = {
    apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
    authDomain: "sosyaltrend-21d21.firebaseapp.com",
    projectId: "sosyaltrend-21d21",
    storageBucket: "sosyaltrend-21d21.firebasestorage.app",
    messagingSenderId: "207734473261",
    appId: "1:207734473261:web:f31b6bf2908c6d88986ea4"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

  let user = {
  displayName: "Misafir",
  avatarUrl: "assets/img/strendsaydamv2.png",
  isAdmin: false
};

const ADMIN_EMAIL = "officialfthuzun@gmail.com";

// Avatar sistemini otomatik olarak strendsaydamv2'ye initialize et
localStorage.setItem('st_avatar', 'strendsaydamv2');

onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) 
        { window.location.href = 'login.html'; kontrolEtVeOtomatikPostAt(); } else {
        // Kullanıcı bilgilerini güncelle
        user.username = fbUser.email.split('@')[0];
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        // Avatar URL'i Firestore'dan çek ve eğer yoksa başlangıç verisi oluştur
        try {
            const userRef = doc(db, "users", fbUser.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists() && userDoc.data().avatarUrl) {
                user.avatarUrl = userDoc.data().avatarUrl;
            } else {
                // İlk kez giriş yapıyorsa kullanıcı document'i oluştur
                user.avatarUrl = "assets/img/strendsaydamv2.png";
                try {
                    await setDoc(userRef, {
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl,
                        email: fbUser.email,
                        username: user.username,
                        createdAt: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    console.log("Kullanıcı belgesi başlangıç oluşturma:", e.message);
                }
            }
        } catch (err) {
            console.error("Avatar URL çekilirken hata:", err);
            user.avatarUrl = "assets/img/strendsaydamv2.png";
        }

        // Admin Kontrolü
        user.isAdmin = fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        
        // UI Güncelleme (Profil resmi, isimler vb.)
        updateUIWithUser();
        
        // Real-time kullanıcı profili listener - Avatar değişikliklerini senkronize et
        onSnapshot(doc(db, "users", fbUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                // Avatar değişmişse güncelle
                if (userData.avatarUrl && userData.avatarUrl !== user.avatarUrl) {
                    user.avatarUrl = userData.avatarUrl;
                    localStorage.setItem('st_avatarUrl', userData.avatarUrl);
                    updateUIWithUser();
                    console.log("Avatar real-time güncellendi:", userData.avatarUrl);
                }
                // Display name değişmişse güncelle
                if (userData.displayName && userData.displayName !== user.displayName) {
                    user.displayName = userData.displayName;
                    localStorage.setItem('st_displayName', userData.displayName);
                    updateUIWithUser();
                }
            }
        });
        
        // Eski postların avatarlarını güncelle
        migrateOldAvatars();

        // ADMIN ÖZEL İŞLEMLERİ
        const adminBtn = document.getElementById('adminMenuBtn');
        if (user.isAdmin) {
            // İstatistikleri çek
            updateAdminStats();
            // HTML'deki butonu görünür yap
            if (adminBtn) {
                adminBtn.style.display = 'flex'; // Veya 'block', tasarımınıza göre
            }
        } else {
            // Eğer admin değilse butonu gizle (Güvenlik için önlem)
            if (adminBtn) {
                adminBtn.style.display = 'none';
            }
        }
    }
    
    // Profil sayfasında ziyaretçi profilini kontrol et
    loadVisitorProfile();
});

// Eski postların avatarlarını strendsaydamv2 ile güncellemek
async function migrateOldAvatars() {
    // Bir defa çalış
    if (localStorage.getItem('avatarsMigrated')) return;
    
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        
        postsSnap.forEach(async (postDoc) => {
            const post = postDoc.data();
            // Eğer avatarUrl yoksa, varsayılan URL'i ekle
            if (!post.avatarUrl) {
                await updateDoc(postDoc.ref, { 
                    avatarUrl: "assets/img/strendsaydamv2.png"
                });
            }
        });
        
        localStorage.setItem('avatarsMigrated', 'true');
        console.log("Avatar migration tamamlandı - Eski postlara avatarUrl eklendi");
    } catch (err) {
        console.error("Avatar migration hatası:", err);
    }
}

async function updateAdminStats() {
    if(!user.isAdmin) return;
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        // Elementler sayfada varsa güncelle
        const postStat = document.getElementById('stat-total-posts');
        if (postStat) postStat.innerText = postsSnap.size;
    } catch (error) {
        console.error("Admin istatistikleri yüklenirken hata:", error);
    }
}

// --- PROFIL DUZENLEME VE AVATAR FONKSIYONLARI ---
let tempAvatarBuffer = null;
    window.toggleEditProfile = () => {
        const form = document.getElementById('editProfileSection');
            form.classList.toggle('active');
                document.getElementById('newNameInput').value = user.displayName;
                document.getElementById('newAvatarUrlInput').value = (user.avatarSeed.startsWith('http') ? user.avatarSeed : "");
                    tempAvatarBuffer = null;
    };

/* Profil Resmini(avatarı) Değiştir */
window.handleFileSelect = async (input) => {
    const file = input.files[0];
    if (!file) return;

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert("Dosya boyutu 5MB'dan küçük olmalıdır.");
        input.value = "";
        return;
    }

    try {
        // Firebase Storage'a yükle
        const filename = `avatars/${auth.currentUser.uid}_${Date.now()}`;
        const storageRef = ref(storage, filename);
        
        // Yükleme yapılıyor mesajı göster
        const btn = input.previousElementSibling;
        if (btn) btn.innerText = "Yükleniyor...";
        
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        
        // Firestore'da kullanıcı profilini güncelle
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: downloadUrl
        });
        
        // Local user object'ini güncelle
        user.avatarUrl = downloadUrl;
        localStorage.setItem('st_avatarUrl', downloadUrl);
        
        // UI'ı güncelle
        updateUIWithUser();
        
        // Uyarı
        alert("Avatar başarıyla güncellendi!");
        input.value = "";
        if (btn) btn.innerText = "Cihazdan Seç";
        
    } catch (error) {
        console.error("Avatar yükleme hatası:", error);
        alert("Avatar yüklenirken hata oluştu: " + error.message);
        input.value = "";
    }
};

window.handleUrlInput = async (input) => {
    const url = input.value.trim();
    if (!url) return;
    
    // URL kontrolü
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert("Geçerli bir URL girin (http:// veya https:// ile başlamalı)");
        return;
    }

    try {
        // Firestore'da kullanıcı profilini güuncelle
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: url
        });
        
        // Local user object'ini güncelle
        user.avatarUrl = url;
        localStorage.setItem('st_avatarUrl', url);
        
        // UI'ı güncelle
        updateUIWithUser();
        
        alert("Avatar başarıyla güncellendi!");
        input.value = "";
        
    } catch (error) {
        console.error("Avatar URL ekleme hatası:", error);
        alert("Hata: " + error.message);
    }
};

  window.promptDiceBear = async () => {
    const name = user.displayName || user.username;
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=256`;
    
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: dicebearUrl
        });
        
        user.avatarUrl = dicebearUrl;
        localStorage.setItem('st_avatarUrl', dicebearUrl);
        
        updateUIWithUser();
        
        alert("Avatar başarıyla oluşturuldu!");
        
    } catch (error) {
        console.error("DiceBear avatar oluşturma hatası:", error);
        alert("Hata: " + error.message);
    }
  };

  window.saveProfileChanges = async () => {
    const name = document.getElementById('newNameInput').value.trim();

    if(name) { 
        user.displayName = name; 
        localStorage.setItem('st_displayName', name);
        
        // Firestore'da güncelle
        try {
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                displayName: name
            });
        } catch (err) {
            console.error("Display name güncelleme hatası:", err);
        }
        
        await updateProfile(auth.currentUser, { displayName: name }).catch(e => console.error(e));
    }

    finishUpdate();
  };

  function finishUpdate() {
    alert("Profil başarıyla güncellendi!");
    location.reload();
  }


  window.updateUserEmail = async () => {
    const mail = prompt("Yeni e-posta:");
    if(mail && auth.currentUser) {
      try {
        await updateEmail(auth.currentUser, mail);
        alert("Başarılı! Lütfen yeni maille giriş yapın.");
        logout();
      } catch(e) { alert("Hata: " + e.message); }
    }
  };

  window.sendResetMail = async () => {
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      alert("Sıfırlama bağlantısı gönderildi.");
    } catch(e) { alert("Hata: " + e.message); }
  };

  window.logout = async () => {
    await signOut(auth);
    window.location.href = 'login.html';
  };

let selectedImageBase64 = null;

// Görsel Seçme İşlemi
const imageInput = document.getElementById('imageInput');

// Sadece element sayfada varsa olay dinleyiciyi ekle
if (imageInput) {
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            // Base64 dönüşümü yapılırken boyut kontrolü kritik
            if (file.size > 1024 * 1024) { 
                alert("Lütfen 1MB'dan küçük bir fotoğraf seçin.");
                this.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                selectedImageBase64 = event.target.result;
                const previewImg = document.getElementById('imagePreview');
                const previewContainer = document.getElementById('imagePreviewContainer');
                
                if(previewImg) previewImg.src = selectedImageBase64;
                if(previewContainer) previewContainer.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });
}

// Önizleme Temizleme
window.clearImagePreview = () => {
    selectedImageBase64 = null;
    document.getElementById('imageInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
};
  
// --- ÇEVİRİLER VE KAYDETME ÖZELLİĞİ ---
  const translations = {
    tr: {
      searchPlaceholder: "Arama",
      searchBtn: "Arama",
      menuProfile: "Profiliniz",
      menuSettings: "Ayarlar",
      menuTitle: "Sosyal Menü",
      navFeed: "Anasayfa",
      navPages: "Topluluk Sayfaları",
      navBookmarks: "Kaydedilenler",
      navBookmarkss: "Kaydettiklerinizi bu sayfa altına topladık, buradan takip edebilir veya kaydettiklerinizi kaldırabilirsiniz.",
      navSubs: "Beğendiklerim",
      navSubss: "Beğendiğiniz içerikleri bu sayfa altına topladık, buradan takip edebilir veya beğenileri kaldırabilirsiniz.",
      navSearch: "Aramalar",
      searchHeading: "Arama Sonuçları",
      postPlaceholder: "Neler oluyor?",
      shareBtn: "Paylaş",
      pagesHeading: "Topluluk Sayfaları",
      pagesSub: "Yeni topluluklar kur ve insanlarla etkileşime geç.",
      newPagePlaceholder: "Yeni sayfa adı...",
      createBtn: "Oluştur",
      editProfileBtn: "Profili Düzenle",
      trendPagesTitle: "🔥 Trend Sayfalar",
      footerTagline: "Topluluğunuzla her zaman bir adım önde olun.",
      footerMenu: "Hızlı Menü",
      footerCorp: "Kurumsal",
      footerAbout: "Hakkımızda",
      footerCareer: "Kariyer",
      footerSupport: "Destek",
      footerContact: "İletişim",
      footerHelp: "Yardım Merkezi",
      footerRights: "Tüm Hakları Saklıdır.",
      subBtn: "Abone Ol",
      unsubBtn: "Bırak",
      promptNewName: "Yeni Görünen Ad:",
      confirmDelete: "Bu gönderiyi silmek istediğine emin misin?",
      confirmDeletePage: "Bu sayfayı ve tüm verilerini silmek istediğine emin misin?",
      confirmDeleteComment: "Yorumu silmek istediğine emin misin?",
      myPostsTitle: "Paylaşımlarım",
      settingPrivate: "Gizli Profil",
      settingPrivateDesc: "Profilinizi ve paylaşımlarınızı diğer kullanıcılardan gizleyin.",
      settingTheme: "Koyu Tema",
      commentPlaceholder: "Yorum yaz...",
      sendComment: "Gönder",
      helpHeading: "Yardım Merkezi",
      helpSub: "Sıkça Sorulan Sorular",
      helpText: "SosyalTrend kullanımı hakkında merak ettiğiniz her şey burada.",
      contactHeading: "İletişim",
      contactText: "Bizimle iletişime geçmek için officialfthuzun@gmail.com adresine mail atabilirsiniz.",
      sendBtn: "Mesajı Gönder"
    },
    en: {
      searchPlaceholder: "Search pages or people...",
      searchBtn: "Search",
      menuProfile: "Your Profile",
      menuSettings: "Settings",
      menuTitle: "Menu",
      navFeed: "Feed",
      navPages: "Pages",
      navBookmarks: "Bookmarks",
      navSubs: "Liked Posts",
      navSearch: "Search",
      searchHeading: "Search Results",
      postPlaceholder: "What's happening?",
      shareBtn: "Post",
      pagesHeading: "Community Pages",
      pagesSub: "Build new communities and engage with people.",
      newPagePlaceholder: "New page name...",
      createBtn: "Create",
      editProfileBtn: "Edit Profile",
      trendPagesTitle: "🔥 Trending Pages",
      footerTagline: "Always stay ahead with your community.",
      footerMenu: "Quick Menu",
      footerCorp: "Corporate",
      footerAbout: "About Us",
      footerCareer: "Careers",
      footerSupport: "Support",
      footerContact: "Contact",
      footerHelp: "Help Center",
      footerRights: "All Rights Reserved.",
      subBtn: "Subscribe",
      unsubBtn: "Leave",
      promptNewName: "New Display Name:",
      confirmDelete: "Are sure you want to delete this post?",
      confirmDeletePage: "Are sure you want to delete this page and all its data?",
      confirmDeleteComment: "Are sure you want to delete this comment?",
      myPostsTitle: "My Posts",
      settingPrivate: "Private Profile",
      settingPrivateDesc: "Hide your profile and posts from other users.",
      settingTheme: "Dark Theme",
      commentPlaceholder: "Write a comment...",
      sendComment: "Send",
      helpHeading: "Help Center",
      helpSub: "Frequently Asked Questions",
      helpText: "Everything you wonder about using SosyalTrend is here.",
      contactHeading: "Contact",
      contactText: "To contact us, you can send an e-mail to officialfthuzun@gmail.com.",
      sendBtn: "Send Message"
    }
  };

  let currentLang = localStorage.getItem('st_lang') || 'tr';
  let isPrivate = localStorage.getItem('st_isPrivate') === 'true';

  window.changeLanguage = (lang) => {
    console.log("Dil değişti: " + lang);
    currentLang = lang;
    localStorage.setItem('st_lang', lang);
    applyTranslations(); // Çevirileri uygula
  };

  function applyTranslations() {
    const t = translations[currentLang];
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (t[key]) el.innerText = t[key];
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (t[key]) el.placeholder = t[key];
    });
    const trBtn = document.getElementById('lang-tr');
    const enBtn = document.getElementById('lang-en');
    if(trBtn) trBtn.className = currentLang === 'tr' ? 'active' : 'inactive';
    if(enBtn) enBtn.className = currentLang === 'en' ? 'active' : 'inactive';
  }
  applyTranslations();

function getAvatarUrl(avatarUrlOrSeed, type = 'user') {
    // Eğer HTTPS URL ise direkt döndür (avatarUrl)
    if (avatarUrlOrSeed && typeof avatarUrlOrSeed === 'string' && avatarUrlOrSeed.startsWith('http')) {
        return avatarUrlOrSeed;
    }
    // Admin ikon kontrolü - SADECE admin-shield için özel işlem
    if (avatarUrlOrSeed === 'admin-shield') return "https://api.dicebear.com/7.x/bottts/svg?seed=Admin";
    // Default avatar
    return "assets/img/strendsaydamv2.png";
}

  function updateUIWithUser() {
    const avatarUrl = getAvatarUrl(user.avatarUrl, 'user');
    
    // --- ELEMENT TANIMLAMALARI ---
    const welcomeEl = document.getElementById('welcomeMessage'); // Karşılama metni
    const hAv = document.getElementById('headerAvatar');
    const mDn = document.getElementById('menuDisplayName');
    const mUn = document.getElementById('menuUsername');

    // Sol Menü
    const sAv = document.getElementById('sidebarAvatar');
    const sDn = document.getElementById('sidebarDisplayName');
    const sUn = document.getElementById('sidebarUsername');

    // Profil Sayfası
    const pAv = document.getElementById('profilePageAvatar');
    const pPn = document.getElementById('profilePageName');
    const pPh = document.getElementById('profilePageHandle');

    // Gizlilik Ayarları
    const pTg = document.getElementById('privacyToggle');
    const sPi = document.getElementById('selfPrivateIndicator');
/* ============================ */

    // --- GÜNCELLEMELER ---
    // Üst Bar Karşılama Mesajı Güncelleme
    if (welcomeEl) {
        // user.displayName veya user.username kullanarak içeriği değiştiriyoruz
        const currentName = user.username || user.displayName || "misafir";
        welcomeEl.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size: 0.6rem; animation: pulse 2s infinite;"></i> ${currentName.toLowerCase()}`;
    }

    // Header Güncelleme
    if(hAv) hAv.src = avatarUrl;
    if(mDn) mDn.innerText = user.displayName;
    if(mUn) mUn.innerText = `@${user.username}`;

    // Sol Menü Güncelleme
    if(sAv) sAv.src = avatarUrl;
    if(sDn) sDn.innerText = user.displayName;
    if(sUn) sUn.innerText = `@${user.username}`;

    // Profil Sayfası Güncelleme
    if(pAv) pAv.src = avatarUrl;
    if(pPn) pPn.innerText = user.displayName;
    if(pPh) pPh.innerText = `@${user.username}`;

    // Gizlilik Durumu Güncelleme
    if(pTg) pTg.checked = isPrivate;
    if(sPi) sPi.style.display = isPrivate ? 'block' : 'none';
}

window.togglePrivacy = () => {
      isPrivate = document.getElementById('privacyToggle').checked;
      localStorage.setItem('st_isPrivate', isPrivate);
      updateUIWithUser();
  };

window.navigateTo = (pageId) => {
      console.log(pageId + " sayfasına gidiliyor...");
      
      if(pageId === 'admin' && !user.isAdmin) {
          alert("Bu bölüme sadece yönetici erişebilir!");
          window.navigateTo('feed'); return;
        }

      // Sayfa içeriklerini gizle/göster
      document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
      const target = document.getElementById('page-' + pageId);
      if(target) target.classList.add('active');

      // Navigasyon butonlarını aktif yap
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      const btn = document.getElementById('btn-' + pageId);
      if(btn) btn.classList.add('active');
      window.scrollTo(0,0);
};


//* SEARCH ARAMA FONKSIYONLARI *//
const staticDatabase = {
    pages: [
        { name: "Yardım Merkezi", link: "yardim.html", icon: "fa-life-ring" },
        { name: "Topluluk Kuralları", link: "kurallar.html", icon: "fa-gavel" },
        { name: "Hakkımızda", link: "hakkimizda.html", icon: "fa-info-circle" }
    ]
};

// 2. Sayfa Yüklendiğinde Parametre Kontrolü
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    
    if (searchQuery && window.location.pathname.includes('search.html')) {
        const globalSearchInput = document.getElementById('globalSearch');
        if(globalSearchInput) globalSearchInput.value = searchQuery;
        performGlobalSearch(searchQuery);
    }
});

// 3. Ana Arama Fonksiyonu (Dinamik & Statik)
window.performGlobalSearch = async (forcedQuery = null) => {
    const searchInput = document.getElementById('globalSearch');
    const queryStr = (forcedQuery || searchInput.value).trim().toLowerCase();
    
    if (!queryStr) return;

    // Eğer arama sayfasında değilsek yönlendir
    if (!window.location.pathname.includes('search.html')) {
        window.location.href = `search.html?q=${encodeURIComponent(queryStr)}`;
        return;
    }

    // Element Seçimleri
    const pagesContainer = document.getElementById('search-results-pages');
    const usersContainer = document.getElementById('search-results-users');
    const secPages = document.getElementById('section-pages');
    const secUsers = document.getElementById('section-users');
    const noResults = document.getElementById('search-no-results');
    const status = document.getElementById('searchStatus');
    const resultText = document.getElementById('result-text');
    const t = translations[currentLang] || { subBtn: "Takip Et", unsubBtn: "Takibi Bırak" };

    // Arayüz Sıfırlama
    if(pagesContainer) pagesContainer.innerHTML = "";
    if(usersContainer) usersContainer.innerHTML = "";
    if(secPages) secPages.style.display = "none";
    if(secUsers) secUsers.style.display = "none";
    if(noResults) noResults.style.display = "none";
    if(resultText) resultText.innerText = `"${queryStr}" için sonuçlar`;
    if(status) status.innerText = `Aranıyor...`;

    try {
        let totalFound = 0;

        // --- A. STATİK SAYFA FİLTRELEME ---
        const filteredStatic = staticDatabase.pages.filter(p => p.name.toLowerCase().includes(queryStr));
        filteredStatic.forEach(p => {
            totalFound++;
            secPages.style.display = "block";
            pagesContainer.innerHTML += `
                <div class="result-item" style="padding:15px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;">
                    <i class="fa-solid ${p.icon}" style="color:var(--primary); font-size:1.2rem;"></i>
                    <a href="${p.link}" style="text-decoration:none; color:var(--text-main); font-weight:600;">${p.name}</a>
                </div>`;
        });

        // --- B. FIREBASE SAYFA ARAMASI ---
    const pagesSnap = await getDocs(collection(db, "pages"));
    pagesSnap.forEach(docSnap => {
    const data = docSnap.data();
    
    // Sadece tam eşleşme istiyorsan .includes yerine === kullanabilirsin
    // Veya belirli bir sayfayı hariç tutmak istiyorsan: if (data.name === "İstemediğim Sayfa") return;

    if (data.name && data.name.toLowerCase().includes(queryStr)) {
                totalFound++;
                secPages.style.display = "block";
                const isSub = (data.subscribers || []).includes(user?.username);
                pagesContainer.innerHTML += `
                <div class="glass-card page-card" style="margin-top:10px;">
                    <img src="${getAvatarUrl(data.avatarSeed, 'page')}" class="page-icon" style="width: 50px; height: 50px; border-radius: 8px; margin: 10px auto; display: block;">
                    <div style="font-weight:800; text-align:center;">${data.name}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px; text-align:center;">Topluluk • ${(data.subscribers || []).length} Takipçi</div>
                    <button class="btn-subscribe ${isSub ? 'subscribed' : ''}" onclick="toggleSubscription('${docSnap.id}', ${isSub})">${isSub ? t.unsubBtn : t.subBtn}</button>
                </div>`;
            }
        });

        // --- C. FIREBASE KULLANICI ARAMASI ---
        const postsSnap = await getDocs(collection(db, "posts"));
        let processedUsers = new Set();

        postsSnap.forEach(pDoc => {
            const p = pDoc.data();
            const usernameMatch = p.username && p.username.toLowerCase().includes(queryStr);
            const nameMatch = p.name && p.name.toLowerCase().includes(queryStr);
            
            if (p.username && !p.username.startsWith('page_') && (usernameMatch || nameMatch) && !processedUsers.has(p.username)) {
                processedUsers.add(p.username);
                totalFound++;
                secUsers.style.display = "block";
                usersContainer.innerHTML += `
                <div class="glass-card page-card" style="margin-top:10px;">
                    <img src="${getAvatarUrl(p.avatarSeed, 'user')}" class="page-icon" style="border-radius:50%; width: 50px; height: 50px; margin: 10px auto; display: block; cursor:pointer;" onclick="window.location.href='profil.html?u=${p.username}'">
                    <div style="font-weight:800; text-align:center;">${p.name || 'Kullanıcı'}</div>
                    <div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:10px; text-align:center;">@${p.username}</div>
                    <button class="btn-subscribe" onclick="window.location.href='profil.html?u=${p.username}'">Profiline Git</button>
                </div>`;
            }
        });

        // Sonuç Durumu Güncelleme
        if (totalFound === 0) {
            noResults.style.display = "block";
            status.innerText = "Eşleşen sonuç bulunamadı.";
        } else {
            status.innerText = `${totalFound} sonuç bulundu.`;
        }

    } catch (e) {
        console.error("Arama hatası:", e);
        if(status) status.innerText = "Arama sırasında bir hata oluşti.";
    }
};

// 4. Dinleyiciler ve Yardımcı Fonksiyonlar
const mainSearchBtn = document.getElementById('mainSearchBtn');
if(mainSearchBtn) mainSearchBtn.onclick = () => performGlobalSearch();

const gSearch = document.getElementById('globalSearch');
if(gSearch) gSearch.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') performGlobalSearch();
});

window.searchTrend = (tag) => { 
    const gSearch = document.getElementById('globalSearch');
    if(gSearch) {
        gSearch.value = tag.replace('#', ''); 
        performGlobalSearch();
    }
};

// Zaman formatlama fonksiyonun (Aynen korundu)
function formatTime(timestamp) {
    if(!timestamp) return "...";
    try {
        const date = timestamp.toDate();
        const diff = Math.floor((new Date() - date) / 1000);
        const t = currentLang === 'tr' ? {s:'sn', m:'dk', h:'sa', d:'gn'} : {s:'s', m:'m', h:'h', d:'d'};
        if (diff < 60) return `${diff}${t.s}`;
        if (diff < 3600) return `${Math.floor(diff/60)}${t.m}`;
        if (diff < 86400) return `${Math.floor(diff/3600)}${t.h}`;
        return `${Math.floor(diff/86400)}${t.d}`;
    } catch(e) { return "..."; }
}

/* --- SEARCH SON --- */
    
  window.likePost = async (id, isLiked) => { const ref = doc(db, "posts", id); await updateDoc(ref, { likes: isLiked ? arrayRemove(user.username) : arrayUnion(user.username) }); };
  window.toggleBookmark = async (id, isSaved) => { const ref = doc(db, "posts", id); await updateDoc(ref, { savedBy: isSaved ? arrayRemove(user.username) : arrayUnion(user.username) }); };
  window.toggleCommentSection = (id) => { const el = document.getElementById(`comments-${id}`); if(el) el.style.display = el.style.display === 'none' ? 'block' : 'none'; };
  
  window.addComment = async (id) => {
      const input = document.getElementById(`input-${id}`);
      const text = input.value.trim();
      if(!text) return;
      await updateDoc(doc(db, "posts", id), {
          comments: arrayUnion({ 
              username: user.username, 
              displayName: user.displayName, 
              avatarUrl: user.avatarUrl, 
              text: text, 
              time: Date.now(),
              replies: []
          })
      });
      input.value = "";
  };

window.addReply = async (postId, commentTime) => {
      const replyText = prompt("Yanıtınızı yazın:");
      if (!replyText) return;

      const ref = doc(db, "posts", postId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
          const comments = snap.data().comments;
          const index = comments.findIndex(c => c.time === commentTime);
          if (index !== -1) {
              if (!comments[index].replies) comments[index].replies = [];
              comments[index].replies.push({
                  username: user.username,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  text: replyText,
                  time: Date.now()
              });
              await updateDoc(ref, { comments: comments });
          }
      }
  };

window.deleteComment = async (postId, commentTime, commentText) => {
    if(confirm(translations[currentLang].confirmDeleteComment)) {
        const ref = doc(db, "posts", postId);
        const snap = await getDoc(ref);
        if(snap.exists()){
            const data = snap.data();
            const commentToRemove = data.comments.find(c => c.time === commentTime && c.text === commentText);
            if(commentToRemove) { await updateDoc(ref, { comments: arrayRemove(commentToRemove) }); }
        }
    }
  };

window.deleteReply = async (postId, commentTime, replyTime) => {
      if(confirm("Bu yanıtı silmek istediğinize emin misiniz?")) {
          const ref = doc(db, "posts", postId);
          const snap = await getDoc(ref);
          if (snap.exists()) {
              const comments = snap.data().comments;
              const cIndex = comments.findIndex(c => c.time === commentTime);
              if (cIndex !== -1) {
                  comments[cIndex].replies = comments[cIndex].replies.filter(r => r.time !== replyTime);
                  await updateDoc(ref, { comments: comments });
              }
          }
      }
  };

window.deletePost = async (id) => { if(confirm(translations[currentLang].confirmDelete)) await deleteDoc(doc(db, "posts", id)); }
/* Pages feature removed */

/* GÖNDERİ AYARLARI */
onSnapshot(query(collection(db, "posts"), orderBy("timestamp", "desc")), (snap) => {
      const feed = document.getElementById('feed-items'), 
            myPosts = document.getElementById('my-posts-list'), 
            myLikes = document.getElementById('my-liked-list'), 
            bookItems = document.getElementById('bookmark-items'), 
            t = translations[currentLang];

      if(feed) feed.innerHTML = ""; 
      if(myPosts) myPosts.innerHTML = ""; 
      if(bookItems) bookItems.innerHTML = ""; 
      if(myLikes) myLikes.innerHTML = "";

      snap.forEach(d => {
          const p = d.data(), 
                isPage = p.username?.startsWith('page_') || p.username === 'official_system', 
                isMine = p.username === user.username || p.adminUser === user.username, 
                isLiked = p.likes?.includes(user.username), 
                isSaved = p.savedBy?.includes(user.username);
            
          
          const avatarUrl = getAvatarUrl(p.avatarUrl || p.avatarSeed || "assets/img/strendsaydamv2.png", isPage ? 'page' : 'user');
          const contentWithLinks = (p.content || "").replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
          // Profil linki: Kendi profili ise 'profil', başkasıysa 'profil.html?id=username'
          const profileLink = isMine ? "javascript:navigateTo('profil')" : `profil.html?id=${encodeURIComponent(p.username)}`;
          const targetNav = isMine ? 'profil' : (isPage ? 'pages' : 'feed');
          
         const postImageHtml = p.image ? `
    <div class="post-image-wrapper" style="
    margin: 12px auto;
    border-radius: 12px;
    overflow: hidden;
    background: rgb(0, 0, 0);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: 0.3s ease-in-out;
    max-height: 103%;
    max-width: 50%;
    height: auto;
    width: 100%;
    ">
        <img src="${p.image}" 
             loading="lazy"
             style="
                width: 100%; 
                height: 100%; 
                object-fit: cover; 
                cursor: zoom-in;
                transition: all 0.3s ease;
             " 
             onclick="toggleImageExpand(this)"
             alt="Post görseli">
    </div>
` : "";

const postHtml = `
    <div class="glass-card post" style="${p.username === 'official_system' ? 'border: 2px solid var(--primary); background: rgba(99, 102, 241, 0.05);' : ''}; position: relative;">
        <div style="position: absolute; top: 15px; right: 15px; display: flex; gap: 8px;">
             ${(isMine || user.isAdmin) ? `
                  <button onclick="openEditModal('${d.id}', \`${p.content.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'post')" style="background:none; border:none; color:var(--text-muted); cursor:pointer;">
                      <i class="fa-solid fa-pen"></i>
                  </button>
                  <button class="post-delete-btn" style="position:static;" onclick="deletePost('${d.id}')">
                      <i class="fa-solid fa-trash"></i>
                  </button>
              ` : ''}
        </div>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
              <img src="${avatarUrl}" class="${isPage ? 'page-avatar' : 'user-avatar'}" style="cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">
              <div>
                  <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">
                      ${p.name} ${isPage ? '<i class="fa-solid fa-circle-check" style="color:var(--primary); font-size:0.7rem;"></i>' : ''}
                      <span class="post-time">• ${formatTime(p.timestamp)}</span>
                      ${p.isEdited ? `<span style="font-size: 0.6rem; color: var(--text-muted); font-weight: normal;">(düzenlendi)</span>` : ''}
                  </div>
                  <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="${isMine ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(p.username)}'`}">@${p.username}</div>
              </div>
        </div>
        
        <p style="white-space: pre-wrap; margin-bottom:10px;">${contentWithLinks}</p>
        
        ${postImageHtml}

        <div style="display:flex; gap:12px;">
              <button class="tool-btn" onclick="likePost('${d.id}', ${isLiked})" style="gap:5px; color:${isLiked ? '#ef4444' : ''}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${p.likes?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleCommentSection('${d.id}')" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleBookmark('${d.id}', ${isSaved})" style="color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
        </div>
        
        <div id="comments-${d.id}" class="comment-area" style="display:none;">
              <div id="list-${d.id}">
                  ${(p.comments || []).map(c => `
                      <div class="comment-item" style="flex-direction: column; align-items: flex-start; gap: 5px;">
                          <div style="display: flex; align-items: center; width: 100%; gap: 10px;">
                              <img src="${getAvatarUrl(c.avatarUrl || c.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 24px; height: 24px; border-radius: 50%; cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">
                              <div style="flex: 1;">
                                  <span class="comment-meta" style="cursor:pointer;" onclick="${c.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(c.username)}'`}">${c.displayName}</span> 
                                  <span style="font-size: 0.8rem;">${c.text}</span>
                                  ${c.isEdited ? `<small style="font-size: 0.65rem; color: var(--text-muted); margin-left: 4px;">(düzenlendi)</small>` : ''}
                              </div>
                              <div style="display: flex; gap: 5px;">
                                ${(c.username === user.username) ? `
                                    <button onclick="openEditModal('${d.id}', \`${c.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'comment', ${c.time})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem;">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                ` : ''}
                                ${(c.username === user.username || user.isAdmin) ? `
                                    <button class="comment-del-btn" onclick="deleteComment('${d.id}', ${c.time}, '${c.text.replace(/'/g, "\\'")}')">
                                        <i class="fa-solid fa-trash-can"></i>
                                    </button>
                                ` : ''}
                              </div>
                          </div>
                          <div style="margin-left: 34px; width: calc(100% - 34px);">
                              ${(c.replies || []).map(r => `
                                  <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 8px;">
                                      <img src="${getAvatarUrl(r.avatarUrl || r.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 18px; height: 18px; border-radius: 50%; cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">
                                      <div style="font-size: 0.75rem; flex: 1;">
                                          <b style="color:var(--primary); cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">${r.displayName}</b> ${r.text}
                                          ${r.isEdited ? `<small style="font-size: 0.6rem; color: var(--text-muted); margin-left: 4px;">(düzenlendi)</small>` : ''}
                                      </div>
                                      <div style="display: flex; gap: 5px; align-items: center;">
                                          ${(r.username === user.username) ? `
                                              <button onclick="openEditModal('${d.id}', \`${r.text.replace(/`/g, '\\`').replace(/"/g, '&quot;').replace(/\n/g, '\\n')}\`, 'reply', ${c.time}, ${r.time})" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.7rem;">
                                                  <i class="fa-solid fa-pen"></i>
                                              </button>
                                          ` : ''}
                                          ${(r.username === user.username || user.isAdmin) ? `
                                              <button class="comment-del-btn" style="font-size:0.6rem; position:static; background:none; border:none; color:#ef4444; cursor:pointer;" onclick="deleteReply('${d.id}', ${c.time}, ${r.time})">
                                                  <i class="fa-solid fa-xmark"></i>
                                              </button>
                                          ` : ''}
                                      </div>
                                  </div>
                              `).join('')}
                              <button onclick="addReply('${d.id}', ${c.time})" style="background:none; border:none; color:var(--text-muted); font-size:0.7rem; cursor:pointer; margin-top:5px; font-weight:bold;">Yanıtla</button>
                          </div>
                      </div>`).join('')}
              </div>
              <div style="display:flex; gap:8px; margin-top:10px;">
                  <input type="text" id="input-${d.id}" placeholder="${t.commentPlaceholder}" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
                  <button onclick="addComment('${d.id}')" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">${t.sendComment}</button>
              </div>
        </div>
    </div>`;
          if(feed) feed.innerHTML += postHtml;
          if(p.username === user.username && myPosts) myPosts.innerHTML += postHtml;
          if(isLiked && myLikes) myLikes.innerHTML += postHtml;
          if(isSaved && bookItems) bookItems.innerHTML += postHtml;
      });
  });

  const shareBtn = document.getElementById('shareBtn');
  if(shareBtn) {
  shareBtn.onclick = async () => {
    const val = document.getElementById('postInput').value.trim();
    
    // Eğer hem metin hem de resim boşsa paylaşma
    if(!val && !selectedImageBase64) return;

    try {
      await addDoc(collection(db, "posts"), { 
          name: user.displayName, 
          username: user.username, 
          avatarUrl: user.avatarUrl,
          content: val, 
          // RESİM VERİSİNİ BURAYA EKLEDİK:
          image: selectedImageBase64 || null, 
          timestamp: serverTimestamp(), 
          likes: [], 
          savedBy: [], 
          comments: [] 
      });
      
      // Paylaşım sonrası temizlik
      document.getElementById('postInput').value = "";
      window.clearImagePreview(); // Önizlemeyi ve değişkeni sıfırla
    } catch (e) {
      console.error("Paylaşım hatası:", e);
      alert("Gönderi paylaşılamadı.");
    }
  };
}

  setInterval(() => {
    const n = new Date();
    const sH = document.getElementById('secHand');
    const mH = document.getElementById('minHand');
    const hH = document.getElementById('hourHand');
    const dC = document.getElementById('digiClock');
    const dD = document.getElementById('dateDisplay');

    if(sH) sH.style.transform = `translateX(-50%) rotate(${n.getSeconds()*6}deg)`;
    if(mH) mH.style.transform = `translateX(-50%) rotate(${n.getMinutes()*6}deg)`;
    if(hH) hH.style.transform = `translateX(-50%) rotate(${(n.getHours()*30)+(n.getMinutes()/2)}deg)`;
    if(dC) dC.innerText = n.toLocaleTimeString(currentLang === 'tr' ? 'tr-TR' : 'en-US');
    
    if(dD) {
      const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
      dD.innerText = n.toLocaleDateString(currentLang === 'tr' ? 'tr-TR' : 'en-US', options);
    }
  }, 1000);

  const profileTrigger = document.getElementById('profileTrigger');
  if(profileTrigger) {
    profileTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      const menu = document.getElementById('dropdownMenu');
      if(menu) menu.classList.toggle('active'); 
    };
  }

  window.onclick = () => {
    const menu = document.getElementById('dropdownMenu');
    if(menu) menu.classList.remove('active');
  };
/* ============================ */

/* Gündem özelliği kaldırıldı */

/* MOBİLE VERSİYONDA İÇERİK AYARLAMA */
document.addEventListener('DOMContentLoaded', () => {
    const leftBtn = document.getElementById('leftOpenBtn');
    const rightBtn = document.getElementById('rightOpenBtn');
    const leftAside = document.querySelector('aside');
    const rightAside = document.querySelector('.right-panel');
    const overlay = document.getElementById('sideOverlay');

    const toggleLeft = () => {
        if (leftAside && overlay) { // Güvenlik kontrolü
            leftAside.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };

    const toggleRight = () => {
        if (rightAside && overlay) { // Güvenlik kontrolü
            rightAside.classList.toggle('active');
            overlay.classList.toggle('active');
        }
    };

    const closeAll = () => {
        leftAside?.classList.remove('active');
        rightAside?.classList.remove('active');
        overlay?.classList.remove('active');
    };

    // BURASI ÖNEMLİ: Sadece eleman varsa olay ataması yap
    if (leftBtn) leftBtn.onclick = toggleLeft;
    if (rightBtn) rightBtn.onclick = toggleRight;
    if (overlay) overlay.onclick = closeAll;
});
/* ============================   */

// Ziyaretçi Profili Göster
async function loadVisitorProfile() {
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
    
    // Ziyaretçi modu değilse çık (kendi profili)
    if (!visitedUsername || visitedUsername === user.username) return;
    
    // Ziyaretçi modu etkinleştir
    console.log(`${visitedUsername} profilini ziyaret ediyorsunuz...`);
    
    // Profil düzenle butonunu gizle
    const editBtn = document.querySelector('[onclick*="toggleEditProfile"]');
    if (editBtn) editBtn.style.display = 'none';
    
    // Profil düzenle formunu gizle
    const editSection = document.getElementById('editProfileSection');
    if (editSection) editSection.style.display = 'none';
    
    // Beğendiklerim ve Kaydedilenler sekmelerini gizle
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach((btn, idx) => {
        if (idx === 1 || idx === 2) { // 1 = Beğendiklerim, 2 = Kaydedilenler
            btn.style.display = 'none';
        }
    });
    
    // Ilgili tab içeriklerini gizle
    const likedTab = document.getElementById('my-likes-tab');
    const savesTab = document.getElementById('my-saves-tab');
    if (likedTab) likedTab.style.display = 'none';
    if (savesTab) savesTab.style.display = 'none';
    
    try {
        // Firestore'dan başka kullanıcının postlarını çek
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        
        let visitorDisplayName = visitedUsername;
        let visitorAvatar = null;
        let visitorPosts = [];
        
        snap.forEach(doc => {
            const p = doc.data();
            if (p.username === visitedUsername) {
                visitorPosts.push({ id: doc.id, ...p });
                if (visitorDisplayName === visitedUsername) {
                    visitorDisplayName = p.name || visitedUsername;
                    visitorAvatar = getAvatarUrl(p.avatarSeed, 'user');
                }
            }
        });
        
        // Profil başlığını güncelle
        const profileName = document.getElementById('profilePageName');
        if (profileName) profileName.innerText = visitorDisplayName;
        
        const profileHandle = document.getElementById('profilePageHandle');
        if (profileHandle) profileHandle.innerText = `@${visitedUsername}`;
        
        const profileAvatar = document.getElementById('profilePageAvatar');
        if (profileAvatar) {
            profileAvatar.src = visitorAvatar || getAvatarUrl("strendsaydamv2", 'user');
        }
        
        // Ziyaretçinin postlarını göster
        const myPostsList = document.getElementById('my-posts-list');
        if (myPostsList) {
            myPostsList.innerHTML = "";
            if (visitorPosts.length === 0) {
                myPostsList.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">
                    <i class="fa-regular fa-newspaper" style="font-size:3rem; margin-bottom:15px;"></i>
                    <p>${visitorDisplayName} henüz gönderi paylaşmamış.</p>
                </div>`;
            } else {
                visitorPosts.forEach(post => {
                    const avatarUrl = getAvatarUrl(post.avatarSeed, 'user');
                    const contentWithLinks = (post.content || "").replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
                    
                    const postImageHtml = post.image ? `
                        <div class="post-image-wrapper" style="margin: 12px auto; border-radius: 12px; overflow: hidden; background: rgb(0, 0, 0); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; max-height: 103%; max-width: 50%; height: auto; width: 100%;">
                            <img src="${post.image}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; cursor: zoom-in;" onclick="toggleImageExpand(this)" alt="Post görseli">
                        </div>
                    ` : "";
                    
                    const isLiked = post.likes?.includes(user.username);
                    
                    const postHtml = `
                        <div class="glass-card post" style="position: relative;">
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <img src="${avatarUrl}" class="user-avatar" style="cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                <div>
                                    <div style="font-weight:700; display:flex; align-items:center; gap:5px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">
                                        ${post.name}
                                        <span class="post-time">• ${formatTime(post.timestamp)}</span>
                                    </div>
                                    <div style="font-size:0.75rem; color:var(--text-muted); cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(post.username)}'">@${post.username}</div>
                                </div>
                            </div>
                            
                            <p style="white-space: pre-wrap; margin-bottom:10px;">${contentWithLinks}</p>
                            ${postImageHtml}
                            
                            <div style="display:flex; gap:12px;">
                                <button class="tool-btn" onclick="likePost('${post.id}', ${isLiked})" style="gap:5px; color:${isLiked ? '#ef4444' : ''}">
                                    <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${post.likes?.length || 0}</span>
                                </button>
                                <button class="tool-btn" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${post.comments?.length || 0}</span></button>
                            </div>
                        </div>
                    `;
                    
                    myPostsList.innerHTML += postHtml;
                });
            }
        }
        
        console.log(`${visitorDisplayName} (${visitedUsername}) profilinin ${visitorPosts.length} gönderi gösteriliyor`);
    } catch (err) {
        console.error("Ziyaretçi profili yüklenirken hata:", err);
    }
}

// PROFİL YÖNLENDİRME
window.navigateTo = function (page, userId = null) {
    if (!page) return;

    page = page.toLowerCase();

    if (page === 'profil' || page === 'profil') {
        if (userId) {
            location.href = `profil.html?id=${encodeURIComponent(userId)}`;
        } else {
            location.href = `profil.html`;
        }
        return;
    }

    if (page === 'feed' || page === 'home' || page === 'index') {
        location.href = 'index.html';
        return;
    }

    location.href = `${page}.html`;
};
/* ============================   */

let currentEditType = null; 
let editTarget = {}; // { postId, commentTime, replyTime }

// Modalı Aç (Post, Comment ve Reply destekli)
window.openEditModal = function(postId, content, type = 'post', commentTime = null, replyTime = null) {
    currentEditType = type;
    editTarget = { postId, commentTime, replyTime };
    
    const modal = document.getElementById('editModal');
    const input = document.getElementById('editPostInput');
    const title = modal.querySelector('h3');

    if (modal && input) {
        // Başlığı tipe göre dinamik yapıyoruz
        if(type === 'post') title.innerText = "Gönderiyi Düzenle";
        else if(type === 'comment') title.innerText = "Yorumu Düzenle";
        else if(type === 'reply') title.innerText = "Yanıtı Düzenle";
        
        input.value = content;
        modal.style.display = 'flex';
    }
};

window.closeEditModal = function() {
    const modal = document.getElementById('editModal');
    if (modal) modal.style.display = 'none';
    currentEditType = null;
    editTarget = {};
};

// Ortak Kaydetme İşlemi
document.getElementById('saveEditBtn').onclick = async () => {
    const newContent = document.getElementById('editPostInput').value.trim();
    if (!newContent || !editTarget.postId) return;

    try {
        const postRef = doc(db, "posts", editTarget.postId);

        if (currentEditType === 'post') {
            // 1. GÖNDERİ GÜNCELLEME
            await updateDoc(postRef, {
                content: newContent,
                isEdited: true
            });
        } 
        else {
            // Yorum veya Yanıt güncellemek için önce belgeyi çekiyoruz
            const postSnap = await getDoc(postRef);
            if (postSnap.exists()) {
                const comments = postSnap.data().comments || [];
                
                const updatedComments = comments.map(c => {
                    // 2. YORUM GÜNCELLEME
                    if (currentEditType === 'comment' && c.time === editTarget.commentTime) {
                        return { ...c, text: newContent, isEdited: true };
                    }
                    
                    // 3. YANIT GÜNCELLEME (Yorumun içindeki yanıtlar dizisi)
                    if (currentEditType === 'reply' && c.time === editTarget.commentTime) {
                        const updatedReplies = (c.replies || []).map(r => 
                            r.time === editTarget.replyTime ? { ...r, text: newContent, isEdited: true } : r
                        );
                        return { ...c, replies: updatedReplies };
                    }
                    
                    return c;
                });

                await updateDoc(postRef, { comments: updatedComments });
            }
        }
        window.closeEditModal();
    } catch (error) {
        console.error("Güncelleme hatası:", error);
        alert("İşlem başarısız oldu.");
    }
};

// Karşılama mesajı için global fonksiyon (app.js'den çağrılacak)
  window.updateWelcomeMessage = (username) => {
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) {
      const name = username ? username : "misafir";
      welcomeEl.innerText = `${name.toLowerCase()}`;
    }
  };
/* ============================ */

/* Header üst bar bilgi ekranı*/
function updateClock() {
    const now = new Date();

    // Tarih Ayarları (Örn: 31 Ocak 2026 Cumartesi)
    const dateOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    };

    // Saat Ayarları (Örn: 10:32:05)
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    const dateStr = now.toLocaleDateString('tr-TR', dateOptions);
    const timeStr = now.toLocaleTimeString('tr-TR', timeOptions);
    const timeElement = document.getElementById('topBarDateTime');
    if(timeElement) {
        // Tarih ve Saati farklı opasitelerle ayırarak daha okunaklı kıldık
        timeElement.innerHTML = `
            <span style="opacity: 0.7;">
                <i class="fa-regular fa-calendar-check"></i> ${dateStr}
            </span>
            <span style="margin: 0 8px; opacity: 0.3;">|</span>
            <span style="color: #fff; font-weight: 700;">
                <i class="fa-regular fa-clock"></i> ${timeStr}
            </span>
        `;
    }
  }

  // Her saniye güncelleme başlat
  setInterval(updateClock, 1000);
  updateClock();
/* ============================ */

// --- DARK MODE -- //
window.toggleDarkMode = () => {
  const btn = document.getElementById('themeToggleBtn');
  const isDark = document.body.classList.toggle('dark-mode');

  btn.innerHTML = isDark
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';

  localStorage.setItem('st_theme', isDark ? 'dark' : 'light');
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Önce butonu bir değişkene atayalım
    const themeBtn = document.getElementById('themeToggleBtn');

    if (localStorage.getItem('st_theme') === 'dark') {
        document.body.classList.add('dark-mode');
        
        // 2. Sadece buton varsa innerHTML değiştirmeye çalış
        if (themeBtn) {
            themeBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
        }
    }
});
/* ============================ */

/* EMOJİ KODU */
document.addEventListener('DOMContentLoaded', () => {
    const emojiToggle = document.getElementById('emojiToggle');
    const emojiPicker = document.getElementById('emojiPicker');
    const postInput = document.getElementById('postInput');

    if (!emojiToggle || !emojiPicker || !postInput) return;

    emojiToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPicker.style.display =
            emojiPicker.style.display === 'grid' ? 'none' : 'grid';
    });

    emojiPicker.querySelectorAll('span').forEach(emoji => {
        emoji.addEventListener('click', () => {
            postInput.value += emoji.textContent;
            emojiPicker.style.display = 'none';
            postInput.focus();
        });
    });

    document.addEventListener('click', () => {
        emojiPicker.style.display = 'none';
    });
});
/* ============================ */

async function kontrolEtVeOtomatikPostAt() {
    const simdi = new Date();
    const bugunGun = simdi.getDate();
    const bugunAy = simdi.getMonth();
    
    // Yarını kontrol et (Mübarek günler için 1 gün önceden)
    const yarin = new Date(simdi);
    yarin.setDate(simdi.getDate() + 1);
    const yarinGun = yarin.getDate();
    const yarinAy = yarin.getMonth();

    const sonKontrol = localStorage.getItem('last_auto_post_check');
    const bugunStr = simdi.toDateString();

    // Günde sadece 1 kez kontrol etmesini sağlayalım
    if (sonKontrol === bugunStr) return;

    // 1. Mübarek Gün Kontrolü (1 Gün Önceden)
    ozelGunler.forEach(async (gun) => {
        if (gun.gun === yarinGun && gun.ay === yarinAy) {
            await otomatikPostPaylas(`📢 HATIRLATMA: ${gun.baslik}`, gun.mesaj);
        }
    });

    // 2. Tarihte Bugün Kontrolü (O gün içinde)
    tarihteBugun.forEach(async (olay) => {
        if (olay.gun === bugunGun && olay.ay === bugunAy) {
            await otomatikPostPaylas(`⏳ Tarihte Bugün: ${olay.baslik}`, olay.mesaj);
        }
    });

    localStorage.setItem('last_auto_post_check', bugunStr);
}

// Firebase'e gönderi gönderen yardımcı fonksiyon
async function otomatikPostPaylas(baslik, icerik) {
    try {
        await addDoc(collection(db, "posts"), {
            author: "Sistem Mesajı",
            authorEmail: "officialfthuzun@gmail.com",
            authorImage: "assets/img/strendsaydamv2.ico", // Bot ikonu
            content: `${baslik}\n\n${icerik}`,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        });
        console.log("Otomatik post paylaşıldı: " + baslik);
    } catch (e) {
        console.error("Post paylaşılırken hata oluştu: ", e);
    }
}

/* RESİM BOYUTLANDIRMA */
window.toggleImageExpand = (img) => {
    const wrapper = img.parentElement;
    
    if (img.style.objectFit !== 'contain') {
        // TAM BOY MODU
        img.style.objectFit = 'contain';
        img.style.cursor = 'zoom-out';
        
        wrapper.style.height = 'auto';
        wrapper.style.maxHeight = '80vh'; // Ekran boyunu aşmasın
        wrapper.style.width = '100%';
        wrapper.style.maxWidth = '100%';    // Genişliği serbest bırak
        wrapper.style.backgroundColor = '#000';
        wrapper.style.margin = '12px auto'; // Dıştan ortala
    } else {
        // KARE (NORMAL) MOD
        img.style.objectFit = 'cover';
        img.style.cursor = 'zoom-in';
        
        wrapper.style.height = '399px';      // Senin istediğin yükseklik
        wrapper.style.width = '225px';       // Senin istediğin genişlik
        wrapper.style.maxWidth = '225px';
        wrapper.style.backgroundColor = '#0f172a';
        wrapper.style.margin = '12px auto';  // Akış içinde ortalı kalsın
    }
};

// Fotoğraf Yükleme Fonksiyonu
window.handleGalleryUpload = async (input) => {
    const file = input.files[0];
    if (file) {
        if (file.size > 1024 * 1024) { // 1MB Sınırı
            alert("Lütfen 1MB'dan küçük bir fotoğraf seçin.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            try {
                // Firebase 'user_gallery' koleksiyonuna ekle
                await addDoc(collection(db, "user_gallery"), {
                    username: user.username,
                    imageUrl: base64Data,
                    timestamp: serverTimestamp()
                });
                alert("Fotoğraf galeriye eklendi!");
                loadUserGallery(); // Galeriyi yenile
            } catch (error) {
                console.error("Yükleme hatası:", error);
            }
        };
        reader.readAsDataURL(file);
    }
};

// Fotoğrafları Çekme ve Görüntüleme Fonksiyonu
window.loadUserGallery = async () => {
    const galleryGrid = document.getElementById('userGalleryGrid');
    if (!galleryGrid) return;

    // Sadece aktif kullanıcıya ait fotoğrafları getir
    const q = query(collection(db, "user_gallery"), orderBy("timestamp", "desc"));
    
    onSnapshot(q, (snapshot) => {
        galleryGrid.innerHTML = "";
        snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.username === user.username) {
                galleryGrid.innerHTML += `
                    <div class="gallery-item" style="position: relative; aspect-ratio: 1/1;">
                        <img src="${data.imageUrl}" onclick="toggleImageExpand(this)" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px; cursor: zoom-in;">
                    </div>`;
            }
        });
    });
};

// Sayfa yüklendiğinde galeriyi başlat
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('profil.html')) {
        loadUserGallery();
    }
});

/**
 * SosyalTrend - Dinamik Bileşen Yükleyici ve Menü Yönetimi
 */

// 1. Bileşenleri (Header/Footer) Yükleyen Fonksiyon
async function loadComponent(elementId, filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`Dosya bulunamadı: ${filePath}`);
        
        const html = await response.text();
        const element = document.getElementById(elementId);
        
        if (element) {
            element.innerHTML = html;
            console.log(`${elementId} başarıyla yüklendi.`);
            
            // Bileşen yüklendikten sonra i18n (dil) fonksiyonun varsa tetikleyebilirsin
            // if (typeof updateContent === 'function') updateContent();
        }
    } catch (error) {
        console.error("Bileşen yükleme hatası:", error);
    }
}

// 2. Sayfa Yüklendiğinde Başlat
document.addEventListener("DOMContentLoaded", () => {
    // Parçaları yükle
    loadComponent("header-placeholder", "partials/header.html");
    loadComponent("footer-placeholder", "partials/footer.html");
});

// 3. Global Tıklama Dinleyicisi (Event Delegation)
// Bu yöntem, elemanlar fetch ile sonradan gelse bile tıklamayı yakalar.
document.addEventListener('click', (e) => {
    const dropdownMenu = document.getElementById('dropdownMenu');
    const profileTrigger = e.target.closest('#profileTrigger');

    // Profil tetikleyiciye tıklandıysa
    if (profileTrigger) {
        if (dropdownMenu) {
            dropdownMenu.classList.toggle('active');
            e.stopPropagation(); // Tıklamanın dışarı sızmasını engelle
        }
    } 
    // Menü açıkken dışarıya tıklandıysa kapat
    else if (dropdownMenu && dropdownMenu.classList.contains('active')) {
        if (!dropdownMenu.contains(e.target)) {
            dropdownMenu.classList.remove('active');
        }
    }
});
