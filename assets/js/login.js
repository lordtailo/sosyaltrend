import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
  authDomain: "sosyaltrend-21d21.firebaseapp.com",
  projectId: "sosyaltrend-21d21",
  storageBucket: "sosyaltrend-21d21.firebasestorage.app",
  messagingSenderId: "207734473261",
  appId: "1:207734473261:web:f31b6bf2908c6d88986ea4",
  measurementId: "G-5T2RCQL3MB"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function handleGoogleSignIn() {
  const msg = document.getElementById('loginMsg') || document.getElementById('regMsg');
  try {
    showStatus(msg, 'Google ile bağlanılıyor...', '#4f46e5');
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    if (!user) throw new Error('Google kullanıcı bilgisi alınamadı.');

    const userRef = doc(db, 'users', user.uid);
    const snapshot = await getDoc(userRef);
    if (!snapshot.exists()) {
      const email = user.email || '';
      const name = user.displayName || 'Google Kullanıcısı';
      const username = email
        ? email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 20) || `google${Date.now()}`
        : `google${Date.now()}`;

      await setDoc(userRef, {
        displayName: name,
        username,
        email,
        location: null,
        hometown: null,
        dob: null,
        occupation: null,
        website: null,
        bio: null,
        interests: null,
        avatarUrl: user.photoURL || 'assets/img/strendsaydamv2.png',
        provider: 'google',
        createdAt: serverTimestamp(),
        friends: [],
        friendRequests: []
      });
    }

    showStatus(msg, 'Google ile giriş başarılı! Yönlendiriliyorsunuz...', '#10b981');
    setTimeout(() => (window.location.href = 'index.html'), 1200);
  } catch (err) {
    handleAuthError(msg, err.code || err.message);
  }
}

window.toggleAuth = (target) => {
  const cards = document.querySelectorAll('.card');
  const msgs = document.querySelectorAll('.authMsg');

  msgs.forEach((m) => m.innerText = '');
  cards.forEach((c) => c.classList.remove('active'));

  if (target === 'register') {
    document.getElementById('registerCard')?.classList.add('active');
    showRegisterStep(1);
  } else if (target === 'forgot') {
    document.getElementById('forgotCard')?.classList.add('active');
  } else {
    document.getElementById('loginCard')?.classList.add('active');
  }
};

let currentRegisterStep = 1;

function showRegisterStep(step) {
  currentRegisterStep = step;
  const step1Panel = document.getElementById('registerStep1');
  const step2Panel = document.getElementById('registerStep2');
  const step1Label = document.getElementById('step1Label');
  const step2Label = document.getElementById('step2Label');

  if (step1Panel && step2Panel) {
    step1Panel.style.display = step === 1 ? 'block' : 'none';
    step2Panel.style.display = step === 2 ? 'block' : 'none';
  }

  if (step1Label && step2Label) {
    step1Label.classList.toggle('step-active', step === 1);
    step1Label.classList.toggle('step-inactive', step !== 1);
    step2Label.classList.toggle('step-active', step === 2);
    step2Label.classList.toggle('step-inactive', step !== 2);
  }

  const msg = document.getElementById('regMsg');
  if (msg) msg.innerText = '';
}

function showStatus(el, text, color) {
  if (!el) return;
  el.innerText = text;
  el.style.color = color;
}

function handleAuthError(el, code) {
  if (!el) return;
  let message = 'Bir hata oluştu.';

  switch (code) {
    case 'auth/user-not-found':
      message = 'Kullanıcı bulunamadı.';
      break;
    case 'auth/wrong-password':
      message = 'Hatalı şifre.';
      break;
    case 'auth/invalid-email':
      message = 'Geçersiz e-posta.';
      break;
    case 'auth/email-already-in-use':
      message = 'Bu e-posta zaten kullanımda.';
      break;
    case 'auth/too-many-requests':
      message = 'Çok fazla deneme! Lütfen bekleyin.';
      break;
    case 'auth/popup-closed-by-user':
      message = 'Google penceresini kapattınız, tekrar deneyin.';
      break;
    case 'auth/cancelled-popup-request':
      message = 'Google oturumu iptal edildi.';
      break;
    case 'auth/account-exists-with-different-credential':
      message = 'Bu e-posta başka bir yöntemle zaten kullanılıyor.';
      break;
  }

  showStatus(el, message, '#ef4444');
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail')?.value.trim();
  const pass = document.getElementById('loginPassword')?.value;
  const msg = document.getElementById('loginMsg');

  if (!email || !pass) {
    return showStatus(msg, 'Lütfen e-posta ve şifre girin.', '#ef4444');
  }

  try {
    showStatus(msg, 'Giriş yapılıyor...', '#4f46e5');
    await signInWithEmailAndPassword(auth, email, pass);
    showStatus(msg, 'Başarılı! Yönlendiriliyorsunuz...', '#10b981');
    setTimeout(() => (window.location.href = 'index.html'), 1200);
  } catch (err) {
    handleAuthError(msg, err.code);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('regName')?.value.trim();
  const username = document.getElementById('regUsername')?.value.trim();
  const email = document.getElementById('regEmail')?.value.trim();
  const pass = document.getElementById('regPassword')?.value;
  const location = document.getElementById('regLocation')?.value.trim();
  const hometown = document.getElementById('regHometown')?.value.trim();
  const dob = document.getElementById('regDob')?.value;
  const occupation = document.getElementById('regOccupation')?.value.trim();
  const website = document.getElementById('regWebsite')?.value.trim();
  const bio = document.getElementById('regBio')?.value.trim();
  const interests = document.getElementById('regInterests')?.value.trim();
  const msg = document.getElementById('regMsg');

  if (!name || !username || !email) {
    return showStatus(msg, 'Ad Soyad, kullanıcı adı ve e-posta gereklidir.', '#ef4444');
  }

  if (!pass || pass.length < 6) {
    return showStatus(msg, 'Şifre en az 6 karakter olmalıdır.', '#ef4444');
  }

  try {
    showStatus(msg, 'Hesap oluşturuluyor...', '#4f46e5');
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const userRef = doc(db, 'users', userCredential.user.uid);

    await setDoc(
      userRef,
      {
        displayName: name,
        username,
        email,
        location: location || null,
        hometown: hometown || null,
        dob: dob || null,
        occupation: occupation || null,
        website: website || null,
        bio: bio || null,
        interests: interests || null,
        avatarUrl: 'assets/img/strendsaydamv2.png',
        createdAt: serverTimestamp(),
        friends: [],
        friendRequests: []
      },
      { merge: true }
    );

    showStatus(msg, 'Başarılı! Hoş geldiniz.', '#10b981');
    setTimeout(() => (window.location.href = 'index.html'), 1200);
  } catch (err) {
    handleAuthError(msg, err.code);
  }
}

async function handleForgot(event) {
  event.preventDefault();
  const email = document.getElementById('resetEmail')?.value.trim();
  const msg = document.getElementById('resetMsg');

  if (!email) {
    return showStatus(msg, 'Lütfen e-posta adresinizi girin.', '#ef4444');
  }

  try {
    showStatus(msg, 'Gönderiliyor...', '#4f46e5');
    await sendPasswordResetEmail(auth, email);
    showStatus(msg, 'Sıfırlama bağlantısı gönderildi! E-postanızı kontrol edin.', '#10b981');
  } catch (err) {
    handleAuthError(msg, err.code);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('toStep2Btn')?.addEventListener('click', () => {
    const name = document.getElementById('regName')?.value.trim();
    const username = document.getElementById('regUsername')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const pass = document.getElementById('regPassword')?.value;
    const msg = document.getElementById('regMsg');

    if (!name || !username || !email) {
      return showStatus(msg, 'Lütfen 1. sayfada gereken zorunlu alanları doldurun.', '#ef4444');
    }
    if (!pass || pass.length < 6) {
      return showStatus(msg, 'Şifre en az 6 karakter olmalıdır.', '#ef4444');
    }

    showRegisterStep(2);
  });

  document.getElementById('backToStep1Btn')?.addEventListener('click', () => showRegisterStep(1));
  document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
  document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
  document.getElementById('forgotForm')?.addEventListener('submit', handleForgot);
  showRegisterStep(1);
});
