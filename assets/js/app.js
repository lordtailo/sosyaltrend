import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, updatePassword, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/* Özel Günler ve Tarihte Bugün Veri Seti */
const ozelGunler = [
   // Resmi Tatiller ve Özel Günler
{ ay: 0, gun: 1, baslik: "Yılbaşı", mesaj: "Yeni yılın tüm SosyalTrend ailesine huzur ve mutluluk getirmesini dileriz! 🎄✨" },
{ ay: 1, gun: 14, baslik: "Sevgililer Günü", mesaj: "Sevginin paylaştıkça çoğaldığı bir gün dileriz! ❤️" },
{ ay: 2, gun: 8, baslik: "Dünya Kadınlar Günü", mesaj: "Emeğiyle dünyayı güzelleştiren tüm kadınların günü kutlu olsun! 💐" },
{ ay: 2, gun: 18, baslik: "Çanakkale Zaferi", mesaj: "18 Mart Çanakkale Zaferi’nin yıl dönümünde şehitlerimizi minnetle anıyoruz. 🇹🇷" },
{ ay: 3, gun: 23, baslik: "Ulusal Egemenlik ve Çocuk Bayramı", mesaj: "23 Nisan kutlu olsun! Geleceğimiz çocuklara emanet. 🇹🇷" },
{ ay: 4, gun: 1, baslik: "Emek ve Dayanışma Günü", mesaj: "Tüm çalışanların 1 Mayıs işçi bayramı kutlu olsun! 🛠️" },
{ ay: 4, gun: 19, baslik: "Atatürk'ü Anma, Gençlik ve Spor Bayramı", mesaj: "19 Mayıs Atatürk'ü Anma, Gençlik ve Spor Bayramımız kutlu olsun! 🇹🇷" },
{ ay: 6, gun: 15, baslik: "Demokrasi ve Milli Birlik Günü", mesaj: "15 Temmuz Demokrasi ve Milli Birlik Günü'nde şehitlerimizi anıyoruz." },
{ ay: 7, gun: 30, baslik: "Zafer Bayramı", mesaj: "30 Ağustos Zafer Bayramımız kutlu olsun! 🇹🇷" },
{ ay: 9, gun: 29, baslik: "Cumhuriyet Bayramı", mesaj: "Cumhuriyetimizin yeni yaşını gururla kutluyoruz! 29 Ekim kutlu olsun! 🇹🇷" },
{ ay: 10, gun: 10, baslik: "Atatürk'ü Anma Günü", mesaj: "Gazi Mustafa Kemal Atatürk'ü saygı ve özlemle anıyoruz. 🖤" },
{ ay: 11, gun: 24, baslik: "Öğretmenler Günü", mesaj: "Gelecek nesilleri yetiştiren tüm öğretmenlerimizin günü kutlu olsun! 🎓" },

// 2026 Dini Günler (Diyanet İşleri Başkanlığı Resmi Takvimi)
{ ay: 0, gun: 15, baslik: "Miraç Kandili", mesaj: "Miraç Kandiliniz mübarek olsun. 🤲" },
{ ay: 1, gun: 2, baslik: "Berat Kandili", mesaj: "Berat Kandilimiz mübarek olsun. 🌙" },
{ ay: 1, gun: 19, baslik: "Ramazan Başlangıcı", mesaj: "Hoş geldin Ya Şehr-i Ramazan! 🌙" },
{ ay: 2, gun: 16, baslik: "Kadir Gecesi", mesaj: "Kadir Geceniz mübarek olsun. 🙏" },
{ ay: 2, gun: 20, baslik: "Ramazan Bayramı (1. Gün)", mesaj: "Ramazan Bayramınız mübarek olsun! 🍬" },
{ ay: 4, gun: 27, baslik: "Kurban Bayramı (1. Gün)", mesaj: "Kurban Bayramınız kutlu olsun. Paylaşmanın ve dayanışmanın günü! 🐑" },
{ ay: 5, gun: 16, baslik: "Hicri Yılbaşı", mesaj: "Yeni Hicri yılın (1448) hayırlar getirmesini dileriz." },
{ ay: 5, gun: 25, baslik: "Aşure Günü", mesaj: "Aşure Gününüz mübarek, birliğimiz daim olsun. 🥣" },
{ ay: 7, gun: 24, baslik: "Mevlid Kandili", mesaj: "Mevlid Kandiliniz mübarek olsun. ✨" },
{ ay: 11, gun: 10, baslik: "Üç Ayların Başlangıcı", mesaj: "Üç ayların başlangıcı hayırlara vesile olsun. 🌙" },
{ ay: 11, gun: 14, baslik: "Regaip Kandili", mesaj: "Regaip Kandiliniz mübarek olsun. ✨"}
];

const tarihteBugun = [
    { ay: 0, gun: 29, baslik: "Tarihte Bugün", mesaj: "1923: Mustafa Kemal Atatürk, ilk Türkiye Cumhurbaşkanı seçildi. 🗳️" },
    { ay: 1, gun: 5, baslik: "Tarihte Bugün", mesaj: "1924: Türkiye'de ilk kadın avukat Süreyya Ağaoğlu görevine başladı. ⚖️" },
    { ay: 2, gun: 12, baslik: "Tarihte Bugün", mesaj: "1930: Türk parasının değerini koruma kanunu kabul edildi. ₺" },
    { ay: 3, gun: 25, baslik: "Tarihte Bugün", mesaj: "1915: Çanakkale Kara Savaşları başladı. 🛡️" },
    { ay: 4, gun: 29, baslik: "Tarihte Bugün", mesaj: "1953: Türkiye'nin ilk yerli uçağı 'Nu.D.38' Ankara'dan İstanbul'a uçtu. ✈️" },
    { ay: 8, gun: 9, baslik: "Tarihte Bugün", mesaj: "1928: Harf Devrimi'nin ilk adımı atıldı; yeni Türk alfabesi tanıtıldı. ✍️" },
    { ay: 11, gun: 5, baslik: "Tarihte Bugün", mesaj: "1934: Türk kadınına seçme ve seçilme hakkı tanındı! 🗳️" }
];

// HELPER FONKSİYONLAR
// Button'un "disabled/pending" durumuna koy
function disableButton(btn, text) {
    if (btn) {
        btn.innerHTML = text;
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'default';
        btn.onclick = (e) => e.preventDefault();
    }
}

// Update character counter below comment input
function updateCommentCount(postId) {
    const input = document.getElementById(`input-${postId}`);
    const counter = document.getElementById(`charcount-${postId}`);
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/200`;
}

// Track length for main post box (share)
function updatePostCount() {
    const input = document.getElementById('postInput');
    const counter = document.getElementById('post-charcount');
    if (!input || !counter) return;
    const len = input.value.length;
    counter.textContent = `${len}/280`;
}

// Request card'ı sil
function removeRequestCard(uid) {
    const card = document.getElementById(`friend-request-${uid}`);
    if (card) {
        card.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => card.remove(), 300);
    }
}

// Bileşenleri dinamik olarak yükleme fonksiyonu    
async function loadComponents() {

// Diğer header/footer yükleme kodların...
    await loadSuggestions();
    
    // Avatar input listener'ı
    const fileInput = document.getElementById('fileAvatarInput');
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            handleFileSelect(this);
        });
    }
    
    // Paylaş modalını önceden oluştur
    createShareModal();
}

// Expose sendNotification for manual testing from console
window.sendNotification = sendNotification;
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
            // tüm kullanıcıları diziye ekle (kendimiz de dahil)
            usersArray.push({ id: doc.id, ...doc.data() });
        });

        // Diziyi rastgele karıştır (Her yenilemede farklı kişiler gelsin)
        usersArray.sort(() => Math.random() - 0.5);

        // Sadece ilk 5 kişiyi seç
        const selectedUsers = usersArray.slice(0, 5);
        // Eğer giriş yapan kullanıcı seçilmediyse en son elemana kendisini koy
        if (auth.currentUser) {
            const currentUid = auth.currentUser.uid;
            if (!selectedUsers.some(u => u.id === currentUid)) {
                const selfIdx = usersArray.findIndex(u => u.id === currentUid);
                if (selfIdx !== -1) {
                    selectedUsers[selectedUsers.length - 1] = usersArray[selfIdx];
                }
            }
        }

        suggestionsContainer.innerHTML = ''; // Temizle

        if (selectedUsers.length === 0) {
            suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:var(--text-muted);">Önerilecek kullanıcı bulunamadı.</div>';
            return;
        }

        // Eğer giriş yapan varsa, arkadaş/durum bilgilerini çek
        let currentUserData = {};
        if (auth.currentUser) {
            try {
                const curDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (curDoc.exists()) currentUserData = curDoc.data();
            } catch (e) {
                console.warn('Kullanıcı verisi alınamadı:', e);
            }
        }

        const friends = currentUserData.friends || [];
        const sentRequests = currentUserData.sentRequests || [];
        const incomingRequests = currentUserData.friendRequests || [];

        selectedUsers.forEach((user) => {
                    const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=random&color=fff`;
                    const userAvatar = user.avatarUrl || user.avatar || fallbackAvatar;

            const isFriend = friends.includes(user.id);
            const isSent = sentRequests.some(r => r.toUid === user.id);
            const isIncoming = incomingRequests.some(r => r.fromUid === user.id);
            const isSelf = auth.currentUser && user.id === auth.currentUser.uid;

            let btnLabel = 'Arkadaş Olarak Ekle';
            let btnAttrs = 'style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer;"';
            let btnOnclick = `onclick="sendFriendRequestToUid('${user.id}', '${user.username}')"`;

            if (isSelf) {
                btnLabel = 'Profilinize Gidin';
                btnAttrs = 'style="background: var(--primary); color: white; border: none; padding: 6px 12px; border-radius: 15px; font-size: 0.7rem; font-weight: 700; cursor: pointer;"';
                btnOnclick = "onclick=\"window.location='profil.html'\"";
            } else if (isFriend) {
                btnLabel = 'Zaten Arkadaşsınız';
                btnAttrs = 'disabled style="opacity:0.6; cursor:default; background:#94a3b8; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700;"';
                btnOnclick = '';
            } else if (isSent) {
                // allow cancellation from suggestions
                btnLabel = 'İsteği iptal et';
                btnAttrs = 'style="background: var(--primary); color: white; border: none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700; cursor:pointer;"';
                btnOnclick = `onclick="cancelFriendRequestToUid('${user.id}', '${user.username}')"`;
            } else if (isIncoming) {
                btnLabel = 'İstek Bekleniyor';
                btnAttrs = 'disabled style="opacity:0.6; cursor:default; background:#94a3b8; color:#fff; border:none; padding:6px 12px; border-radius:15px; font-size:0.7rem; font-weight:700;"';
                btnOnclick = '';
            }

            const userHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; cursor: pointer;" 
                         onclick="window.location.href='${isSelf ? 'profil.html' : `profil.html?id=${encodeURIComponent(user.username)}`}'">                        <img src="${userAvatar}" 
                             alt="${user.displayName || 'User'}"
                             style="width: 38px; height: 38px; border-radius: 50%; border: 1.5px solid var(--primary); object-fit: cover;">
                        <div style="max-width: 90px; overflow: hidden;">
                            <div style="font-size: 0.8rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${user.displayName || 'İsimsiz'}
                            </div>
                            <div style="font-size: 0.7rem; color: var(--text-muted);">
                                @${user.username || 'user'}
                            </div>
                        </div>
                    </div>
                    <button id="addFriendBtn_sugg_${user.id}" ${btnOnclick} ${btnAttrs}>
                        ${btnLabel}
                    </button>
                </div>
            `;

            suggestionsContainer.insertAdjacentHTML('beforeend', userHtml);
            // programmatic binding in case inline onclick fails or global function missing
            if (isSent) {
                const btnEl = document.getElementById('addFriendBtn_sugg_' + user.id);
                if (btnEl) {
                    btnEl.onclick = () => cancelFriendRequestToUid(user.id, user.username);
                }
            }
        });
    } catch (error) {
        console.error("Öneriler yüklenirken hata:", error);
        suggestionsContainer.innerHTML = '<div style="font-size:0.7rem; color:red;">Kullanıcılar yüklenemedi.</div>';
    }
}

// Sayfa yüklendiğinde çalıştır (parçalar yüklendikten sonra)
document.addEventListener('includesLoaded', loadComponents);

  const firebaseConfig = {
    apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
    authDomain: "sosyaltrend-21d21.firebaseapp.com",
    projectId: "sosyaltrend-21d21",
    storageBucket: "sosyaltrend-21d21.firebasestorage.app",
    messagingSenderId: "207734473261",
    appId: "1:207734473261:web:f31b6bf2908c6d88986ea4"
  };

// Hızlı UID ile arkadaş isteği gönderme (suggestions içinden çağrılır)
async function sendFriendRequestToUid(targetUid, targetUsername) {
    // sendFriendRequestToUid - hızlı arkadaş isteği
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }
    // Kendinize istek gönderilmesini engelle
    if (targetUid === auth.currentUser.uid) {
        alert('Kendinize arkadaşlık isteği gönderemezsiniz.');
        return;
    }

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const targetDoc = await getDoc(targetUserRef);
        if (!targetDoc.exists()) {
            alert('Kullanıcı bulunamadı');
            return;
        }

        const friendRequest = {
    fromUid: auth.currentUser.uid,
    fromUsername: user.username,
    fromName: user.displayName,
    fromAvatar: user.avatarUrl,
    timestamp: Date.now(), // serverTimestamp() yerine Date.now() kullanıldı
    status: 'pending'
};

        await updateDoc(targetUserRef, { friendRequests: arrayUnion(friendRequest) }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(targetUserRef, { friendRequests: [friendRequest] }, { merge: true });
            }
        });

        // serverTimestamp() yerine Date.now() kullanarak hatayı çözüyoruz
const requestData = { 
    toUid: targetUid, 
    toUsername: targetUsername, 
    toName: (targetDoc.data().displayName || targetUsername), 
    toAvatar: (targetDoc.data().avatarUrl || 'assets/img/strendsaydamv2.png'), 
    timestamp: Date.now() // DEĞİŞİKLİK BURADA
};

await updateDoc(currentUserRef, { 
    sentRequests: arrayUnion(requestData) 
}).catch(async (err) => {
    if (err.code === 'not-found') {
        await setDoc(currentUserRef, { 
            sentRequests: [requestData] // Burada da Date.now() içeren objeyi kullandık
        }, { merge: true });
    }
});

        // UI: butonu güncelle - iptal edilebilir hâle getir
        const btn = document.getElementById('addFriendBtn_sugg_' + targetUid);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.onclick = () => cancelFriendRequestToUid(targetUid, targetUsername);
        }

    } catch (err) {
        console.error('Hızlı arkadaş isteği gönderme hatası:', err);
        alert('İstek gönderilemedi: ' + err.message);
    }
}

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

  let user = {
  displayName: "Misafir",
  avatarUrl: "assets/img/strendsaydamv2.png",
  isAdmin: false
};

// Utility: wait for a DOM selector to appear (returns element or null)
function waitForElement(selector, timeout = 5000, interval = 200) {
    return new Promise((resolve) => {
        const start = Date.now();
        (function check() {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            if (Date.now() - start > timeout) return resolve(null);
            setTimeout(check, interval);
        })();
    });
}

const ADMIN_EMAIL = "officialfthuzun@gmail.com";

// Avatar sistemini otomatik olarak strendsaydamv2'ye initialize et
localStorage.setItem('st_avatar', 'strendsaydamv2');

onAuthStateChanged(auth, async (fbUser) => {
    if (!fbUser) 
        { window.location.href = 'login.html'; kontrolEtVeOtomatikPostAt(); } else {
        // Kullanıcı bilgilerini güncelle
        user.username = fbUser.email.split('@')[0];
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        // Avatar URL'i Firestore'dan çek
        try {
            const userRef = doc(db, "users", fbUser.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists() && userDoc.data().avatarUrl) {
                // Firestore'dan gelen avatar var
                user.avatarUrl = userDoc.data().avatarUrl;
            } else {
                // Varsayılan avatar
                user.avatarUrl = "assets/img/strendsaydamv2.png";
                
                // İlk kez giriş - document oluştur
                try {
                    await setDoc(userRef, {
                        displayName: user.displayName,
                        avatarUrl: user.avatarUrl,
                        email: fbUser.email,
                        username: user.username,
                        createdAt: serverTimestamp()
                    }, { merge: true });
                } catch (e) {
                    // User already exists
                }
            }
                    // no privacy sync needed, revert to original behaviour

        } catch (err) {
            console.error("Avatar yükleme hatası:", err);
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
                }
                // Display name değişmişse güncelle
                if (userData.displayName && userData.displayName !== user.displayName) {
                    user.displayName = userData.displayName;
                    localStorage.setItem('st_displayName', userData.displayName);
                    updateUIWithUser();
                }
                // Bildirimleri (arkadaş istekleri + diğer bildirimler) güncelle
                loadNotifications(userData);
                // isPrivate değişmişse yerelde de sakla
                if (typeof userData.isPrivate !== 'undefined' && userData.isPrivate !== isPrivate) {
                    isPrivate = userData.isPrivate;
                    localStorage.setItem('st_isPrivate', isPrivate);
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
    
    // Kendi profili açılıyorsa
    const params = new URLSearchParams(location.search);
    const visitedUsername = params.get('id');
    if (!visitedUsername || visitedUsername === user.username) {
        // localStorage'ı temizle
        localStorage.removeItem('visiting_username');
        
        // Arkadaş butonu gizle
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.style.display = 'none';
        }
        
        // Profili Düzenle butonunu göster
        const editBtn = document.getElementById('editProfileBtn');
        if (editBtn) {
            editBtn.style.display = 'inline-block';
        }
        
        if (auth.currentUser) {
            // Kendi profilse tüm arkadaşları yükle ve varsayılan tabı açık bırak
            loadFriendsList(null, true);
        }
    } else {
        // Başka bir profil ziyareti
        if (auth.currentUser) {
            // otomatik 'Ortak Arkadaşlar' sekmesini aç
            const friendsTabBtn = document.getElementById('friends-tab-btn');
            if (friendsTabBtn) {
                friendsTabBtn.click();
            }
            // yükle (isOwnProfile=false)
            loadFriendsList(null, false);
        }
    }
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
        if (form) {
            form.classList.toggle('active');
            
            // Mevcut değerleri doldur
            const nameInput = document.getElementById('newNameInput');
            if (nameInput) nameInput.value = user.displayName || "";
            
            const urlInput = document.getElementById('newAvatarUrlInput');
            if (urlInput && user.avatarUrl && user.avatarUrl.startsWith('http')) {
                urlInput.value = user.avatarUrl;
            }
            
            tempAvatarBuffer = null;
        } else {
            console.warn("editProfileSection element bulunamadı!");
        }
    };

    // ----------------------------------
    // Ayarlar menüsü / gizlilik vs.
    // ----------------------------------
    window.toggleProfileSettings = () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.toggle('visible');
    };

    window.changePassword = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        if (!auth.currentUser) return alert('Giriş yapmalısınız');
        const newPass = prompt(translations[currentLang].changePassword + ':');
        if (newPass && newPass.length >= 6) {
            try {
                await updatePassword(auth.currentUser, newPass);
                alert('✅ Şifreniz güncellendi');
            } catch (e) {
                console.error(e);
                alert('❌ Şifre değiştirilemedi: ' + e.message);
            }
        } else if (newPass) {
            alert('Şifre en az 6 karakter olmalıdır');
        }
    };

    window.changeEmail = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        if (!auth.currentUser) return alert('Giriş yapmalısınız');
        const newEmail = prompt(translations[currentLang].changeEmail + ':');
        if (newEmail && newEmail.includes('@')) {
            try {
                await updateEmail(auth.currentUser, newEmail);
                alert('✅ E-posta adresiniz güncellendi');
            } catch (e) {
                console.error(e);
                alert('❌ E-posta değiştirilemedi: ' + e.message);
            }
        } else if (newEmail) {
            alert('Geçerli bir e-posta girin');
        }
    };

    window.toggleProfilePrivacy = async () => {
        const menu = document.getElementById('profileSettingsMenu');
        if (menu) menu.classList.remove('visible');
        isPrivate = !isPrivate;
        localStorage.setItem('st_isPrivate', isPrivate);
        // Firestore'a kaydetmek için
        if (auth.currentUser) {
            try {
                await updateDoc(doc(db, 'users', auth.currentUser.uid), { isPrivate });
            } catch (e) {
                console.error('privacy update error', e);
            }
        }
        updateUIWithUser();
        alert(isPrivate ? '✅ Profiliniz artık gizli.' : '✅ Profiliniz artık herkese açık.');
    };

    // global click listener menüyü kapatmak için
    document.addEventListener('click', (e) => {
        const menu = document.getElementById('profileSettingsMenu');
        // if click is not inside the menu and not on the settings button (or its children)
        if (menu && !menu.contains(e.target) && !e.target.closest('#settingsBtn')) {
            menu.classList.remove('visible');
        }
    });

// Kullanıcının tüm eski postlarının avatarını güncelle
async function updateUserPostsAvatar(username, newAvatarUrl) {
    try {
        const postsSnap = await getDocs(
            query(collection(db, "posts"), where("username", "==", username))
        );
        
        postsSnap.forEach(async (postDoc) => {
            try {
                await updateDoc(postDoc.ref, {
                    avatarUrl: newAvatarUrl
                });
            } catch (err) {
                console.error("Post güncelleme hatası:", err);
            }
        });
        
        // Comment'leri de güncelle
        await updateUserCommentsAvatar(username, newAvatarUrl);
        
    } catch (error) {
        console.error("Post güncelleme sorgusi hatası:", error);
    }
}

// Kullanıcının tüm comment ve reply'larının avatarını güncelle
async function updateUserCommentsAvatar(username, newAvatarUrl) {
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        
        postsSnap.forEach(async (postDoc) => {
            const post = postDoc.data();
            if (!post.comments || post.comments.length === 0) return;
            
            let updated = false;
            const updatedComments = post.comments.map(comment => {
                let updatedComment = { ...comment };
                
                // Comment'in avatarını güncelle
                if (comment.username === username) {
                    updatedComment.avatarUrl = newAvatarUrl;
                    updated = true;
                }
                
                // Reply'ların avatarını güncelle
                if (comment.replies && comment.replies.length > 0) {
                    updatedComment.replies = comment.replies.map(reply => {
                        if (reply.username === username) {
                            updated = true;
                            return { ...reply, avatarUrl: newAvatarUrl };
                        }
                        return reply;
                    });
                }
                
                return updatedComment;
            });
            
            // Eğer bir değişiklik varsa Firestore'da update et
            if (updated) {
                try {
                    await updateDoc(postDoc.ref, {
                        comments: updatedComments
                    });
                } catch (err) {
                    console.error("Comment güncelleme hatası:", err);
                }
            }
        });
        
    } catch (error) {
        console.error("Comment güncelleme hatası:", error);
    }
}


/* Profil Resmini Değiştir */
window.handleFileSelect = async (input) => {
    const file = input.files[0];
    if (!file || !auth.currentUser) return;

    if (file.size > 1024 * 1024) {
        alert("Dosya 1MB'dan küçük olmalıdır!");
        input.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
        try {
            const base64Data = reader.result;
            const userRef = doc(db, "users", auth.currentUser.uid);
            
            // Dizi olmadığı için burada serverTimestamp() kullanmak güvenlidir.
            await updateDoc(userRef, {
                avatarUrl: base64Data,
                avatarType: "local",
                avatarUpdatedAt: serverTimestamp() 
            });
            
            user.avatarUrl = base64Data;
            updateUIWithUser();
            alert("✅ Profil resminiz güncellendi!");
            input.value = "";
        } catch (error) {
            console.error("Avatar hatası:", error);
            alert("❌ Hata: " + error.message);
        }
    };
    reader.readAsDataURL(file);
};

// export module-level function for HTML onclicks
window.sendFriendRequest = async () => {
    // delegate to the real implementation defined later in this module
    if (typeof sendFriendRequest === 'function') {
        return sendFriendRequest();
    }
    // fallback: do nothing
};

window.handleUrlInput = async (input) => {
    const url = input.value.trim();
    if (!url) return;
    
    // Auth kontrolü
    if (!auth.currentUser) {
        alert("Lütfen giriş yapın!");
        return;
    }
    
    // URL kontrolü
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert("Geçerli URL girin (http:// ile başlamalı)");
        return;
    }

    try {
        // Firestore'da kaydet
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: url,
            avatarType: "url"
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    avatarUrl: url,
                    avatarType: "url",
                    displayName: user.displayName,
                    email: auth.currentUser.email
                });
            } else {
                throw err;
            }
        });
        
        user.avatarUrl = url;
        updateUIWithUser();
        
        // Eski postları güncelle (background'da)
        updateUserPostsAvatar(user.username, url);
        
        alert("Avatar güncellendi!");
        input.value = "";
        
    } catch (error) {
        console.error("Hata:", error);
        alert("Hata: " + error.message);
    }
};

  window.promptDiceBear = async () => {
    // Auth kontrolü
    if (!auth.currentUser) {
        alert("Lütfen giriş yapın!");
        return;
    }
    
    const name = user.displayName || user.username;
    const dicebearUrl = `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=256`;
    
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            avatarUrl: dicebearUrl,
            avatarType: "dicebear"
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(doc(db, "users", auth.currentUser.uid), {
                    avatarUrl: dicebearUrl,
                    avatarType: "dicebear",
                    displayName: user.displayName,
                    email: auth.currentUser.email
                });
            } else {
                throw err;
            }
        });
        
        user.avatarUrl = dicebearUrl;
        updateUIWithUser();
        
        // Eski postları güncelle (background'da)
        updateUserPostsAvatar(user.username, dicebearUrl);
        
        alert("Avatar oluşturuldu!");
        
    } catch (error) {
        console.error("Hata:", error);
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
      navBookmarks: "Kaydedilenler",
      navBookmarkss: "Kaydettiklerinizi bu sayfa altına topladık, buradan takip edebilir veya kaydettiklerinizi kaldırabilirsiniz.",
      navSubs: "Beğendiklerim",
      navSubss: "Beğendiğiniz içerikleri bu sayfa altına topladık, buradan takip edebilir veya beğenileri kaldırabilirsiniz.",
      navSearch: "Aramalar",
      searchHeading: "Arama Sonuçları",
      postPlaceholder: "Neler oluyor?",
      shareBtn: "Paylaş",
      editProfileBtn: "Profili Düzenle",
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
      changePassword: "Şifreni Değiştir",
      changeEmail: "E-postanı Değiştir",
      privacyOption: "Profilini Gizle",
      privacyOptionShow: "Profilini Göster",
      privateLabel: "Gizli",
      privateBanner: "Profiliniz Gizli",
      profileHiddenMessage: "Bu profil gizlidir.",
      friendViewNote: "Profil arkadaşlara açık",
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
      navBookmarks: "Bookmarks",
      navSubs: "Liked Posts",
      navSearch: "Search",
      searchHeading: "Search Results",
      postPlaceholder: "What's happening?",
      shareBtn: "Post",
      editProfileBtn: "Edit Profile",
      changePassword: "Change Password",
      changeEmail: "Change Email",
      privacyOption: "Hide Profile",
      privacyOptionShow: "Show Profile",
      privateLabel: "Private",
      profileHiddenMessage: "This profile is private.",
      privateBanner: "Your profile is private",
      friendViewNote: "Profile visible to friends",
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
    // Language changed
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
    // after translations we might need to re-sync dynamic UI text like privacy
    updateUIWithUser();
  }
  applyTranslations();

function getAvatarUrl(avatarUrlOrSeed, type = 'user') {
    // Eğer string ise kontrol et
    if (avatarUrlOrSeed && typeof avatarUrlOrSeed === 'string') {
        // HTTP/HTTPS URL'si veya Data URL (Base64)
        if (avatarUrlOrSeed.startsWith('http') || avatarUrlOrSeed.startsWith('data:')) {
            return avatarUrlOrSeed;
        }
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
    if(sPi) {
        // only show indicator when on own profile
        let showInd = isPrivate;
        const params = new URLSearchParams(location.search);
        const visitedUsername = params.get('id');
        if (visitedUsername && visitedUsername !== user.username) {
            showInd = false;
        }
        sPi.style.display = showInd ? 'block' : 'none';
    }
    const pBanner = document.getElementById('selfPrivateBanner');
    if(pBanner) {
        // only show banner when viewing own profile
        let showBanner = isPrivate;
        const params = new URLSearchParams(location.search);
        const visitedUsername = params.get('id');
        if (visitedUsername && visitedUsername !== user.username) {
            showBanner = false;
        }
        pBanner.style.display = showBanner ? 'block' : 'none';
    }
    // update simulate button label if present
    const simBtn = document.getElementById('simulateVisitorBtn');
    if (simBtn) {
        simBtn.innerText = isSimulatingVisitor() ? 'Simülasyonu Kapat' : 'Ziyaretçi Gözünden Gör';
    }

    // Ayarlar menüsündeki gizlilik metnini güncelle
    const privText = document.getElementById('privacyMenuText');
    if(privText) {
        privText.innerText = isPrivate
            ? (translations[currentLang].privacyOptionShow || 'Profilini Göster')
            : (translations[currentLang].privacyOption || 'Profilini Gizle');
    }
}

window.togglePrivacy = () => {
      isPrivate = document.getElementById('privacyToggle').checked;
      localStorage.setItem('st_isPrivate', isPrivate);
      updateUIWithUser();
  };

window.navigateTo = (pageId) => {
      // Navigate to page
      
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
    const usersContainer = document.getElementById('search-results-users');
    const secUsers = document.getElementById('section-users');
    const noResults = document.getElementById('search-no-results');
    const status = document.getElementById('searchStatus');
    const resultText = document.getElementById('result-text');
    const t = translations[currentLang] || { subBtn: "Takip Et", unsubBtn: "Takibi Bırak" };

    // Arayüz Sıfırlama
    if(usersContainer) usersContainer.innerHTML = "";
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
    
window.likePost = async (id, isLiked) => {
    try {
        const ref = doc(db, "posts", id);
        // önce gönderiyi oku (sahibi için bildirim göndermek üzere)
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();

        const addingLike = !isLiked;
        await updateDoc(ref, { likes: addingLike ? arrayUnion(user.username) : arrayRemove(user.username) });

        // Eğer beğenen kişi gönderi sahibi değilse ve beğenme ekleniyorsa bildirim gönder
        if (addingLike && post.username && post.username !== user.username) {
            // hedef kullanıcının UID'sini al
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                // gönderi sahibine beğeni bildirimi gönder
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_like', user.displayName, { postId: id, postContent: postSnippet });
            }
        }
    } catch (e) {
        console.error('likePost hatası:', e);
    }
};
  window.toggleBookmark = async (id, isSaved) => {
    try {
        const ref = doc(db, "posts", id);
        // read post to know owner for notification
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();

        const saving = !isSaved;
        await updateDoc(ref, { savedBy: saving ? arrayUnion(user.username) : arrayRemove(user.username) });

        // notify owner when someone else saves their post
        if (saving && post.username && post.username !== user.username) {
            const uQuery = query(collection(db, "users"), where("username", "==", post.username), limit(1));
            const uSnap = await getDocs(uQuery);
            if (!uSnap.empty) {
                const recipientUid = uSnap.docs[0].id;
                const postSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
                await sendNotification(recipientUid, 'post_saved', user.displayName, { postId: id, postContent: postSnippet });
            }
        }
        // also send a small confirmation to ourselves so we see something
        if (saving && auth.currentUser) {
            const meSnippet = post.content ? post.content.slice(0, 50) : '(Görselli gönderi)';
            await sendNotification(auth.currentUser.uid, 'saved_self', user.displayName, { postId: id, postContent: meSnippet });
        }
    } catch (e) {
        console.error('toggleBookmark hatası:', e);
    }
  };  window.toggleCommentSection = (id) => { const el = document.getElementById(`comments-${id}`); if(el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
        // update counter when opened
        if (el.style.display === 'block') updateCommentCount(id);
    } };
  
  window.addComment = async (id) => {
      const input = document.getElementById(`input-${id}`);
      const text = input.value.trim();
      if(!text) return;
      try {
          const postRef = doc(db, "posts", id);
          const commentObj = {
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              text: text,
              time: Date.now(),
              replies: []
          };

          await updateDoc(postRef, { comments: arrayUnion(commentObj) });

          // Bildirim: gönderi sahibi farklıysa bildir
          const postSnap = await getDoc(postRef);
          if (postSnap.exists()) {
              const postData = postSnap.data();
              if (postData.username && postData.username !== user.username) {
                  const uQuery = query(collection(db, "users"), where("username", "==", postData.username), limit(1));
                  const uSnap = await getDocs(uQuery);
                  if (!uSnap.empty) {
                      const recipientUid = uSnap.docs[0].id;
                      // Send notification
                      await sendNotification(recipientUid, 'post_comment', user.displayName, { postId: id, commentText: text });
                  }
              }
          }

          input.value = "";
      } catch (e) {
          console.error('addComment hatası:', e);
      }
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

              // Bildirim: eğer yorum sahibi biz değilsek, ona bir reply bildirimi gönder
              const parentComment = comments[index];
              if (parentComment.username && parentComment.username !== user.username) {
                  try {
                      const uQuery = query(collection(db, "users"), where("username", "==", parentComment.username), limit(1));
                      const uSnap = await getDocs(uQuery);
                      if (!uSnap.empty) {
                          const recipientUid = uSnap.docs[0].id;
                          await sendNotification(recipientUid, 'comment_reply', user.displayName, { postId: postId, commentText: replyText });
                      }
                  } catch (err) {
                      console.error('reply notification error:', err);
                  }
              }
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
let showAllFeedPosts = false;
let currentPostsUnsubscribe = null;

window.loadPostsFeed = (showAll = false) => {
  if (showAll) showAllFeedPosts = true;
  if (currentPostsUnsubscribe) currentPostsUnsubscribe();
  
  const queryConstraints = [orderBy("timestamp", "desc")];
  if (!showAllFeedPosts) {
    queryConstraints.push(limit(7));
  }
  
  currentPostsUnsubscribe = onSnapshot(query(collection(db, "posts"), ...queryConstraints), (snap) => {
      try {
          const feed = document.getElementById('feed-items'), 
                myPosts = document.getElementById('my-posts-list'), 
                myLikes = document.getElementById('my-liked-list'), 
                bookItems = document.getElementById('bookmark-items'), 
                t = translations[currentLang];
          // debug: snapshot summary
          try { console.log('loadPostsFeed snapshot:', { size: snap.size, ids: snap.docs.map(d=>d.id) }); } catch(e) { console.log('snapshot log failed', e); }
          // accumulate HTML so we can replace in one shot and avoid flicker
          let feedHtml = '';
          let myPostsHtml = '';
          let likesHtml = '';
          let bookHtml = '';



      let feedPostCount = 0;
      if (snap.empty) {
          console.warn('loadPostsFeed: empty snapshot');
          return; // don't wipe existing content
      }
      snap.forEach(d => {
          try {
              console.log('rendering post', d.id);
              const p = d.data(), 
                    isPage = p.username?.startsWith('page_') || p.username === 'official_system', 
                    isMine = p.username === user.username || p.adminUser === user.username, 
                    isLiked = p.likes?.includes(user.username), 
                    isSaved = p.savedBy?.includes(user.username);
              console.log(' post meta', { username: p.username, type: p.type, question: p.question });
                  
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

        const postHtmlBase = `
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
        
        ${(() => {
            if (p.type === 'poll') {
                let html = '';
                if (p.text) {
                    html += `<p style="white-space: pre-wrap; margin-bottom:8px;">${p.text}</p>`;
                }
                html += `<div class="poll-question">${p.question}</div>`;
                html += '<div class="poll-options">';
                const opts = p.options || [];
                opts.forEach((opt, idx) => {
                    const hasVoted = auth.currentUser && opt.voters && opt.voters.includes(auth.currentUser.uid);
                    html += `<button ${hasVoted ? 'disabled' : ''} onclick="votePoll('${d.id}', ${idx})">${opt.text} (${opt.votes||0})</button>`;
                });
                html += '</div>';
                return html;
            } else {
                return `<p style="white-space: pre-wrap; margin-bottom:10px;">${contentWithLinks}</p>${postImageHtml}`;
            }
        })()}

        <div id="likers-${d.id}" style="display:flex; align-items:center; gap:8px; margin-bottom:10px; min-height:28px;"></div>

        <div style="display:flex; gap:12px;">
              <button class="tool-btn" onclick="likePost('${d.id}', ${isLiked})" style="gap:5px; color:${isLiked ? '#ef4444' : ''}"><i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i><span>${p.likes?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleCommentSection('${d.id}')" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length || 0}</span></button>
              <button class="tool-btn" onclick="toggleBookmark('${d.id}', ${isSaved})" style="color:${isSaved ? '#f59e0b' : ''}"><i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></button>
              <button class="tool-btn" onclick="window.openShareMenu('${d.id}')" style="gap:5px; margin-left:auto;"><i class="fa-solid fa-share"></i></button>
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
                              <div class="comment-actions" style="display: flex; gap: 5px;">
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
                                  <div class="comment-reply" style="display: flex; align-items: center; gap: 8px; margin-top: 5px; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 8px;">
                                      <img src="${getAvatarUrl(r.avatarUrl || r.avatarSeed || 'assets/img/strendsaydamv2.png', 'user')}" style="width: 18px; height: 18px; border-radius: 50%; cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">
                                      <div style="font-size: 0.75rem; flex: 1;">
                                          <b style="color:var(--primary); cursor:pointer;" onclick="${r.username === user.username ? "navigateTo('profil')" : `location.href='profil.html?id=${encodeURIComponent(r.username)}'`}">${r.displayName}</b> ${r.text}
                                          ${r.isEdited ? `<small style="font-size: 0.6rem; color: var(--text-muted); margin-left: 4px;">(düzenlendi)</small>` : ''}
                                      </div>
                                      <div class="comment-actions" style="display: flex; gap: 5px; align-items: center;">
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
                              <button class="reply-btn" onclick="addReply('${d.id}', ${c.time})" style="background:none; border:none; color:var(--text-muted); font-size:0.7rem; cursor:pointer; margin-top:5px; font-weight:bold;">Yanıtla</button>
                          </div>
                      </div>`).join('')}
              </div>
              <div style="display:flex; flex-direction:column; gap:4px; margin-top:10px;">
                  <div style="display:flex; gap:8px;">
                      <input type="text" id="input-${d.id}" placeholder="${t.commentPlaceholder}" oninput="updateCommentCount('${d.id}')" maxlength="200" style="flex:1; padding:8px 12px; border-radius:10px; border:1px solid var(--border); outline:none; background: var(--input-bg); color: var(--text-main);">
                      <button onclick="addComment('${d.id}')" style="background:var(--primary); color:white; border:none; padding:0 15px; border-radius:10px; cursor:pointer;">${t.sendComment}</button>
                  </div>
                  <span id="charcount-${d.id}" style="font-size:0.7rem; color:var(--text-muted); text-align:right;">0/200</span>
              </div>
        </div>
    </div>`;
          // Feed'e eklenen posta HTML'e benzersiz id ekleyelim (hash ile yönlendirme için)
          const postHtmlForFeed = postHtmlBase.replace('<div class="glass-card post"', `<div id="post-${d.id}" class="glass-card post"`);

          if(feed) feedHtml += postHtmlForFeed;
          if(p.username === user.username && myPosts) myPostsHtml += postHtmlBase;
          if(isLiked && myLikes) likesHtml += postHtmlBase;
          if(isSaved && bookItems) bookHtml += postHtmlBase;
          
          // Likers preview'ı doldur
          try {
              if (window.populateLikersPreview) {
                  setTimeout(() => { window.populateLikersPreview(d.id, p.likes || []); }, 0);
              }
          } catch(e) { console.error('populateLikersPreview error', e); }
          if(isLiked && myLikes) likesHtml += postHtmlBase;
          if(isSaved && bookItems) bookHtml += postHtmlBase;
          feedPostCount++;
          } catch(err) {
              console.error('post render error', err, d.id);
          }
      });

      // populate containers with accumulated HTML (only if we built something)
      if (snap.size > 0 && feedHtml.trim() === '') {
          console.warn('loadPostsFeed: no HTML generated for non-empty snapshot, skipping overwrite');
      } else {
          if(feed) feed.innerHTML = feedHtml;
          if(myPosts) myPosts.innerHTML = myPostsHtml;
          if(myLikes) myLikes.innerHTML = likesHtml;
          if(bookItems) bookItems.innerHTML = bookHtml;
      }

      // Diğer Gönderiler Butonu
      if (feed && feedPostCount >= 7) {
        const morePostsBtn = document.createElement('div');
        morePostsBtn.style.cssText = `
          text-align: center;
          padding: 20px;
          margin-top: 15px;
        `;
        morePostsBtn.innerHTML = `
          <button onclick="window.loadPostsFeed(true);" style="
            background: linear-gradient(135deg, var(--primary), #8b5cf6);
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 50px;
            font-weight: 700;
            cursor: pointer;
            font-size: 0.95rem;
            transition: all 0.3s ease;
          " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            <i class="fa-solid fa-ellipsis"></i> Diğer Gönderiler
          </button>
        `;
        feed.appendChild(morePostsBtn);
      }
      
      // Feed render tamamlandıktan sonra varsa hash ile yönlendirmeyi gerçekleştir
      try {
        (async () => {
            try {
                const h = window.location.hash || '';
                if (!h.startsWith('#post-')) return;
                const id = h.slice(1);
                const el = await waitForElement(`#${id}`, 5000, 200);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const postId = h.replace('#post-', '');
                    const commentsEl = document.getElementById(`comments-${postId}`);
                    if (commentsEl) commentsEl.style.display = 'block';
                } else {
                    console.warn('Could not find element for hash', h);
                }
            } catch (e) { console.warn('Hash scroll helper error:', e); }
        })();
      } catch (e) { console.warn('Hash scroll hata:', e); }
  } catch (e) { console.error('loadPostsFeed snapshot error', e); }
  });
};

// setup DOMContentLoaded hooks for counters
window.addEventListener('DOMContentLoaded', () => {
    if (typeof updatePostCount === 'function') updatePostCount();
});

loadPostsFeed();
// also initialize post counter in case inputs already exist
if (typeof updatePostCount === 'function') updatePostCount();


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
      if (typeof updatePostCount === 'function') updatePostCount();
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

// visitor simulation helper
function isSimulatingVisitor() {
    return localStorage.getItem('simulateVisitor') === 'true';
}

window.toggleVisitorSimulation = () => {
    const current = isSimulatingVisitor();
    localStorage.setItem('simulateVisitor', current ? 'false' : 'true');
    const msg = current ? 'Simülasyon kapatıldı' : 'Ziyaretçi simülasyonu etkin. Sayfa yeniden yüklenecek.';
    alert(msg);
    location.reload();
};

// Ziyaretçi Profili Göster
async function loadVisitorProfile() {
    const params = new URLSearchParams(location.search);
    let visitedUsername = params.get('id');
    const simulate = isSimulatingVisitor();
    if (simulate && (!visitedUsername || visitedUsername === user.username)) {
        // force visitor state on own profile
        visitedUsername = '__simulate__';
    }
    
    // Ziyaretçi modu değilse çık (kendi profili)
    if (!visitedUsername || visitedUsername === user.username) {
        // Kendi profili - button'ları düzenle
        const editBtn = document.getElementById('editProfileBtn');
        const addFriendBtn = document.getElementById('addFriendBtn');
        const settingsBtn = document.getElementById('settingsBtn');
        if (editBtn) editBtn.style.display = 'inline-block';
        if (addFriendBtn) addFriendBtn.style.display = 'none';
        if (settingsBtn) settingsBtn.style.display = 'inline-block';
        // Own profile buttons updated
        return;
    }
    
    // Ziyaretçi modu etkinleştir
    
    // localStorage'a ziyaretçinin username'ini kaydet
    localStorage.setItem('visiting_username', visitedUsername);
    
    // Profil düzenle butonunu gizle
    const editBtn = document.getElementById('editProfileBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    if (editBtn) {
        editBtn.style.display = 'none';
    }
    if (settingsBtn) {
        settingsBtn.style.display = 'none';
    }
    const settingsMenu = document.getElementById('profileSettingsMenu');
    if (settingsMenu) settingsMenu.classList.remove('visible');
    
    // Arkadaş Olarak Ekle butonunu HEMEN göster
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (addFriendBtn) {
        addFriendBtn.style.display = 'inline-block';
        addFriendBtn.style.visibility = 'visible';
        // Add friend button shown
    } else {
        // Add friend button not found in HTML
    }
    
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
        let visitorUid = null;
        let visitedData = null;
        let isFriend = false;
        
        snap.forEach(doc => {
            const p = doc.data();
            if (p.username === visitedUsername) {
                visitorPosts.push({ id: doc.id, ...p });
            }
        });

        // Ziyaretçi kullanıcının UID'ini bul
        const userQuery = query(collection(db, "users"), where("username", "==", visitedUsername));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
            visitorUid = userSnap.docs[0].id;
            visitedData = userSnap.docs[0].data();
            // Visitor UID found

            // set display name & avatar from the user record (fall back to defaults)
            visitorDisplayName = visitedData.displayName || visitedData.name || visitedUsername;
            visitorAvatar = getAvatarUrl(visitedData.avatarUrl || visitedData.avatar || "strendsaydamv2.png", 'user');

            // gizlilik kontrolü: profil gizliyse ve ziyaretçi arkadaş değilse içerik göstermeyelim
            if (visitedData.isPrivate) {
                if (auth.currentUser && visitedData.friends && Array.isArray(visitedData.friends)) {
                    isFriend = visitedData.friends.includes(auth.currentUser.uid);
                }
                if (!isFriend) {
                    const container = document.getElementById('main-content');
                    if (container) {
                        const msg = translations[currentLang].profileHiddenMessage || 'Bu profil gizlidir.';
                        container.innerHTML = `<div style="border-radius:1rem; background:var(--card-bg); text-align:center; padding:40px; color:var(--text-muted);">
                            <i class="fa-solid fa-lock" style="font-size:3rem; margin-bottom:15px;"></i>
                            <p>${msg}</p>
                        </div>`;
                    }
                    return; // skip rest of visitor loading
                }
            }

        } else {
            // Visitor UID not found
        }
        
        // Profil başlığını güncelle
        const profileName = document.getElementById('profilePageName');
        if (profileName) profileName.innerText = visitorDisplayName;
        
        const profileHandle = document.getElementById('profilePageHandle');
        if (profileHandle) profileHandle.innerText = `@${visitedUsername}`;
        
        const profileAvatar = document.getElementById('profilePageAvatar');
        if (profileAvatar) {
            // use avatar that we determined above (already includes fallback)
            profileAvatar.src = visitorAvatar || getAvatarUrl("strendsaydamv2", 'user');
        }

        // "Arkadaş Olarak Ekle" butonunu göster/güncelle
        if (visitorUid && auth.currentUser) {
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) {
                // Updating friend button
                addFriendBtn.style.display = 'inline-block';
                await updateAddFriendButton(visitorUid);
                // Doğrudan UID ile hızlı gönderim için onclick'i UID tabanlı fonksiyona bağla
                addFriendBtn.onclick = () => sendFriendRequestToUid(visitorUid, visitedUsername);
            }
        } else {
            // Friend button update failed
        }

        // eğer profil gizliyse ve biz arkadaşsak bazı öğeleri gizle
        if (visitedData && visitedData.isPrivate && isFriend) {
            const profileAvatarEl = document.getElementById('profilePageAvatar');
            if (profileAvatarEl) profileAvatarEl.style.display = 'none';
            const actionBtn = document.getElementById('profileActionBtn');
            if (actionBtn) actionBtn.style.display = 'none';
            const addFriendBtn = document.getElementById('addFriendBtn');
            if (addFriendBtn) addFriendBtn.style.display = 'none';
            const notice = document.getElementById('friendViewNotice');
            if (notice) notice.style.display = 'block';
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
        
        // Showing visitor profile posts
    } catch (err) {
        console.error("Ziyaretçi profili yüklenirken hata:", err);
    } finally {
        // Hata olsa bile, eğer ziyaretçi profiliyse arkadaş butonu görüntülensin
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn && addFriendBtn.style.display === 'none') {
            addFriendBtn.style.display = 'inline-block';
        }
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
            author: "official_system",
            authorEmail: "officialfthuzun@gmail.com",
            authorImage: "assets/img/strendsaydamv2.ico", // Bot ikonu
            content: `${baslik}\n\n${icerik}`,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        });
        // Auto post shared
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
            // Component loaded successfully
            
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
    
    // Bildirim dropdown'u
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsDropdown = document.getElementById('notificationsDropdown');
    
    if (notificationsBtn?.contains(e.target)) {
        e.stopPropagation();
    } else if (notificationsDropdown && notificationsDropdown.style.display !== 'none') {
        if (!notificationsDropdown.contains(e.target)) {
            notificationsDropdown.style.display = 'none';
        }
    }
});

// ====== ARKADAŞ SİSTEMİ ======
// Arkadaş isteği gönder - DÜZELTİLDİ
async function sendFriendRequest() {
    // Send friend request
    if (!auth.currentUser) {
        alert('Lütfen giriş yapın');
        return;
    }

    const params = new URLSearchParams(location.search);
    const targetUsername = params.get('id') || localStorage.getItem('visiting_username');
    
    // user nesnesinin (giriş yapan kişi) mevcut olduğunu kontrol edelim
    if (!targetUsername || (typeof user !== 'undefined' && targetUsername === user.username)) {
        alert('Kendine arkadaş isteği gönderemezsin');
        return;
    }

    try {
        // Hedef kullanıcıyı kullanıcı adına göre bul
        const targetQuery = await getDocs(query(collection(db, "users"), where("username", "==", targetUsername)));
        
        if (targetQuery.empty) {
            alert('Kullanıcı bulunamadı');
            return;
        }

        const targetUid = targetQuery.docs[0].id;
        const targetUserData = targetQuery.docs[0].data();
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        // KRİTİK DÜZELTME: serverTimestamp() arrayUnion içinde çalışmaz. Date.now() kullanıyoruz.
        const timestampNow = Date.now();

        // 404 hatasını önlemek için güvenli avatar yolları
        const myAvatar = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=random`;
        const targetAvatar = targetUserData.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetUsername)}&background=random`;

        // 1. Karşı tarafın "friendRequests" dizisine eklenecek veri
        const friendRequestObj = {
            fromUid: auth.currentUser.uid,
            fromUsername: user.username || 'user',
            fromName: user.displayName || 'SosyalTrend Kullanıcısı',
            fromAvatar: myAvatar,
            timestamp: timestampNow,
            status: 'pending'
        };

        // Hedef kullanıcının friendRequests dizisine ekle
        await updateDoc(targetUserRef, {
            friendRequests: arrayUnion(friendRequestObj)
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(targetUserRef, { friendRequests: [friendRequestObj] }, { merge: true });
            }
        });

        // 2. Kendi "sentRequests" dizimize eklenecek veri
        const sentRequestObj = {
            toUid: targetUid,
            toUsername: targetUsername,
            toName: targetUserData.displayName || targetUsername,
            toAvatar: targetAvatar,
            timestamp: timestampNow
        };

        await updateDoc(currentUserRef, {
            sentRequests: arrayUnion(sentRequestObj)
        }).catch(async (err) => {
            if (err.code === 'not-found') {
                await setDoc(currentUserRef, { sentRequests: [sentRequestObj] }, { merge: true });
            }
        });

        // UI Güncelleme - Kullanıcı Deneyimi (UX)
        // immediately switch to cancel state via shared helper
        await updateAddFriendButton(targetUid);
        // also directly update button text to avoid race or caching issues
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => cancelFriendRequest(targetUid);
        }


    } catch (error) {
        console.error("Arkadaş isteği gönderme hatası:", error);
        alert('❌ Arkadaş isteği gönderilemedi: ' + error.message);
    }
}

// Arkadaş isteğini onayla
async function acceptFriendRequest(requesterUid, requesterUsername) {
    if (!auth.currentUser) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const requesterRef = doc(db, "users", requesterUid);
        const currentUserDoc = await getDoc(currentUserRef);
        const requesterDoc = await getDoc(requesterRef);

        // Arkadaş isteğini kaldır
        const updatedRequests = (currentUserDoc.data().friendRequests || [])
            .filter(req => req.fromUid !== requesterUid);

        await updateDoc(currentUserRef, {
            friendRequests: updatedRequests,
            friends: arrayUnion(requesterUid)
        });

        // Karşıya da ekle
        await updateDoc(requesterRef, {
            friends: arrayUnion(auth.currentUser.uid),
            sentRequests: ((requesterDoc.data().sentRequests || [])
                .filter(req => req.toUid !== auth.currentUser.uid))
        });

        // Onay bildirimini gönder
        await sendNotification(requesterUid, 'friend_accepted', user.displayName);
        
        // UI'da istek kartını kaldır
        const requestCard = document.getElementById(`friend-request-${requesterUid}`);
        if (requestCard) {
            requestCard.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => requestCard.remove(), 300);
        }
        
        loadFriendsList();
        checkIfNoRequests();
    } catch (error) {
        console.error("Onaylama hatası:", error);
        alert('Onaylama başarısız: ' + error.message);
    }
}


// Fonksiyonun dışarıdan (HTML'den) erişilebilir olmasını sağlar
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;

// Arkadaş isteğini reddet
async function rejectFriendRequest(requesterUid, requesterUsername) {
    if (!auth.currentUser) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const requesterRef = doc(db, "users", requesterUid);
        const currentUserDoc = await getDoc(currentUserRef);
        const requesterDoc = await getDoc(requesterRef);

        // Arkadaş isteğini kaldır
        const updatedRequests = (currentUserDoc.data().friendRequests || [])
            .filter(req => req.fromUid !== requesterUid);

        await updateDoc(currentUserRef, {
            friendRequests: updatedRequests
        });

        // Gönderenden sentRequest'i de kaldır
        if (requesterDoc.exists()) {
            await updateDoc(requesterRef, {
                sentRequests: ((requesterDoc.data().sentRequests || [])
                    .filter(req => req.toUid !== auth.currentUser.uid))
            });
        }

        // Reddetme bildirimini gönder
        await sendNotification(requesterUid, 'friend_rejected', user.displayName);
        
        // UI'da istek kartını kaldır
        const requestCard = document.getElementById(`friend-request-${requesterUid}`);
        if (requestCard) {
            requestCard.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => requestCard.remove(), 300);
        }
        
        checkIfNoRequests();
    } catch (error) {
        console.error("Reddetme hatası:", error);
        alert('Reddetme başarısız: ' + error.message);
    }
}

// Bildirim gönder
async function sendNotification(recipientUid, type, fromName, extra = {}) {
    try {
        const recipientRef = doc(db, "users", recipientUid);
        const notification = {
            type: type,
            fromName: fromName,
            fromUid: auth.currentUser ? auth.currentUser.uid : null,
            timestamp: Date.now(),
            ...extra
        };

        await updateDoc(recipientRef, {
            notifications: arrayUnion(notification)
        }).catch(async (err) => {
            if (err && err.code === 'not-found') {
                await setDoc(recipientRef, {
                    notifications: [notification]
                }, { merge: true });
            }
        });
    } catch (error) {
        console.error("Bildirim gönderme hatası:", error);
    }
}

// helper: uygula arama filtresi (input veya liste güncelleme çağırır)
function applyFriendSearch() {
    const searchInput = document.getElementById('friendSearch');
    if (!searchInput) return;
    const q = searchInput.value.trim().toLowerCase();
    console.log('applyFriendSearch called with q="' + q + '"');
    document.querySelectorAll('#friends-list .friend-card').forEach(card => {
        card.style.display = card.dataset.search && card.dataset.search.includes(q) ? '' : 'none';
    });
}

// Arkadaşlar listesini yükle (isOwnProfile=true ise tüm arkadaşlar, false ise ortak arkadaşlar)
async function loadFriendsList(userRef, isOwnProfile = true) {
    const friendsTab = document.getElementById('friends-list');
    const noFriendsMsg = document.getElementById('no-friends-msg');
    
    // ensure search input has handler every time we load list
    const searchInput = document.getElementById('friendSearch');
    if (searchInput) {
        searchInput.oninput = applyFriendSearch;
    }

    if (!friendsTab || !auth || !auth.currentUser) return;

    try {
        let targetUserData = null;
        
        if (!isOwnProfile) {
            // Başka birinin profili - visitedUsername'dan bulmalıyız
            const params = new URLSearchParams(location.search);
            const visitedUsername = params.get('id');
            
            if (!visitedUsername) return;
            
            // Firebase'de username ile kullanıcı ara
            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('username', '==', visitedUsername));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.size > 0) {
                    targetUserData = querySnapshot.docs[0].data();
                } else {
                    if (noFriendsMsg) noFriendsMsg.style.display = 'block';
                    return;
                }
            } catch (e) {
                console.warn('Ziyaret edilen kullanıcı bulunamadı:', e);
                if (noFriendsMsg) noFriendsMsg.style.display = 'block';
                return;
            }
        } else {
            // Kendi profil
            if (!userRef && auth.currentUser) {
                userRef = doc(db, "users", auth.currentUser.uid);
            }
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                targetUserData = userDoc.data();
            }
        }
        
        if (!targetUserData) return;
        
        const friends = targetUserData.friends || [];

        // logged-in kullanıcının da arkadaş listesi (mutual hesapları için)
        let myFriends = [];
        if (auth && auth.currentUser) {
            try {
                const me = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (me.exists()) {
                    myFriends = me.data()?.friends || [];
                }
            } catch (e) {
                console.warn('Kendi arkadaş listesi alınamadı:', e);
            }
        }

        // Eğer başka profil ise sadece ortak arkadaşları filtrele
        let displayFriends = friends;
        if (!isOwnProfile) {
            displayFriends = friends.filter(f => myFriends.includes(f));
        }

        if (displayFriends.length === 0) {
            friendsTab.innerHTML = '';
            noFriendsMsg.style.display = 'block';
            return;
        }

        noFriendsMsg.style.display = 'none';
        friendsTab.innerHTML = '';

        // Her arkadaşın bilgisini çek
        for (const friendUid of displayFriends) {
            const friendRef = doc(db, "users", friendUid);
            const friendDoc = await getDoc(friendRef);
            
            if (friendDoc.exists()) {
                const friendData = friendDoc.data();

                // mutual friends sayısını hesapla
                let mutualCount = 0;
                if (myFriends.length && friendData.friends) {
                    mutualCount = friendData.friends.filter(f => myFriends.includes(f)).length;
                }

                const friendCard = document.createElement('div');
                friendCard.className = 'friend-card';
                friendCard.style.cssText = `
                    background: var(--input-bg);
                    padding: 15px;
                    border-radius: 10px;
                    text-align: center;
                    /* no cursor:pointer; we only want avatar clickable */
                    transition: all 0.3s ease;
                `;
                
                let mutualHtml = '';
                if (mutualCount > 0) {
                    // make the mutual count clickable
                    mutualHtml = `<p class="mutual-info" data-uid="${friendUid}" 
                        style="margin:4px 0 0 0; color:var(--text-muted); font-size:0.75rem; cursor:pointer;">
                        🌐 ${mutualCount} ortak arkadaş
                    </p>`;
                }

                friendCard.innerHTML = `
                    <div>
                        <img src="${friendData.avatarUrl || 'assets/img/strendsaydamv2.png'}" 
                             style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; margin-bottom: 10px; cursor:pointer;"
                             onclick="window.location.href='profil.html?id=${encodeURIComponent(friendData.username)}'">
                        <h4 style="margin: 8px 0; font-size: 0.9rem; word-break: break-word;">${friendData.displayName || friendData.username}</h4>
                        <p style="margin: 5px 0; color: var(--text-muted); font-size: 0.8rem;">@${friendData.username}</p>
                    </div>
                    ${mutualHtml}
                    ${isOwnProfile ? `<button onclick="removeFriend('${friendUid}')" style="background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-size: 0.75rem; margin-top: 10px;">
                        <i class="fa-solid fa-trash"></i> Arkadaşlığı Sonlandır
                    </button>` : ''}
                `;
                // attach searchable text
                friendCard.dataset.search = ((friendData.displayName || '') + ' ' + friendData.username).toLowerCase();
                console.log('added friend card search:', friendCard.dataset.search);
                
                // only need to bind mutual click, propagation no longer matters
                if (mutualCount > 0) {
                    const mutualEl = friendCard.querySelector('.mutual-info');
                    if (mutualEl) {
                        mutualEl.addEventListener('click', () => {
                            showMutuals(friendUid);
                        });
                    }
                }

                // store searchable text as data attribute (name+username)
                friendCard.dataset.search = ((friendData.displayName || '') + ' ' + friendData.username).toLowerCase();
                
                friendCard.addEventListener('mouseenter', () => {
                    friendCard.style.transform = 'translateY(-5px)';
                    friendCard.style.boxShadow = 'var(--shadow)';
                });
                
                friendCard.addEventListener('mouseleave', () => {
                    friendCard.style.transform = 'translateY(0)';
                    friendCard.style.boxShadow = 'none';
                });
                
                friendsTab.appendChild(friendCard);
            }
        }
        // once all friend cards are appended, apply current search filter
        applyFriendSearch();
    } catch (error) {
        console.error("Arkadaşlar listesi yükleme hatası:", error);
    }
}

// Arkadaşlığı sonlandır
async function removeFriend(friendUid) {
    if (!confirm('Bu arkadaşlığı sonlandırmak istediğine emin misin?')) return;

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const friendRef = doc(db, "users", friendUid);

        // Her ikisinden de kaldır
        const currentUserDoc = await getDoc(currentUserRef);
        const friendDoc = await getDoc(friendRef);

        const userFriends = (currentUserDoc.data().friends || []).filter(f => f !== friendUid);
        const friendFriends = (friendDoc.data().friends || []).filter(f => f !== auth.currentUser.uid);

        await updateDoc(currentUserRef, { friends: userFriends });
        await updateDoc(friendRef, { friends: friendFriends });

        loadFriendsList(currentUserRef);
        alert('Arkadaşlık sonlandırıldı');
    } catch (error) {
        console.error("Arkadaşlık sonlandırma hatası:", error);
        alert('İşlem başarısız: ' + error.message);
    }
}

// Fonksiyonu HTML'den (onclick) erişilebilir hale getirir
window.removeFriend = removeFriend;

// Bir arkadaş ile ortak olan arkadaşları gösteren modal
async function showMutuals(friendUid) {
    if (!auth?.currentUser) return;
    try {
        const meDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        const friendDoc = await getDoc(doc(db, "users", friendUid));
        if (!meDoc.exists() || !friendDoc.exists()) return;

        const myFriends = meDoc.data().friends || [];
        const theirFriends = friendDoc.data().friends || [];
        const mutualIds = theirFriends.filter(id => myFriends.includes(id));

        // create overlay structure
        const overlay = document.createElement('div');
        overlay.id = 'mutualModal';
        overlay.className = 'modal-overlay';
        // position and full-screen background like other modals
        overlay.style.cssText = `
            display:flex;
            position:fixed;
            top:0;
            left:0;
            width:100%;
            height:100%;
            background:rgba(0,0,0,0.5);
            align-items:center;
            justify-content:center;
            z-index:3000;
        `;
        overlay.innerHTML = `
            <div class="glass-card" style="width:90%; max-width:500px; padding:20px; box-sizing:border-box;">
                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                    <h3 style="margin:0;">Ortak Arkadaşlar</h3>
                    <button id="closeMutualBtn" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-main);">&times;</button>
                </div>
                <div id="mutualListContainer" style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;
                      max-height:60vh; overflow-y:auto;"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('closeMutualBtn').addEventListener('click', () => overlay.remove());

        const container = document.getElementById('mutualListContainer');
        if (mutualIds.length === 0) {
            container.innerHTML = '<p>Ortakh arkadaş bulunamadı.</p>';
            return;
        }

        for (const uid of mutualIds) {
            try {
                const uDoc = await getDoc(doc(db, "users", uid));
                if (!uDoc.exists()) continue;
                const u = uDoc.data();
                const card = document.createElement('div');
                card.style.cssText = `
                    background: var(--input-bg);
                    padding: 10px;
                    border-radius: 10px;
                    text-align: center;
                    /* cursor on card removed so only img is clickable */
                    transition: all 0.3s ease;
                    width: 80px;
                `;
                card.innerHTML = `
                    <div>
                        <img src="${u.avatarUrl || 'assets/img/strendsaydamv2.png'}" 
                                style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid var(--primary); object-fit: cover; margin-bottom: 5px; cursor:pointer;"
                                onclick="window.location.href='profil.html?id=${encodeURIComponent(u.username)}'">
                        <p style="margin:0; font-size:0.75rem; word-break: break-word;">${u.displayName || u.username}</p>
                    </div>
                `;
                card.addEventListener('mouseenter', () => {
                    card.style.transform = 'translateY(-3px)';
                    card.style.boxShadow = 'var(--shadow)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.transform = 'translateY(0)';
                    card.style.boxShadow = 'none';
                });
                container.appendChild(card);
            } catch (e) {
                console.warn('Mutual friend fetch error', e);
            }
        }
        // after list render, reapply search filter in case user typed earlier
        applyFriendSearch();
    } catch (error) {
        console.error('showMutuals error:', error);
    }
}

// Fonksiyonu global erişime aç (kullanıldığı yerde onclick içinde olabilir)
window.showMutuals = showMutuals;

// Arkadaş isteklerini yükle ve bildirim dropdown'unda göster
async function loadFriendRequests(requests) {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');
    
    if (!requestsList) return;

    if (!requests || requests.length === 0) {
        requestsList.innerHTML = '';
        noNotificationsMsg.style.display = 'block';
        return;
    }

    noNotificationsMsg.style.display = 'none';
    requestsList.innerHTML = '';

    for (const request of requests) {
        const requestDiv = document.createElement('div');
        requestDiv.id = `friend-request-${request.fromUid}`;
        requestDiv.style.cssText = `
            padding: 12px;
            margin: 8px 12px;
            border-radius: 8px;
            background: var(--input-bg);
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 10px;
            transition: all 0.3s ease;
            animation: slideIn 0.3s ease;
        `;

        requestDiv.innerHTML = `
            <img src="${request.fromAvatar || 'assets/img/strendsaydamv2.png'}" 
                 style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
            <div style="flex: 1; min-width: 0;">
                <p style="margin: 0; font-size: 0.85rem; font-weight: 600; word-break: break-word;">${request.fromName}</p>
                <p style="margin: 3px 0 0 0; font-size: 0.75rem; color: var(--text-muted);">@${request.fromUsername}</p>
                <p style="margin: 3px 0 0 0; font-size: 0.7rem; color: var(--text-muted); font-style: italic;">Arkadaş isteği gönderdi</p>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end;">
                <button onclick="acceptFriendRequest('${request.fromUid}', '${request.fromUsername}')" 
                        style="background: linear-gradient(135deg, var(--primary), #4f46e5); color: white; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;">
                    <i class="fa-solid fa-check"></i> Onayla
                </button>
                <button onclick="rejectFriendRequest('${request.fromUid}', '${request.fromUsername}')" 
                        style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; border: none; padding: 7px 12px; border-radius: 6px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;">
                    <i class="fa-solid fa-x"></i> Reddet
                </button>
            </div>
        `;

        // Hover efekti
        requestDiv.addEventListener('mouseenter', () => {
            requestDiv.style.boxShadow = 'var(--shadow)';
            requestDiv.style.transform = 'translateY(-2px)';
        });
        
        requestDiv.addEventListener('mouseleave', () => {
            requestDiv.style.boxShadow = 'none';
            requestDiv.style.transform = 'translateY(0)';
        });

        requestsList.appendChild(requestDiv);
    }
    
    // Eğer hiç istek kalmamışsa boş mesaj göster
    checkIfNoRequests();
}

// Birleştirilmiş bildirim yükleyici: arkadaş istekleri + diğer bildirimler
async function loadNotifications(userData) {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');

    // Eğer header partial hâlâ yüklenmediyse, birkaç kez dene (header fetch asenkron olabilir)
    if (!requestsList) {
        window._notifRetryCount = (window._notifRetryCount || 0) + 1;
        if (window._notifRetryCount <= 10) {
            setTimeout(() => loadNotifications(userData), 300);
            return;
        } else {
            return;
        }
    }

    const friendRequests = Array.isArray(userData.friendRequests) ? userData.friendRequests : [];
    const otherNotifs = Array.isArray(userData.notifications) ? userData.notifications : [];

    const unreadOther = otherNotifs.filter(n => !n.read).length;
    const totalCount = friendRequests.length + unreadOther;
    // bildirimleri güncelle
    updateNotificationBadge(totalCount);

    if (totalCount === 0) {
        requestsList.innerHTML = '';
        if (noNotificationsMsg) noNotificationsMsg.style.display = 'flex';
        return;
    }

    if (noNotificationsMsg) noNotificationsMsg.style.display = 'none';
    requestsList.innerHTML = '';

    // Önce arkadaş isteklerini göster (onay/reddet butonlu)
    for (const request of friendRequests) {
        const requestDiv = document.createElement('div');
        requestDiv.id = `friend-request-${request.fromUid}`;
        requestDiv.style.cssText = `padding:12px; margin:8px 12px; border-radius:8px; background:var(--input-bg); border:1px solid var(--border); display:flex; align-items:center; gap:10px; transition:all 0.3s ease; animation: slideIn 0.3s ease;`;

        requestDiv.innerHTML = `
            <img src="${request.fromAvatar || 'assets/img/strendsaydamv2.png'}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--primary);">
            <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:0.85rem; font-weight:600;">${request.fromName}</p>
                <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-muted);">@${request.fromUsername}</p>
                <p style="margin:3px 0 0 0; font-size:0.7rem; color:var(--text-muted); font-style:italic;">Arkadaş isteği gönderdi</p>
            </div>
            <div style="display:flex; gap:6px; justify-content:flex-end;">
                <button onclick="acceptFriendRequest('${request.fromUid}', '${request.fromUsername}')" style="background:linear-gradient(135deg,var(--primary),#4f46e5); color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-check"></i> Onayla</button>
                <button onclick="rejectFriendRequest('${request.fromUid}', '${request.fromUsername}')" style="background:linear-gradient(135deg,#ef4444,#dc2626); color:white; border:none; padding:7px 12px; border-radius:6px; cursor:pointer; font-size:0.75rem; font-weight:600;"><i class="fa-solid fa-x"></i> Reddet</button>
            </div>
        `;

        requestDiv.addEventListener('mouseenter', () => { requestDiv.style.boxShadow = 'var(--shadow)'; requestDiv.style.transform = 'translateY(-2px)'; });
        requestDiv.addEventListener('mouseleave', () => { requestDiv.style.boxShadow = 'none'; requestDiv.style.transform = 'translateY(0)'; });

        requestsList.appendChild(requestDiv);
    }

    // Diğer bildirimleri göster — sadece okunmamış ve son 8 tanesini göster
    const maxNotifications = 8;
    const unreadNotifs = otherNotifs.filter(n => !n.read);
    const recentNotifs = unreadNotifs.slice(-maxNotifications);
    for (const n of recentNotifs) {
        const nDiv = document.createElement('div');
        nDiv.style.cssText = `padding:12px; margin:8px 12px; border-radius:8px; background:var(--input-bg); border:1px solid var(--border); display:flex; gap:10px; cursor:pointer; transition:all 0.2s ease;`;

        let icon = 'fa-info-circle';
        let text = '';
        let detail = '';

        if (n.type?.includes('friend_')) {
            if (n.type === 'friend_accepted') text = `${n.fromName} arkadaşlık isteğinizi kabul etti`;
            else if (n.type === 'friend_rejected') text = `${n.fromName} arkadaşlık isteğinizi reddetti`;
            else text = `${n.fromName} ile ilgili bir arkadaş bildirimi`;
            icon = 'fa-user-check';
        } else if (n.type === 'like' || n.type === 'post_like') {
            text = `${n.fromName} gönderinizi beğendi`;
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-heart';
        } else if (n.type === 'saved_self') {
            text = `Gönderiyi kaydettiniz`;
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-bookmark';
        } else if (n.type === 'saved' || n.type === 'post_saved') {
            text = `${n.fromName} gönderinizi kaydetti`;
            detail = n.postContent ? `"${n.postContent}${n.postContent.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-bookmark';
        } else if (n.type === 'comment' || n.type === 'post_comment') {
            text = `${n.fromName} gönderinize yorum yaptı`;
            detail = n.commentText ? `"${n.commentText.slice(0, 50)}${n.commentText.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-comment';
        } else if (n.type === 'comment_reply') {
            text = `${n.fromName} yorumunuza yanıt yazdı`;
            detail = n.commentText ? `"${n.commentText.slice(0, 50)}${n.commentText.length > 50 ? '...' : ''}"` : '';
            icon = 'fa-reply';
        } else if (n.type === 'message' || n.type === 'msg') {
            text = `${n.fromName} size mesaj gönderdi`;
            icon = 'fa-message';
        } else {
            text = n.message || `${n.fromName || 'Birileri'} bir bildirim gönderdi`;
        }

        const timeStr = _formatNotificationTime(n.timestamp);

        nDiv.innerHTML = `
            <i class="fa-solid ${icon}" style="font-size:1.1rem; width:34px; text-align:center; color:var(--primary);"></i>
            <div style="flex:1; min-width:0;">
                <p style="margin:0; font-size:0.85rem; font-weight:600;">${n.fromName || 'Sistem'}</p>
                <p style="margin:3px 0 0 0; font-size:0.75rem; color:var(--text-muted);">${text}</p>
                ${detail ? `<p style="margin:4px 0 0 0; font-size:0.7rem; color:var(--text-muted); font-style:italic;">${detail}</p>` : ''}
                <p style="margin:4px 0 0 0; font-size:0.7rem; color:var(--text-muted);">${timeStr}</p>
            </div>
        `;

        nDiv.addEventListener('mouseenter', () => { nDiv.style.boxShadow = 'var(--shadow)'; nDiv.style.transform = 'translateY(-2px)'; });
        nDiv.addEventListener('mouseleave', () => { nDiv.style.boxShadow = 'none'; nDiv.style.transform = 'translateY(0)'; });

        // Tıklamayla okundu yap ve dropdown kapat
        nDiv.onclick = async (e) => {
            e.stopPropagation();
            if (!n.read) {
                await markNotificationRead(n);
                // Dropdown'u yenile (okunmuş bildirimi çıkar)
                if (auth.currentUser) {
                    const userRef = doc(db, 'users', auth.currentUser.uid);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        loadNotifications(userSnap.data());
                    }
                }
            }
            // Eğer gönderi id'si varsa git
            if (n.postId) {
                const dropdown = document.getElementById('notificationsDropdown');
                if (dropdown) dropdown.style.display = 'none';
                window.location.href = `index.html#post-${n.postId}`;
            }
        };

        requestsList.appendChild(nDiv);
    }

    // Eğer daha fazla bildirim varsa "Tümünü Göster" butonu ekle
    if (unreadNotifs.length > maxNotifications) {
        const showAllBtn = document.createElement('div');
        showAllBtn.style.cssText = `padding:12px 15px; text-align:center; border-top:1px solid var(--border); cursor:pointer; color:var(--primary); font-weight:700; font-size:0.85rem; transition:0.2s;`;
        showAllBtn.innerText = `Tümünü Göster (${unreadNotifs.length - maxNotifications} daha)`;
        showAllBtn.onmouseenter = () => { showAllBtn.style.background = 'var(--input-bg)'; };
        showAllBtn.onmouseleave = () => { showAllBtn.style.background = 'none'; };
        showAllBtn.onclick = () => {
            const dropdown = document.getElementById('notificationsDropdown');
            if (dropdown) dropdown.style.display = 'none';
            window.location.href = 'profil.html#my-notifs-tab';
        };
        requestsList.appendChild(showAllBtn);
    }

    // Hepsini Okundu Yap butonu (gönderilerin altında)
    const markAllBtn = document.createElement('div');
    markAllBtn.style.cssText = `padding:12px 15px; text-align:center; border-top:1px solid var(--border); cursor:pointer; background:linear-gradient(135deg, var(--primary), #8b5cf6); color:white; font-weight:700; font-size:0.85rem; transition:all 0.2s; flex-shrink:0;`;
    markAllBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Hepsini Okundu Yap';
    markAllBtn.onmouseenter = () => { markAllBtn.style.opacity = '0.8'; };
    markAllBtn.onmouseleave = () => { markAllBtn.style.opacity = '1'; };
    markAllBtn.onclick = async () => {
        await markAllNotificationsRead();
        // Bildirimleri yenile
        if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                loadNotifications(userSnap.data());
            }
        }
    };
    requestsList.appendChild(markAllBtn);
}

// Hiç arkadaş isteği kalmamışsa mesaj göster
function checkIfNoRequests() {
    const requestsList = document.getElementById('friendRequestsList');
    const noNotificationsMsg = document.getElementById('noNotificationsMsg');
    
    if (requestsList && noNotificationsMsg) {
        const hasRequests = requestsList.children.length > 0;
        noNotificationsMsg.style.display = hasRequests ? 'none' : 'flex';
    }
}

// Yardımcı: iki bildirimin aynı olup olmadığını anlamak için normalize edilmiş zaman karşılaştırması
function _normalizeTs(ts) {
    if (!ts) return null;
    if (typeof ts === 'number') return ts;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && ts.seconds) return (ts.seconds * 1000) + Math.floor((ts.nanoseconds || 0) / 1000000);
    return null;
}

// Bildirim için insan okunur zaman formatı
function _formatNotificationTime(ts) {
    const ms = _normalizeTs(ts);
    if (!ms) return '';
    const now = Date.now();
    const diff = Math.floor((now - ms) / 1000);
    
    if (diff < 60) return 'şimdi';
    if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} saat önce`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} gün önce`;
    
    const date = new Date(ms);
    return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

function _isSameNotification(a, b) {
    if (!a || !b) return false;
    const ta = _normalizeTs(a.timestamp);
    const tb = _normalizeTs(b.timestamp);
    return a.type === b.type && (a.fromUid || null) === (b.fromUid || null) && ta === tb && JSON.stringify(a.extra || a.postId || a.commentText || {}) === JSON.stringify(b.extra || b.postId || b.commentText || {});
}

// Profil sayfasındaki bildirimleri yükle
async function loadProfileNotifications() {
    const list = document.getElementById('profile-notifications-list');
    const noMsg = document.getElementById('profile-no-notifs');
    if (!list) return;

    try {
        if (!auth.currentUser) {
            list.innerHTML = '<div style="color:var(--text-muted);">Giriş yapın</div>';
            return;
        }

        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        const allNotifs = (userSnap.exists() && Array.isArray(userSnap.data().notifications)) ? userSnap.data().notifications : [];

        list.innerHTML = '';
        if (allNotifs.length === 0) {
            noMsg.style.display = 'block';
            return;
        }
        noMsg.style.display = 'none';

        // En yeniden en eskiye sırala
        for (const n of allNotifs.slice().reverse()) {
            const nDiv = document.createElement('div');
            nDiv.style.cssText = `padding:15px; border-radius:12px; background:var(--input-bg); border:1px solid var(--border); display:grid; grid-template-columns:auto 1fr auto; gap:12px; align-items:start; cursor:pointer; transition:all 0.2s ease; ${n.read ? 'opacity:0.65;' : 'background:var(--card-bg); border:1px solid var(--primary);'}`;

            const icon = (n.type && n.type.includes('like')) ? 'fa-heart' : (n.type && n.type.includes('comment') ? 'fa-comment' : (n.type && n.type.includes('friend') ? 'fa-user-check' : 'fa-info-circle'));
            const iconColors = {
                'fa-heart': '#ef4444',
                'fa-comment': '#3b82f6',
                'fa-user-check': '#10b981',
                'fa-info-circle': '#8b5cf6'
            };
            const iconColor = iconColors[icon] || 'var(--primary)';

            let mainText = '';
            let detailText = '';

            if (n.type === 'post_like' || n.type === 'like') {
                mainText = `${n.fromName} gönderinizi beğendi`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'saved_self') {
                mainText = `Gönderiyi kaydettiniz`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'post_saved' || n.type === 'saved') {
                mainText = `${n.fromName} gönderinizi kaydetti`;
                detailText = n.postContent ? `"${n.postContent}${n.postContent.length >= 50 ? '...' : ''}"` : 'Gönderi hakkında daha fazla bilgi görmek için tıkla.';
            } else if (n.type === 'post_comment' || n.type === 'comment') {
                mainText = `${n.fromName} gönderinize yorum yaptı`;
                detailText = n.commentText ? `"${n.commentText.slice(0, 60)}${n.commentText.length > 60 ? '...' : ''}"` : '';
            } else if (n.type === 'friend_accepted') {
                mainText = `${n.fromName} arkadaşlık isteğinizi kabul etti`;
                detailText = 'Artık arkadaşsınız!';
            } else if (n.type === 'friend_rejected') {
                mainText = `${n.fromName} arkadaşlık isteğinizi reddetti`;
                detailText = '';
            } else {
                mainText = n.fromName || 'Sistem';
                detailText = n.message || 'Yeni bildirim';
            }

            const timeStr = _formatNotificationTime(n.timestamp);

            nDiv.innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center;">
                    <div style="width:50px; height:50px; border-radius:12px; background:${iconColor}20; display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid ${icon}" style="font-size:1.4rem; color:${iconColor};"></i>
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <div style="font-weight:800; font-size:0.95rem; color:var(--text-main);">${mainText}</div>
                    ${detailText ? `<div style="font-size:0.8rem; color:var(--text-muted); line-height:1.4;">${detailText}</div>` : ''}
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        <i class="fa-regular fa-clock" style="margin-right:4px;"></i>${timeStr}
                    </div>
                </div>
                <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                    ${!n.read ? `<button style="background:var(--primary); color:#fff; border:none; padding:6px 12px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Okundu</button>` : `<div style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">✓ Okundu</div>`}
                    ${n.postId ? `<button style="background:transparent; border:1px solid var(--border); color:var(--text-main); padding:6px 10px; border-radius:8px; font-size:0.75rem; font-weight:700; cursor:pointer;">Gönderiye Git</button>` : ''}
                </div>
            `;

            nDiv.addEventListener('mouseenter', () => { if (!n.read) nDiv.style.boxShadow = 'var(--shadow)'; });
            nDiv.addEventListener('mouseleave', () => { nDiv.style.boxShadow = 'none'; });

            // Tıklamayla okundu yap
            nDiv.onclick = async (e) => {
                e.stopPropagation();
                if (!n.read) {
                    await markNotificationRead(n);
                    // UI yenileme için short delay
                    setTimeout(() => loadProfileNotifications(), 100);
                } else if (n.postId) {
                    // Zaten okundu, direkt gönderi sayfasına git
                    window.location.href = `index.html#post-${n.postId}`;
                }
            };

            list.appendChild(nDiv);
        }

    } catch (e) {
        console.error('loadProfileNotifications hatası:', e);
    }
}

// Tek bir bildirimi okundu yap
async function markNotificationRead(targetNotif) {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];

        const updated = notifs.map(n => {
            if (_isSameNotification(n, targetNotif)) {
                return { ...n, read: true };
            }
            return n;
        });

        await updateDoc(userRef, { notifications: updated });
        // UI will refresh via onSnapshot listener
    } catch (e) {
        console.error('markNotificationRead hata:', e);
    }
}

// Tüm bildirimleri okundu yap
async function markAllNotificationsRead() {
    if (!auth.currentUser) return;
    try {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;
        const notifs = Array.isArray(userSnap.data().notifications) ? userSnap.data().notifications : [];
        if (notifs.length === 0) return;

        const updated = notifs.map(n => ({ ...n, read: true }));
        await updateDoc(userRef, { notifications: updated });
        // UI will refresh via onSnapshot
    } catch (e) {
        console.error('markAllNotificationsRead hata:', e);
    }
}

window.loadProfileNotifications = loadProfileNotifications;
window.markNotificationRead = markNotificationRead;
window.markAllNotificationsRead = markAllNotificationsRead;

// Fonksiyonu window nesnesine bağlayarak HTML'den erişilebilir yapıyoruz
window.toggleNotifications = function() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) {
        // Mevcut durumu kontrol et ve tersine çevir
        if (dropdown.style.display === 'none' || dropdown.style.display === '') {
            dropdown.style.display = 'block';
            // Dropdown açılırken bildirimleri yenile (okunmuş olanlar kaybolur)
            if (auth.currentUser) {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                getDoc(userRef).then(userSnap => {
                    if (userSnap.exists()) {
                        loadNotifications(userSnap.data());
                    }
                });
            }
        } else {
            dropdown.style.display = 'none';
        }
    } else {
        console.warn("notificationsDropdown öğesi bulunamadı!");
    }
};

// Bildirim badge'ini güncelle
function updateNotificationBadge(count) {
    const badge = document.getElementById('notificationBadge');
    const countBadge = document.getElementById('requestCountBadge');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count > 99 ? '99+' : count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
    
    if (countBadge) {
        countBadge.textContent = count > 99 ? '99+' : count;
    }
    
    // Page title'a bildirim sayısı ekle
    if (count > 0) {
        document.title = `(${count}) SosyalTrend • Sosyal Ağ`;
    } else {
        document.title = 'SosyalTrend • Sosyal Ağ';
    }
}

// Profil sayfasında "Arkadaş Olarak Ekle" butonunu göster/gizle
async function updateAddFriendButton(targetUid) {
    const addFriendBtn = document.getElementById('addFriendBtn');
    if (!addFriendBtn || !auth.currentUser) return;

    // eğer profil sahibi kendimizsek butonu devre dışı bırak
    if (targetUid === auth.currentUser.uid) {
        addFriendBtn.innerHTML = '<i class="fa-solid fa-user"></i> Bu sizsiniz';
        addFriendBtn.disabled = true;
        addFriendBtn.style.opacity = '0.6';
        addFriendBtn.style.cursor = 'default';
        addFriendBtn.style.display = 'inline-block';
        addFriendBtn.onclick = (e) => e.preventDefault();
        return;
    }

    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const currentUserDoc = await getDoc(currentUserRef);
        const targetUserDoc = await getDoc(targetUserRef);

        const currentUserData = currentUserDoc.data() || {};
        const targetUserData = targetUserDoc.data() || {};

        const friends = currentUserData.friends || [];
        const friendRequests = currentUserData.friendRequests || [];
        const sentRequests = currentUserData.sentRequests || [];

        // Zaten arkadaş mı?
        if (friends.includes(targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-check"></i> Zaten Arkadaş';
            addFriendBtn.disabled = true;
            addFriendBtn.style.opacity = '0.6';
            addFriendBtn.style.cursor = 'default';
            addFriendBtn.style.display = 'inline-block';
            addFriendBtn.onclick = (e) => e.preventDefault();
        }
        // İstek gönderdik mi?
        else if (sentRequests.some(req => req.toUid === targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İsteği iptal et';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.style.display = 'inline-block';
            addFriendBtn.onclick = () => cancelFriendRequest(targetUid);
        }
        // İstek aldık mı?
        else if (friendRequests.some(req => req.fromUid === targetUid)) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-hourglass-end"></i> İstek Bekleniyor';
            addFriendBtn.disabled = true;
            addFriendBtn.style.opacity = '0.6';
            addFriendBtn.style.cursor = 'default';
            addFriendBtn.style.display = 'inline-block';
            addFriendBtn.onclick = (e) => e.preventDefault();
        }
        // Normal "Arkadaş Olarak Ekle"
        else {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Olarak Ekle';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.style.display = 'inline-block';
            addFriendBtn.onclick = () => sendFriendRequest();
        }
    } catch (error) {
        console.error("Buton güncelleme hatası:", error);
    }
}

// Profil sayfasında gönderilmiş isteği iptal etme
async function cancelFriendRequest(targetUid, targetUsername) {
    // targetUsername parameter is optional; not used currently
    if (!auth.currentUser) return;
    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const meDoc = await getDoc(currentUserRef);
        const sent = (meDoc.data().sentRequests || []).filter(req => req.toUid !== targetUid);
        await updateDoc(currentUserRef, { sentRequests: sent });

        const themDoc = await getDoc(targetUserRef);
        const incoming = (themDoc.data().friendRequests || []).filter(req => req.fromUid !== auth.currentUser.uid);
        await updateDoc(targetUserRef, { friendRequests: incoming });

        // geri butonu geri al
        const addFriendBtn = document.getElementById('addFriendBtn');
        if (addFriendBtn) {
            addFriendBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Olarak Ekle';
            addFriendBtn.disabled = false;
            addFriendBtn.style.opacity = '1';
            addFriendBtn.style.cursor = 'pointer';
            addFriendBtn.onclick = () => sendFriendRequest();
        }
    } catch (err) {
        console.error('İstek iptal etme hatası:', err);
        alert('İstek iptal edilemedi: ' + err.message);
    }
}

// Cancel helper for suggestion buttons
async function cancelFriendRequestToUid(targetUid, targetUsername) {
    console.log('cancelFriendRequestToUid invoked', targetUid, targetUsername);
    if (!auth.currentUser) return;
    try {
        const currentUserRef = doc(db, "users", auth.currentUser.uid);
        const targetUserRef = doc(db, "users", targetUid);

        const meDoc = await getDoc(currentUserRef);
        const sent = (meDoc.data().sentRequests || []).filter(req => req.toUid !== targetUid);
        await updateDoc(currentUserRef, { sentRequests: sent });

        const themDoc = await getDoc(targetUserRef);
        const incoming = (themDoc.data().friendRequests || []).filter(req => req.fromUid !== auth.currentUser.uid);
        await updateDoc(targetUserRef, { friendRequests: incoming });

        // feedback
        alert('✅ Arkadaşlık isteği iptal edildi.');

        const btn = document.getElementById('addFriendBtn_sugg_' + targetUid);
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Arkadaş Olarak Ekle';
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.onclick = () => sendFriendRequestToUid(targetUid, targetUsername);
        }
    } catch (err) {
        console.error('Hızlı isteği iptal etme hatası:', err);
        alert('İstek iptal edilemedi: ' + err.message);
    }
}

// Profil sayfasını ziyaret ettiğiniz arkadaşın profilinizi açarsanız

function handleProfileAction() {
  const currentUser = auth.currentUser;
  const viewedUserId = new URLSearchParams(window.location.search).get('uid'); // Profiline bakılan kişinin ID'si

  if (!currentUser) {
    window.location.href = 'giris.html';
    return;
  }

  if (viewedUserId === currentUser.uid) {
    // KENDİ PROFİLİNDEYSE: Direkt mesajlar sayfasına git
    window.location.href = 'mesajlar.html';
  } else {
    // BAŞKASININ PROFİLİNDEYSE: Mesajlar sayfasına o kullanıcının ID'sini parametre olarak gönder
    window.location.href = `mesajlar.html?start=${viewedUserId}`;
  }
}

// Delegated input listener for character counts
// works even when elements are injected later
document.addEventListener('input', (e) => {
    const t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'postInput' && typeof updatePostCount === 'function') {
        updatePostCount();
    }
    if (t.id.startsWith('input-') && typeof updateCommentCount === 'function') {
        const postId = t.id.replace('input-', '');
        updateCommentCount(postId);
    }
});

// poll button next to share composer
const pollBtn = document.getElementById('pollToggle');
if (pollBtn) {
    pollBtn.addEventListener('click', () => {
        openPollCreator();
    });
} else {
    // in case the element is added later (injection), delegate via DOMContentLoaded
    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'pollToggle') openPollCreator();
    });
}

// Poll creation helper
async function openPollCreator() {
    console.log('openPollCreator called');
    if (!auth.currentUser) { alert('Lütfen giriş yapın'); return; }
    const question = prompt('Anket sorusu nedir?');
    if (!question) {
        console.log('poll cancelled: no question');
        return;
    }
    const opts = prompt('Seçenekleri virgülle ayırarak girin (örn: Evet,Hayır)');
    if (!opts) {
        console.log('poll cancelled: no options');
        return;
    }
    const options = opts.split(',').map(o => ({ text: o.trim(), votes: 0, voters: [] })).filter(o => o.text);
    if (options.length < 2) { alert('En az iki seçenek girin.'); return; }
    // optional caption from post input area
    let caption = '';
    const postInput = document.getElementById('postInput');
    if (postInput && postInput.value.trim()) {
        caption = postInput.value.trim();
    }
    console.log('creating poll', { question, options, caption });
    try {
        const docRef = await addDoc(collection(db, 'posts'), {
            type: 'poll',
            question,
            options,
            text: caption, // may be empty
            name: user.displayName,
            username: user.username,
            avatarUrl: user.avatarUrl,
            timestamp: serverTimestamp(),
            likes: [],
            comments: []
        });
        console.log('poll created with id', docRef.id);
        // verify the created document is readable immediately
        try {
            const createdSnap = await getDoc(doc(db, 'posts', docRef.id));
            console.log('createdDoc exists:', createdSnap.exists(), 'data:', createdSnap.data());
        } catch (e) {
            console.warn('Could not read created doc immediately:', e);
        }
        alert('Anket oluşturuldu!');
        if (postInput) postInput.value = ''; // clear caption area after creating
        // make sure feed shows it immediately
        loadPostsFeed(true);
        // set hash so feed helper will try to open it
        window.location.hash = `post-${docRef.id}`;
        // also actively wait and scroll to the new post when it appears
        (async () => {
            const el = await waitForElement(`#post-${docRef.id}`, 5000, 200);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                console.warn('New poll element not found after creation:', docRef.id);
            }
        })();
    } catch (e) {
        console.error('Anket oluşturma hatası:', e);
        alert('Anket oluşturulamadı: ' + e.message);
    }
}

// Vote on poll
async function votePoll(postId, optIdx) {
    if (!auth.currentUser) { alert('Lütfen giriş yapın'); return; }
    try {
        const ref = doc(db, 'posts', postId);
        const snap = await getDoc(ref);
        if (!snap.exists()) return;
        const post = snap.data();
        const opts = post.options || [];
        if (!opts[optIdx]) return;
        // remove previous vote
        opts.forEach(o => {
            if (o.voters && o.voters.includes(auth.currentUser.uid)) {
                o.voters = o.voters.filter(u => u !== auth.currentUser.uid);
                o.votes = (o.votes || 0) - 1;
            }
        });
        // add new vote
        opts[optIdx].voters = opts[optIdx].voters || [];
        opts[optIdx].voters.push(auth.currentUser.uid);
        opts[optIdx].votes = (opts[optIdx].votes || 0) + 1;
        await updateDoc(ref, { options: opts });
        // snapshot listener will refresh feed automatically
    } catch (e) {
        console.error('votePoll error', e);
    }
}

// Paylaş Menüsü
window.openShareMenu = function(postId) {
    // always recreate the share modal so new options (like polls) appear even if it was built earlier
    const existing = document.getElementById('share-modal');
    if (existing) existing.remove();
    const modal = createShareModal();
    modal.style.display = 'flex';
    
    // Paylaş seçeneklerini güncelle
    const baseUrl = window.location.href.split('#')[0];
    const shareUrl = `${baseUrl}#${postId}`;
    const shareText = 'SosyaLTrend\'te bir gönderi gördüm. Sana da göstermek istiyorum!';
    
    try {
        document.getElementById('share-whatsapp').onclick = function() {
            const text = encodeURIComponent(`${shareText}\n${shareUrl}`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
            modal.style.display = 'none';
        };
        
        document.getElementById('share-twitter').onclick = function() {
            const text = encodeURIComponent(shareText);
            window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`, '_blank');
            modal.style.display = 'none';
        };
        
        document.getElementById('share-facebook').onclick = function() {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
            modal.style.display = 'none';
        };
        document.getElementById('share-poll').onclick = function() {
            console.log('share-poll clicked for post', postId);
            modal.style.display = 'none';
            openPollCreator();
        };
        
        document.getElementById('share-copy-link').onclick = function() {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Bağlantı kopyalandı!');
                modal.style.display = 'none';
            }).catch(() => {
                alert('Kopyalanamadı, lütfen elle kopyala: ' + shareUrl);
            });
        };
        
        document.getElementById('share-copy-embed').onclick = function() {
            const embedCode = `<iframe src="${shareUrl}" width="100%" height="400" frameborder="0" style="border-radius: 12px;"></iframe>`;
            navigator.clipboard.writeText(embedCode).then(() => {
                alert('Embed kodu kopyalandı!');
                modal.style.display = 'none';
            }).catch(() => {
                alert('Kopyalanamadı');
            });
        };
    } catch(e) {
        console.error('Share menu hata:', e);
    }
};

function createShareModal() {
    const modal = document.createElement('div');
    modal.id = 'share-modal';
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-modal-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0; font-weight:700;">Gönderiyi Paylaş</h3>
                <button onclick="document.getElementById('share-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button id="share-whatsapp" class="share-option" style="background:rgba(37,211,102,0.1); color:#25d366; border:1px solid #25d366;">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp'de Paylaş
                </button>
                <button id="share-twitter" class="share-option" style="background:rgba(29,155,240,0.1); color:#1d9bf0; border:1px solid #1d9bf0;">
                    <i class="fa-brands fa-twitter"></i> Twitter'da Paylaş
                </button>
                <button id="share-facebook" class="share-option" style="background:rgba(59,89,152,0.1); color:#3b5998; border:1px solid #3b5998;">
                    <i class="fa-brands fa-facebook"></i> Facebook'da Paylaş
                </button>
                <button id="share-copy-link" class="share-option" style="background:var(--input-bg); color:var(--text);">
                    <i class="fa-solid fa-link"></i> Bağlantıyı Kopyala
                </button>
                <button id="share-copy-embed" class="share-option" style="background:var(--input-bg); color:var(--text);">
                    <i class="fa-solid fa-code"></i> Embed Kodunu Kopyala
                </button>
                <button id="share-poll" class="share-option" style="background:rgba(75,85,99,0.1); color:#4b5563; border:1px solid #4b5563;">
                    <i class="fa-solid fa-poll"></i> Anket Oluştur
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    return modal;
}

// Beğenenleri göster fonksiyonu - 3 avatar + "X Diğer" butonu
window.populateLikersPreview = async (postId, likes) => {
    try {
        const container = document.getElementById(`likers-${postId}`);
        if (!container) return;
        container.innerHTML = '';
        if (!likes || likes.length === 0) return;

        const preview = likes.slice(0, 3);
        const userDataMap = {};
        
        // Firestore'dan avatar bilgilerini çek
        try {
            const q = query(collection(db, 'users'), where('username', 'in', preview));
            const snap = await getDocs(q);
            snap.forEach(doc => { 
                userDataMap[doc.data().username] = doc.data(); 
            });
        } catch (e) {
            console.warn('Avatar query failed, using fallbacks', e);
        }

        // 3 avatarı göster
        preview.forEach(username => {
            const userData = userDataMap[username];
            const avatar = getAvatarUrl(userData?.avatarUrl || userData?.avatar);
            const img = document.createElement('img');
            img.src = avatar;
            img.title = userData?.displayName || username;
            img.style.cssText = 'width:28px;height:28px;border-radius:50%;border:2px solid var(--card-bg);object-fit:cover;cursor:pointer;';
            img.onclick = () => { window.location.href = `profil.html?id=${encodeURIComponent(username)}`; };
            container.appendChild(img);
        });

        // "X Diğer" butonu (3'ten fazla varsa)
        if (likes.length > 3) {
            const othersBtn = document.createElement('button');
            othersBtn.className = 'mini-link-btn';
            othersBtn.style.cssText = 'background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;font-size:0.85rem;padding:0;';
            othersBtn.textContent = `(${likes.length - 3}) diğer beğenen kişiler.`;
            othersBtn.onclick = () => { window.openLikersModal(postId); };
            container.appendChild(othersBtn);
        }
    } catch (e) {
        console.error('populateLikersPreview error:', e);
    }
};

// Beğenenleri gösteren modal
window.openLikersModal = async (postId) => {
    try {
        const modal = document.getElementById('likers-modal') || createLikersModal();
        modal.style.display = 'flex';

        // Gönderiden beğenenleri al
        const postRef = doc(db, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (!postSnap.exists()) {
            document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Gönderi bulunamadı</div>';
            return;
        }
        
        const likes = postSnap.data().likes || [];
        if (likes.length === 0) {
            document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Henüz beğenen yok</div>';
            return;
        }

        // Batch ile kullanıcı verilerini çek (max 10 per query)
        const chunks = [];
        for (let i=0; i<likes.length; i+=10) {
            chunks.push(likes.slice(i, i+10));
        }
        
        const users = [];
        for (const chunk of chunks) {
            try {
                const q = query(collection(db, 'users'), where('username', 'in', chunk));
                const snap = await getDocs(q);
                snap.forEach(d => { 
                    users.push(d.data()); 
                });
            } catch(e) {
                console.warn('Batch query failed', e);
            }
        }

        // Map yap - order koru
        const userMap = {};
        users.forEach(u => { 
            if (u.username) userMap[u.username] = u; 
        });

        // HTML render et
        const listHtml = likes.map(username => {
            const userData = userMap[username];
            const avatar = getAvatarUrl(userData?.avatarUrl || userData?.avatar);
            const name = userData?.displayName || username;
            return `<div style="display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); cursor:pointer;" onclick="window.location.href='profil.html?id=${encodeURIComponent(username)}'">
                        <img src="${avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">
                        <div style="flex:1;">
                            <div style="font-weight:700; font-size:0.9rem;">${name}</div>
                            <div style="font-size:0.8rem;color:var(--text-muted)">@${username}</div>
                        </div>
                    </div>`;
        }).join('');

        document.getElementById('likers-list').innerHTML = listHtml;
    } catch (e) {
        console.error('openLikersModal error:', e);
        document.getElementById('likers-list').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">Yüklenemedi</div>';
    }
};

// Likers modal'ı oluştur
function createLikersModal() {
    const modal = document.createElement('div');
    modal.id = 'likers-modal';
    modal.className = 'share-modal';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div class="share-modal-content">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; font-weight:700; font-size:1.1rem;">Beğenenler</h3>
                <button onclick="document.getElementById('likers-modal').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted);">✕</button>
            </div>
            <div id="likers-list" style="max-height:60vh; overflow-y:auto; min-width:350px;">
                <div style="padding:20px;text-align:center;color:var(--text-muted)">Yükleniyor...</div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { 
        if (e.target === modal) modal.style.display = 'none'; 
    });
    return modal;
}

// Profil sekmelerini dolduran fonksiyon: gönderiler, beğeniler, kayıtlar
window.loadProfileSections = async () => {
    console.log('loadProfileSections invoked');
    const myPostsList = document.getElementById('my-posts-list');
    const myLikesList = document.getElementById('my-liked-list');
    const bookmarkList = document.getElementById('bookmark-items');

    if (myPostsList) myPostsList.innerHTML = '';
    if (myLikesList) myLikesList.innerHTML = '';
    if (bookmarkList) bookmarkList.innerHTML = '';

    try {
        // Resolve username: visited profile or current user
        const params = new URLSearchParams(location.search);
        const visitedId = params.get('id') || params.get('uid');
        let uname = visitedId || (window.user && window.user.username) || null;

        if (!uname && auth.currentUser) {
            // fetch from users collection as fallback
            try {
                const me = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (me.exists()) uname = me.data().username;
            } catch (e) { console.warn('Could not resolve username for profile sections', e); }
        }

        if (!uname) {
            console.warn('loadProfileSections: no username available');
            return;
        }

        const q = query(collection(db, 'posts'), orderBy('timestamp','desc'));
        const snap = await getDocs(q);

        let total=0, mineCount=0, likedCount=0, savedCount=0;

        snap.forEach(d => {
            total++;
            const p = d.data();
            const isMine = p.username === uname || p.adminUser === uname;
            const isLiked = Array.isArray(p.likes) && p.likes.includes(uname);
            const isSaved = Array.isArray(p.savedBy) && p.savedBy.includes(uname) || Array.isArray(p.saved) && p.saved.includes(uname);

            if (isMine) mineCount++;
            if (isLiked) likedCount++;
            if (isSaved) savedCount++;

            // basic post html (kept simple to avoid relying on other helpers)
            const postHtml = `
                <div class="glass-card post" style="position: relative; margin-bottom:12px;">
                    <div style="display:flex; gap:10px; margin-bottom:10px; align-items:center;">
                        <img src="${getAvatarUrl(p.avatarUrl||p.avatarSeed||'assets/img/strendsaydamv2.png','user')}" class="user-avatar" style="width:44px;height:44px;border-radius:50%;cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                        <div>
                            <div style="font-weight:700; display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
                                ${p.name||p.displayName||p.username}
                                <span class="post-time" style="font-size:0.8rem;color:var(--text-muted);">• ${formatTime ? formatTime(p.timestamp) : ''}</span>
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">@${p.username}</div>
                        </div>
                    </div>
<p style="white-space: pre-wrap; margin-bottom:10px;">
  ${(p.content || '').replace(/(#[a-zA-Z0-9ığüşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>')}
</p>                    ${p.image ? `<div style="margin:12px 0;"><img src="${p.image}" style="width:100%;border-radius:8px;object-fit:cover;"></div>` : ''}
                    <div style="display:flex; gap:12px; align-items:center;">
                        <div style="display:flex; gap:8px; align-items:center; color:${isLiked? '#ef4444':''}"><i class="${isLiked? 'fa-solid' : 'fa-regular'} fa-heart"></i> <span>${Array.isArray(p.likes)? p.likes.length:0}</span></div>
                        <div style="display:flex; gap:8px; align-items:center;"><i class="fa-regular fa-comment"></i> <span>${Array.isArray(p.comments)? p.comments.length:0}</span></div>
                        <div style="display:flex; gap:8px; align-items:center; color:${isSaved? '#f59e0b':''}"><i class="${isSaved? 'fa-solid' : 'fa-regular'} fa-bookmark"></i></div>
                    </div>
                </div>
            `;

            if (isMine && myPostsList) myPostsList.innerHTML += postHtml;
            if (isLiked && myLikesList) myLikesList.innerHTML += postHtml;
            if (isSaved && bookmarkList) bookmarkList.innerHTML += postHtml;
        });

        // If empty, show friendly messages
        if (myPostsList && myPostsList.innerHTML.trim() === '') {
            myPostsList.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);">Henüz gönderi yok</div>`;
        }
        if (myLikesList && myLikesList.innerHTML.trim() === '') {
            myLikesList.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);">Henüz beğenilen gönderi yok</div>`;
        }
        if (bookmarkList && bookmarkList.innerHTML.trim() === '') {
            bookmarkList.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-muted);">Henüz kayıtlı gönderi yok</div>`;
        }

        console.log('loadProfileSections stats', { total, mineCount, likedCount, savedCount });
    } catch (e) {
        console.error('loadProfileSections error', e);
    }
};

window.sendFriendRequestToUid = sendFriendRequestToUid;
// expose cancel helpers globally so inline onclick handlers can call them
window.cancelFriendRequest = cancelFriendRequest;
window.cancelFriendRequestToUid = cancelFriendRequestToUid;

// logging for debugging cache/availability
console.log('cancelFriendRequestToUid available on window:', typeof window.cancelFriendRequestToUid);
