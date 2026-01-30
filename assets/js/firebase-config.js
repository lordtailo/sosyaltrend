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