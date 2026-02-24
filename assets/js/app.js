// app.js - front-end logic for SosyalTrend (Node.js backend version)
// Firebase SDK removed; all data operations go through the /api endpoints.

import * as api from './api.js';

// ---------- static data (ramadan widget, special days, etc) ----------
const ozelGunler = [
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
  // dini günler
  { ay: 0, gun: 15, baslik: "Miraç Kandili", mesaj: "Miraç Kandiliniz mübarek olsun. 🤲" },
  { ay: 1, gun: 2, baslik: "Berat Kandili", mesaj: "Berat Kandilimiz mübarek olsun. 🌙" },
  { ay: 1, gun: 19, baslik: "Ramazan Başlangıcı", mesaj: "Hoş geldin Ya Şehr-i Ramazan! 🌙" },
  { ay: 2, gun: 16, baslik: "Kadir Gecesi", mesaj: "Kadir Geceniz mübarek olsun. 🙏" },
  { ay: 2, gun: 20, baslik: "Ramazan Bayramı (1. Gün)", mesaj: "Ramazan Bayramınız mübarek olsun! 🍬" },
  { ay: 4, gun: 27, baslik: "Kurban Bayramı (1. Gün)", mesaj: "Kurban Bayramınız kutlu olsun. Paylaşmanın ve dayanışmanın günü! 🐑" }
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

// --------------- global state ----------------
let user = { displayName: "Misafir", avatarUrl: "assets/img/strendsaydamv2.png", isAdmin: false, username: '' };

// helpers
function waitForElement(selector, timeout = 5000, interval = 200) {
  return new Promise(resolve => {
    const start = Date.now();
    (function check() {
      const el = document.querySelector(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(check, interval);
    })();
  });
}

onAuthStateChanged(auth, async (fbUser) => {
    // Header'daki butonu seçiyoruz
    const adminBtn = document.getElementById('adminMenuBtn');

    if (!fbUser) {
        if (adminBtn) adminBtn.style.display = 'none';
        window.location.href = 'login.html';
        if (typeof kontrolEtVeOtomatikPostAt === 'function') kontrolEtVeOtomatikPostAt();
    } else {
        // Kullanıcı bilgilerini ata
        user.username = fbUser.email.split('@')[0];
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        try {
            const userRef = doc(db, "users", fbUser.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                
                // --- SADECE ROLE GÖRE YETKİ KONTROLÜ ---
                // Eğer veritabanındaki rolü 'admin' ise isAdmin true olur
                user.isAdmin = (userData.role === 'admin');
                
                // Avatarı güncelle
                user.avatarUrl = userData.avatarUrl || "assets/img/strendsaydamv2.png";
            } else {
                // Yeni kayıt (Varsayılan olarak admin değildir)
                user.isAdmin = false;
                user.avatarUrl = "assets/img/strendsaydamv2.png";
                
                await setDoc(userRef, {
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl,
                    email: fbUser.email,
                    username: user.username,
                    role: 'user', // Varsayılan rol
                    createdAt: serverTimestamp()
                }, { merge: true });
            }

            // --- BUTON GÖRÜNÜRLÜĞÜ ---
            if (adminBtn) {
                adminBtn.style.display = user.isAdmin ? 'flex' : 'none';
            }

        } catch (err) {
            console.error("Yetki kontrol hatası:", err);
        }

        // Arayüz ve Feed Güncellemeleri
        if (typeof updateUIWithUser === 'function') updateUIWithUser();
        try { if (typeof loadPostsFeed === 'function') loadPostsFeed(); } catch(e) {}

        // Profil İstatistikleri
        if (typeof window.loadProfileSections === 'function') {
            window.total = (typeof someData !== 'undefined' && someData !== null) ? someData.length : 0;
            window.mineCount = (typeof someMines !== 'undefined' && someMines !== null) ? someMines.length : 0;
            window.likedCount = (typeof likedPosts !== 'undefined' && likedPosts !== null) ? likedPosts.length : 0;
            window.savedCount = (typeof savedPosts !== 'undefined' && savedPosts !== null) ? savedPosts.length : 0;
            window.followerCount = (typeof followers !== 'undefined' && followers !== null) ? followers.length : 0;
            window.followingCount = (typeof following !== 'undefined' && following !== null) ? following.length : 0;
            try { window.loadProfileSections(); } catch(e) {}
        }

        // --- ANLIK (REAL-TIME) ROL TAKİBİ ---
        // Panelden birini admin yaptığınızda sayfa yenilenmeden butonun gelmesi için gerekli
        onSnapshot(doc(db, "users", fbUser.uid), (docSnapshot) => {
            if (docSnapshot.exists()) {
                const userData = docSnapshot.data();
                const isNowAdmin = (userData.role === 'admin');
                
                // Rol değiştiyse butonu güncelle
                if (user.isAdmin !== isNowAdmin) {
                    user.isAdmin = isNowAdmin;
                    if (adminBtn) adminBtn.style.display = isNowAdmin ? 'flex' : 'none';
                }

                if (userData.avatarUrl && userData.avatarUrl !== user.avatarUrl) {
                    user.avatarUrl = userData.avatarUrl;
                    updateUIWithUser();
                }
                if (userData.displayName && userData.displayName !== user.displayName) {
                    user.displayName = userData.displayName;
                    updateUIWithUser();
                }
                if (typeof loadNotifications === 'function') loadNotifications(userData);
            }
        });

        if (typeof migrateOldAvatars === 'function') migrateOldAvatars();
        if (user.isAdmin && typeof updateAdminStats === 'function') updateAdminStats();
    }

    if (typeof loadVisitorProfile === 'function') loadVisitorProfile();
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

    if (file.size > 300 * 1024 * 1024) {
        alert("Dosya 300MB'dan küçük olmalıdır!");
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
            if (file.size > 300 * 1024 * 1024) { 
                alert("Lütfen 300MB'dan küçük bir fotoğraf seçin.");
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
  const welcome = document.getElementById('welcomeMessage');
  const avatar = document.getElementById('headerAvatar');
  const display = document.getElementById('menuDisplayName');
  const uname = document.getElementById('menuUsername');
  if (welcome) welcome.innerText = `Hoş geldin, ${user.displayName || user.username}`;
  if (avatar) avatar.src = user.avatarUrl;
  if (display) display.innerText = user.displayName;
  if (uname) uname.innerText = '@' + user.username;
}

async function logout() {
  // try remote logout; if it fails just proceed anyway
  try { await api.logout(); } catch {}
  // clear offline session data
  sessionStorage.removeItem('st_current_user');
  window.location.href = '/auth/login.html';
}

// ---------- suggestions / friends ----------
async function loadSuggestions() {
  const container = document.getElementById('dynamic-suggestions-list');
  if (!container) return;
  container.innerHTML = '';
  try {
    const list = await api.getSuggestions();
    list.forEach(u => {
      if (u.id === user.id) return;
      const html = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="window.location.href='profil.html?id=${encodeURIComponent(u.username)}'">
             <img src="${getAvatarUrl(u.avatarUrl)}" style="width:38px;height:38px;border-radius:50%;border:1.5px solid var(--primary);object-fit:cover;">
             <div style="max-width:90px;overflow:hidden;">
               <div style="font-size:0.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${u.displayName||'İsimsiz'}</div>
               <div style="font-size:0.7rem;color:var(--text-muted);">@${u.username}</div>
             </div>
          </div>
          <button class="tool-btn" onclick="sendFriendRequestToUid('${u.id}','${u.username}')">+ Arkadaş</button>
      </div>`;
      container.insertAdjacentHTML('beforeend', html);
    });
  } catch (e) {
    console.error(e);
  }
}

async function sendFriendRequestToUid(uid, username) {
  try {
    await api.sendFriendRequest(user.id, uid);
    alert('İstek gönderildi');
    loadSuggestions();
  } catch (e) {
    console.error(e);
    alert('Gönderilemedi: ' + e.message);
  }
}

async function cancelFriendRequestToUid(uid) {
  try {
    await api.cancelFriendRequest(user.id, uid);
    loadSuggestions();
  } catch (e) {
    console.error(e);
  }
}

// ---------- posts / feed ----------
let showAllFeedPosts = false;

async function loadPostsFeed(showAll = false) {
  if (showAll) showAllFeedPosts = true;
  try {
    let posts = await api.getPosts();
    posts.sort((a,b)=>b.timestamp - a.timestamp);
    if (!showAllFeedPosts) posts = posts.slice(0, 7);
    renderFeed(posts);
  } catch (e) {
    console.error('Gönderiler yüklenirken hata', e);
  }
}

function renderFeed(posts) {
  const feed = document.getElementById('feed-items');
  if (!feed) return;
  if (!posts || posts.length === 0) {
    feed.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Henüz gönderi yok.</div>';
    return;
  }
  let html = '';
  posts.forEach(p => {
    const isMine = p.username === user.username;
    const isLiked = p.likes?.includes(user.username);
    const avatarUrl = getAvatarUrl(p.avatarUrl);
    const contentWithLinks = (p.content||'').replace(/(#[\wığüğşöçİĞÜŞÖÇ]+)/g, '<span class="hashtag-link" onclick="searchTrend(\'$1\')">$1</span>');
    const postImageHtml = p.image ? `<div class="post-image-wrapper" style="margin:12px auto;max-width:50%;"><img src="${p.image}" loading="lazy" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;" onclick="toggleImageExpand(this)" alt="Post görseli"></div>` : '';
    html += `<div class="glass-card post" style="position: relative;">
        <div style="display:flex;gap:10px;margin-bottom:10px;">
           <img src="${avatarUrl}" class="user-avatar" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">
           <div>
              <div style="font-weight:700;display:flex;align-items:center;gap:5px;cursor:pointer;" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">${p.displayName||p.username} <span class="post-time">• ${formatTime(p.timestamp)}</span></div>
              <div style="font-size:0.75rem;color:var(--text-muted);" onclick="location.href='profil.html?id=${encodeURIComponent(p.username)}'">@${p.username}</div>
           </div>
        </div>
        <p style="white-space:pre-wrap;margin-bottom:10px;">${contentWithLinks}</p>${postImageHtml}
        <div style="display:flex;gap:12px;">
           <button class="tool-btn" onclick="likePost('${p.id}', ${isLiked})" style="gap:5px;color:${isLiked?'#ef4444':''}"><i class="${isLiked?'fa-solid':'fa-regular'} fa-heart"></i><span>${p.likes?.length||0}</span></button>
           <button class="tool-btn" onclick="toggleCommentSection('${p.id}')" style="gap:5px;"><i class="fa-regular fa-comment"></i><span>${p.comments?.length||0}</span></button>
           <button class="tool-btn" onclick="toggleBookmark('${p.id}', ${p.savedBy?.includes(user.username)})" style="color:${p.savedBy?.includes(user.username)?'#f59e0b':''}"><i class="${p.savedBy?.includes(user.username)?'fa-solid':'fa-regular'} fa-bookmark"></i></button>
           <button class="tool-btn" onclick="window.openShareMenu('${p.id}')" style="gap:5px;margin-left:auto;"><i class="fa-solid fa-share"></i></button>
        </div>
        <div id="comments-${p.id}" class="comment-area" style="display:none;"></div>
    </div>`;
  });
  feed.innerHTML = html;
}

async function sharePost() {
  const textarea = document.getElementById('postInput');
  const content = textarea.value.trim();
  if (!content) return;
  const obj = {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    content,
    timestamp: Date.now(),
    likes: [],
    comments: [],
    savedBy: []
  };
  // image support: if an <input type=file id="imageInput"> exists
  const fileInput = document.getElementById('imageInput');
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    obj.image = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });
  }
  try {
    await api.createPost(obj);
    textarea.value = '';
    loadPostsFeed();
  } catch (e) { console.error(e); }
}

async function likePost(id, currentlyLiked) {
  try {
    const posts = await api.getPosts();
    const post = posts.find(p=>p.id===id);
    if (!post) return;
    let likes = post.likes || [];
    if (currentlyLiked) likes = likes.filter(u=>u!==user.username);
    else likes.push(user.username);
    await api.updatePost(id, { likes });
    loadPostsFeed(showAllFeedPosts);
  } catch (e) { console.error(e); }
}

// TODO: toggleCommentSection, toggleBookmark, openShareMenu, other helpers
function toggleCommentSection(id) {
  const el = document.getElementById(`comments-${id}`);
  if (el) el.style.display = (el.style.display === 'none' ? 'block' : 'none');
}
function toggleBookmark(id, currently) {
  // simply send update without much handling
  api.updatePost(id, { savedBy: currently ? [] : [user.username] }).then(() => loadPostsFeed(showAllFeedPosts));
}
function openShareMenu(id) {
  alert('Bağlantı kopyalandı: ' + window.location.origin + '/index.html#post-' + id);
}

// --------- page setup ---------
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('shareBtn')?.addEventListener('click', sharePost);
  document.getElementById('postInput')?.addEventListener('input', updatePostCount);
});

document.addEventListener('includesLoaded', async () => {
  await loadComponents();
  // don't force auth check on login or forgot pages (they redirect otherwise)
  const path = window.location.pathname;
  if (!path.endsWith('/auth/login.html') && !path.endsWith('/auth/forgot.html') && !path.endsWith('/auth/register.html')) {
    await initAuth();
  }
  if (window.location.pathname.endsWith('search.html')) {
     runSearch();
  }
});

async function loadComponents() {
  await loadSuggestions();
}

function updatePostCount() {
  const input = document.getElementById('postInput');
  const counter = document.getElementById('post-charcount');
  if (!input || !counter) return;
  counter.textContent = `${input.value.length}/500`;
}

// The ramadan widget and other UI functions can be copied or left as is

// small helper stubs
function searchTrend(tag) {
  window.location.href = `search.html?q=${encodeURIComponent(tag)}`;
}

// basic search page implementation
async function runSearch() {
  const params = new URLSearchParams(window.location.search);
  const q = (params.get('q') || '').trim().toLowerCase();
  const statusEl = document.getElementById('searchStatus');
  const usersContainer = document.getElementById('search-results-users');
  const sectionUsers = document.getElementById('section-users');
  const noResults = document.getElementById('search-no-results');
  if (!q) {
    if (statusEl) statusEl.innerText = 'Arama terimi giriniz.';
    return;
  }
  try {
    if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Arama yapılıyor...';
    const allUsers = await api.getUsers();
    const matched = allUsers.filter(u =>
      (u.username || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q)
    );
    if (matched.length) {
      sectionUsers.style.display = 'block';
      usersContainer.innerHTML = matched.map(u => `
        <div class="user-card" onclick="window.location='profil.html?id=${encodeURIComponent(u.username)}'">
          <img src="${getAvatarUrl(u.avatarUrl)}" alt="">
          <div class="info"><strong>${u.displayName||u.username}</strong><br>@${u.username}</div>
        </div>
      `).join('');
    } else {
      noResults.style.display = 'block';
    }
  } catch (e) {
    console.error('search error', e);
    if (statusEl) statusEl.innerText = 'Arama sırasında hata oluştu';
  }
}

