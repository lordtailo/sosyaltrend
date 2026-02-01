import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Bileşenleri dinamik olarak yükleme fonksiyonu    
async function loadComponents() {
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

  let user = {
  displayName: "Misafir",
  avatar: "Felix",
  isAdmin: false
};

const ADMIN_EMAIL = "officialfthuzun@gmail.com";

onAuthStateChanged(auth, (fbUser) => {
    if (!fbUser) {
        window.location.href = 'login.html';
    } else {
        // Kullanıcı bilgilerini güncelle
        user.username = fbUser.email.split('@')[0];
        user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || user.username;
        
        // Avatar kalıcılığı
        const savedAvatar = localStorage.getItem('st_avatar');
        user.avatarSeed = savedAvatar || "Felix"; 

        // Admin Kontrolü
        user.isAdmin = fbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
        
        // UI Güncelleme (Profil resmi, isimler vb.)
        updateUIWithUser(); 

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
});

async function updateAdminStats() {
    if(!user.isAdmin) return;
    try {
        const postsSnap = await getDocs(collection(db, "posts"));
        const pagesSnap = await getDocs(collection(db, "pages"));
        
        // Elementler sayfada varsa güncelle
        const postStat = document.getElementById('stat-total-posts');
        const pageStat = document.getElementById('stat-total-pages');
        
        if (postStat) postStat.innerText = postsSnap.size;
        if (pageStat) pageStat.innerText = pagesSnap.size;
    } catch (error) {
        console.error("Admin istatistikleri yüklenirken hata:", error);
    }
}

/* ============================ */


// Karşılama mesajı için global fonksiyon (app.js'den çağrılacak)
  window.updateWelcomeMessage = (username) => {
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) {
      const name = username ? username : "misafir";
      welcomeEl.innerText = `${name.toLowerCase()}, Hoş geldin!`;
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
  if (localStorage.getItem('st_theme') === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeToggleBtn').innerHTML =
      '<i class="fa-solid fa-sun"></i>';
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
// --- RESİM VE ANKET YARDIMCI KODLARI ---
let selectedImageBase64 = null;

// Resim seçme ve önizleme
window.previewPostImage = (input) => {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedImageBase64 = e.target.result;
            document.getElementById('postImagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
};

window.removeSelectedImage = () => {
    selectedImageBase64 = null;
    document.getElementById('postImageInput').value = "";
    document.getElementById('imagePreviewContainer').style.display = 'none';
};

// Anket paneli yönetimi
window.togglePollCreator = () => {
    const el = document.getElementById('pollCreator');
    el.style.display = (el.style.display === 'none') ? 'block' : 'none';
};

window.addPollOption = () => {
    const container = document.getElementById('pollOptionsList');
    if (container.children.length < 4) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'poll-option-input';
        input.placeholder = `Seçenek ${container.children.length + 1}`;
        input.style = "width:100%; margin-bottom:5px; padding:5px; border-radius:5px; border:1px solid var(--border); background:transparent; color:var(--text-main);";
        container.appendChild(input);
    }
};
// ---------------------------------------
