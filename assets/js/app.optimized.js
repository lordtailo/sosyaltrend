import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, deleteDoc, getDoc, getDocs, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, updateEmail, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Optimized app module
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
const db = getFirestore(app);
const auth = getAuth(app);
const ADMIN_EMAIL = "officialfthuzun@gmail.com";

const state = {
  user: { displayName: 'Misafir', username: null, avatarSeed: 'Felix', uid: null, isAdmin: false },
  lang: localStorage.getItem('st_lang') || 'tr',
  isPrivate: localStorage.getItem('st_isPrivate') === 'true'
};

// minimal DOM cache
const $ = id => document.getElementById(id);
const cache = new Proxy({}, { get(t,k){ if(!(k in t)) t[k] = $(k); return t[k]; }});

const i18n = { tr: { commentPlaceholder:'Yorum yaz...', sendComment:'Gönder', subBtn:'Abone Ol', unsubBtn:'Bırak', confirmDelete:'Silmek istediğine emin misin?' }, en: { commentPlaceholder:'Write a comment...', sendComment:'Send', subBtn:'Subscribe', unsubBtn:'Leave', confirmDelete:'Are you sure?' } };
const t = k => (i18n[state.lang] && i18n[state.lang][k]) || i18n.tr[k] || k;

function avatar(seed, type='user'){ if(!seed) seed='Felix'; if(seed.startsWith('http')||seed.startsWith('data:')) return seed; const coll = type==='user'?'avataaars':'identicon'; return `https://api.dicebear.com/7.x/${coll}/svg?seed=${encodeURIComponent(seed)}`; }

function updateUI(){ const u=state.user; const ava = avatar(u.avatarSeed); if(cache.headerAvatar) cache.headerAvatar.src = ava; if(cache.sidebarAvatar) cache.sidebarAvatar.src = ava; if(cache.profilePageAvatar) cache.profilePageAvatar.src = ava; if(cache.sidebarDisplayName) cache.sidebarDisplayName.textContent = u.displayName||''; if(cache.sidebarUsername) cache.sidebarUsername.textContent = u.username?`@${u.username}`:''; if(cache.menuDisplayName) cache.menuDisplayName.textContent = u.displayName||''; if(cache.menuUsername) cache.menuUsername.textContent = u.username?`@${u.username}`:''; if(cache.welcomeMessage) cache.welcomeMessage.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size:0.6rem; animation:pulse 2s infinite;"></i> ${String(u.displayName||u.username||'misafir').toLowerCase()}, Hoş geldin!`; }

onAuthStateChanged(auth, fbUser=>{
  if(!fbUser){ if(!location.pathname.includes('login.html')) location.href='login.html'; return; }
  state.user.username = fbUser.email ? fbUser.email.split('@')[0] : fbUser.uid;
  state.user.displayName = localStorage.getItem('st_displayName') || fbUser.displayName || state.user.username;
  state.user.avatarSeed = localStorage.getItem('st_avatar') || state.user.avatarSeed;
  state.user.uid = fbUser.uid; state.user.isAdmin = (fbUser.email||'').toLowerCase()===ADMIN_EMAIL.toLowerCase();
  if(cache.adminMenuBtn) cache.adminMenuBtn.style.display = state.user.isAdmin ? 'flex' : 'none';
  updateUI();
});

// search
window.performGlobalSearch = async q =>{
  const queryStr = (q || (cache.globalSearch && cache.globalSearch.value) || '').trim(); if(!queryStr) return; if(!location.pathname.includes('search.html')) return location.href = `search.html?q=${encodeURIComponent(queryStr)}`;
  if(cache.searchStatus) cache.searchStatus.textContent = 'Aranıyor...';
  try{
    const pagesContainer = cache['search-results-pages']; const usersContainer = cache['search-results-users']; if(pagesContainer) pagesContainer.innerHTML=''; if(usersContainer) usersContainer.innerHTML='';
    const pagesSnap = await getDocs(collection(db,'pages'));
    let total=0;
    pagesSnap.forEach(d=>{ const p=d.data(); if(p.name && p.name.toLowerCase().includes(queryStr.toLowerCase())){ total++; pagesContainer && pagesContainer.insertAdjacentHTML('beforeend', `<div class="glass-card page-card" style="text-align:center;padding:10px;"><img src="${avatar(p.avatarSeed,'page')}" style="width:48px;height:48px;border-radius:8px;display:block;margin:6px auto;"><div style="font-weight:800">${p.name}</div><div style="font-size:0.75rem;color:var(--text-muted)">${(p.subscribers||[]).length} takipçi</div></div>`); } });
    const postsSnap = await getDocs(collection(db,'posts'));
    const seen = new Set();
    postsSnap.forEach(d=>{ const p=d.data(); if(!p.username||p.username.startsWith('page_')) return; if(seen.has(p.username)) return; if((p.username&&p.username.toLowerCase().includes(queryStr.toLowerCase())) || (p.name&&p.name.toLowerCase().includes(queryStr.toLowerCase()))){ seen.add(p.username); total++; usersContainer && usersContainer.insertAdjacentHTML('beforeend', `<div class="glass-card page-card" style="text-align:center;padding:10px;"><img src="${avatar(p.avatarSeed)}" style="width:48px;height:48px;border-radius:50%;display:block;margin:6px auto;"><div style="font-weight:800">${p.name||'Kullanıcı'}</div><div style="font-size:0.75rem;color:var(--text-muted)">@${p.username}</div></div>`); } });
    if(cache.searchStatus) cache.searchStatus.textContent = total?`${total} sonuç bulundu.`:'Eşleşen sonuç bulunamadı.';
  }catch(e){ console.error(e); if(cache.searchStatus) cache.searchStatus.textContent='Arama sırasında hata oluştu.'; }
};

// feed
onSnapshot(query(collection(db,'posts'), orderBy('timestamp','desc')), snap=>{ const feed = cache['feed-items']; if(!feed) return; feed.innerHTML=''; snap.forEach(d=>{ const p=d.data(); const isPage = p.username?.startsWith('page_'); const ava = avatar(p.avatarSeed,isPage?'page':'user'); const content = (p.content||'').replace(/(#[\wığüşöçİĞÜŞÖÇ]+)/g,'$1'); feed.insertAdjacentHTML('beforeend', `<div class="glass-card post" style="padding:12px;margin-bottom:12px;"><div style="display:flex;gap:10px;"><img src="${ava}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;"><div><div style="font-weight:700">${p.name||''} <span style="font-size:0.8rem;color:var(--text-muted);">@${p.username}</span></div><div style="margin-top:8px;">${content}</div></div></div></div>`); }); });

// pages sidebar
onSnapshot(collection(db,'pages'), snap=>{ const trend = cache['trend-pages-list']; if(!trend) return; trend.innerHTML=''; const arr=[]; snap.forEach(d=>arr.push({id:d.id,...d.data()})); arr.sort((a,b)=>(b.subscribers?.length||0)-(a.subscribers?.length||0)).slice(0,5).forEach(p=> trend.insertAdjacentHTML('beforeend', `<div class="trend-item"><img src="${avatar(p.avatarSeed,'page')}" style="width:30px;height:30px;border-radius:8px;margin-right:10px;"> <div class="trend-info"><div class="trend-name">${p.name}</div><div class="trend-meta">${(p.subscribers||[]).length} takipçi</div></div></div>`)); });

// gundem
window.shareGundem = async ()=>{ const txt = cache.gundemInput?.value?.trim(); if(!txt) return alert('Bir şey yazın'); await addDoc(collection(db,'gundem'),{ content:txt, author: state.user.displayName||state.user.username, timestamp: serverTimestamp() }); if(cache.gundemInput) cache.gundemInput.value=''; };
onSnapshot(query(collection(db,'gundem'), orderBy('timestamp','desc'), limit(10)), snap=>{ const f=cache.gundemFeed; if(!f) return; f.innerHTML=''; snap.forEach(d=>{ const g=d.data(); f.insertAdjacentHTML('beforeend', `<div class="g-card"><div style="font-weight:700">${g.content}</div><div style="font-size:0.8rem;color:var(--text-muted)">@${g.author||'Anon'}</div></div>`); }); });

// clock
setInterval(()=>{ const n=new Date(); if(cache.digiClock) cache.digiClock.innerText = n.toLocaleTimeString(state.lang==='tr'?'tr-TR':'en-US'); if(cache.dateDisplay) cache.dateDisplay.innerText = n.toLocaleDateString(state.lang==='tr'?'tr-TR':'en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); },1000);

// simple helpers
window.toggleDarkMode = ()=>{ const on = document.body.classList.toggle('dark-mode'); localStorage.setItem('st_theme', on?'dark':'light'); if(cache.themeToggleBtn) cache.themeToggleBtn.innerHTML = on?'<i class="fa-solid fa-sun"></i>':'<i class="fa-solid fa-moon"></i>'; };
window.likePost = async (id,isLiked)=> await updateDoc(doc(db,'posts',id),{ likes: isLiked?arrayRemove(state.user.username):arrayUnion(state.user.username) });
window.toggleBookmark = async (id,isSaved)=> await updateDoc(doc(db,'posts',id),{ savedBy: isSaved?arrayRemove(state.user.username):arrayUnion(state.user.username) });
window.addComment = async id=>{ const input = document.getElementById(`input-${id}`); if(!input) return; const text = input.value.trim(); if(!text) return; await updateDoc(doc(db,'posts',id),{ comments: arrayUnion({ username: state.user.username, displayName: state.user.displayName, avatarSeed: state.user.avatarSeed, text, time: Date.now(), replies: [] }) }); input.value=''; };

console.log('app.optimized.js loaded');
