import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, arrayUnion, arrayRemove, serverTimestamp, getDoc, setDoc, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Aynı firebase config'i kullanan uygulama zaten olabilir; tekrar çağırmak bir sorun yaratmaz.
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

const groupsCollection = collection(db, "hobiGruplari");

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = value.toDate ? value.toDate() : (value instanceof Date ? value : new Date(value));
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatForDatetimeLocal = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (n) => n.toString().padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
};

const getInputValue = (id) => document.getElementById(id)?.value || "";

const renderGroupCard = (docSnap, currentUid) => {
  const data = docSnap.data();
  const groupId = docSnap.id;
  const isOwner = data.ownerUid === currentUid;
  const memberUids = Array.isArray(data.members) ? data.members.map(m => m.uid) : [];
  const isJoined = memberUids.includes(currentUid);

  const card = document.createElement('div');
  card.className = 'group-card';

  const startText = formatDateTime(data.startAt);
  const endText = formatDateTime(data.endAt);
  const memberCount = Array.isArray(data.members) ? data.members.length : 0;
  const memberNames = Array.isArray(data.members) ? data.members.map(m => m.displayName || m.uid) : [];

  card.innerHTML = `
    <div class="group-card-header">
      <div class="group-icon">${data.icon || '🧑‍🤝‍🧑'}</div>
      <div style="flex:1;">
        <div class="group-card-title">${data.title || 'İsimsiz Grup'}</div>
        <div class="group-card-subtitle">${data.desc || ''}</div>
      </div>
    </div>
    <div class="group-members">
      <span><strong>Başlangıç:</strong> ${startText}</span>
      <span><strong>Bitiş:</strong> ${endText}</span>
      <span><strong>Üye:</strong> ${memberCount}</span>
    </div>
    <div class="group-card-details" style="display:none; margin-top: 10px;">
      <div style="margin-bottom: 8px;"><strong>Üyeler:</strong> ${memberNames.slice(0, 5).join(', ')}${memberCount > 5 ? ' ve ' + (memberCount - 5) + ' kişi daha' : ''}</div>
      <div style="font-size:0.85rem; color: var(--text-muted);">Oluşturan: ${data.ownerName || '—'}</div>
    </div>
    <div class="group-card-actions">
      <button class="form-btn" data-action="${isJoined ? 'leave' : 'join'}">${isJoined ? 'Ayrıl' : 'Katıl'}</button>
      <button class="form-btn" style="background: var(--primary);" data-action="chat">Sohbet</button>
      <button class="form-btn" style="background: var(--primary);" data-action="toggle">Detay</button>
      ${isOwner ? `<button class="form-btn" style="background: var(--danger);" data-action="delete">Sil</button>` : ''}
    </div>
  `;

  const joinBtn = card.querySelector('button[data-action="' + (isJoined ? 'leave' : 'join') + '"]');
  const chatBtn = card.querySelector('button[data-action="chat"]');
  const toggleBtn = card.querySelector('button[data-action="toggle"]');
  const deleteBtn = card.querySelector('button[data-action="delete"]');
  const detailsEl = card.querySelector('.group-card-details');

  if (joinBtn) {
    joinBtn.onclick = async () => {
      try {
        const groupRef = doc(groupsCollection, groupId);
        if (isJoined) {
          await updateDoc(groupRef, { members: arrayRemove({ uid: currentUid, displayName: auth.currentUser.displayName || auth.currentUser.email }) });
        } else {
          await updateDoc(groupRef, { members: arrayUnion({ uid: currentUid, displayName: auth.currentUser.displayName || auth.currentUser.email }) });
        }
      } catch (err) {
        console.error('Üyelik güncelleme hatası:', err);
      }
    };
  }

  if (chatBtn) {
    chatBtn.onclick = () => {
      if (!isJoined) {
        alert('Gruba katıldıktan sonra sohbet edebilirsiniz. Önce katılın.');
        return;
      }
      openGroupChat(groupId, data.title || 'Hobi Grubu', memberUids);
    };
  }

  if (toggleBtn && detailsEl) {
    toggleBtn.onclick = () => {
      const isOpen = detailsEl.style.display === 'block';
      detailsEl.style.display = isOpen ? 'none' : 'block';
      toggleBtn.innerText = isOpen ? 'Detay' : 'Kapat';
    };
  }

  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      const yes = confirm('Bu grubu silmek istediğinize emin misiniz?');
      if (!yes) return;
      try {
        await deleteDoc(doc(groupsCollection, groupId));
      } catch (err) {
        console.error('Grup silme hatası:', err);
        alert('Grup silinemedi. Lütfen tekrar deneyin.');
      }
    };
  }

  return card;
};

// -------------------------------------------------------
// Hobi Grubu Sohbet Widget'ı (basit, bağımsız)
// -------------------------------------------------------

const groupChatState = {
  conversationId: null,
  unsubscribe: null,
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const ensureGroupChatCss = () => {
  if (document.querySelector('link[href*="chat-widget.css"]')) return;
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = 'assets/css/chat-widget.css?v=20260240';
  document.head.appendChild(cssLink);
};

const initGroupChatWidget = () => {
  if (document.getElementById('group-chat-widget-container')) return;

  ensureGroupChatCss();

  const chatWidget = document.createElement('div');
  chatWidget.id = 'group-chat-widget-container';
  chatWidget.className = 'chat-widget-container';
  chatWidget.innerHTML = `
    <div class="chat-widget-header">
      <div class="chat-header-left">
        <button class="back-btn" id="group-chat-back-btn" onclick="window.closeGroupChat()" title="Kapat">
          <i class="fa-solid fa-arrow-left"></i>
        </button>
        <h3 id="group-chat-title">Grup Sohbeti</h3>
      </div>
      <button class="close-btn" onclick="window.closeGroupChat()">
        <i class="fa-solid fa-times"></i>
      </button>
    </div>
    <div class="chat-widget-messages" id="group-chat-messages">
      <div class="chat-empty">
        <i class="fa-regular fa-comment"></i>
        <p>Henüz mesaj yok</p>
      </div>
    </div>
    <div class="chat-widget-input">
      <input type="text" id="group-chat-input" placeholder="Mesaj yaz..." onkeypress="window.handleGroupChatKeypress(event)">
      <button onclick="window.sendGroupChatMessage()" id="group-chat-send-btn">
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
  `;

  document.body.appendChild(chatWidget);
};

window.openGroupChat = async function(groupId, groupName, memberIds = []) {
  if (!auth.currentUser) {
    alert('Lütfen giriş yapın');
    return;
  }

  initGroupChatWidget();

  const currentUserId = auth.currentUser.uid;
  const conversationId = `group_${groupId}`;

  // Ensure current user is included
  const participants = Array.from(new Set([...(memberIds || []), currentUserId]));

  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);

  if (!convSnap.exists()) {
    const unreadCount = participants.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});
    await setDoc(convRef, {
      participants,
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastSenderId: '',
      unreadCount,
      createdAt: serverTimestamp(),
      group: true,
      groupId,
      groupName: groupName || 'Hobi Grubu Sohbeti'
    });
  } else {
    const existing = convSnap.data().participants || [];
    const missing = participants.filter(id => !existing.includes(id));
    if (missing.length) {
      await updateDoc(convRef, { participants: [...existing, ...missing] });
    }
  }

  groupChatState.conversationId = conversationId;

  const titleEl = document.getElementById('group-chat-title');
  if (titleEl) titleEl.textContent = groupName || 'Hobi Grubu Sohbeti';

  const widgetEl = document.getElementById('group-chat-widget-container');
  widgetEl.classList.add('active');
  document.body.classList.add('chat-open');

  loadGroupChatMessages(conversationId);
};

window.closeGroupChat = function() {
  const widget = document.getElementById('group-chat-widget-container');
  if (widget) widget.classList.remove('active');
  document.body.classList.remove('chat-open');

  if (groupChatState.unsubscribe) {
    groupChatState.unsubscribe();
    groupChatState.unsubscribe = null;
  }
  groupChatState.conversationId = null;
};

const formatChatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : (timestamp instanceof Date ? timestamp : new Date(timestamp));
  return date.toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const loadGroupChatMessages = (conversationId) => {
  const messagesContainer = document.getElementById('group-chat-messages');
  if (!messagesContainer) return;

  if (groupChatState.unsubscribe) {
    groupChatState.unsubscribe();
  }

  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(50)
  );

  groupChatState.unsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      messagesContainer.innerHTML = `
        <div class="chat-empty">
          <i class="fa-regular fa-comment"></i>
          <p>Henüz mesaj yok</p>
        </div>
      `;
      return;
    }

    messagesContainer.innerHTML = '';

    snapshot.forEach(msgDoc => {
      const msg = msgDoc.data();
      const isOwn = msg.senderId === auth.currentUser.uid;

      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${isOwn ? 'own' : ''}`;

      messageEl.innerHTML = `
        <div class="chat-message-content">
          <div class="chat-message-bubble">
            ${escapeHtml(msg.text)}
          </div>
          <div class="chat-meta">
            <div class="chat-message-time">${formatChatTime(msg.createdAt)}</div>
          </div>
        </div>
      `;

      messagesContainer.appendChild(messageEl);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  });
};

window.sendGroupChatMessage = async function() {
  if (!groupChatState.conversationId || !auth.currentUser) return;

  const inputEl = document.getElementById('group-chat-input');
  if (!inputEl) return;

  const text = inputEl.value.trim();
  if (!text) return;

  const messageData = {
    senderId: auth.currentUser.uid,
    senderName: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
    text,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(
      collection(db, 'conversations', groupChatState.conversationId, 'messages'),
      messageData
    );
    inputEl.value = '';
  } catch (err) {
    console.error('Mesaj gönderme hatası:', err);
    alert('Mesaj gönderilemedi. Lütfen tekrar deneyin.');
  }
};

window.handleGroupChatKeypress = function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    window.sendGroupChatMessage();
  }
};

const renderGroups = (currentUid) => {
  const filterText = getInputValue('groupSearch').trim().toLowerCase();
  const category = getInputValue('groupCategory');
  const showJoinedOnly = document.getElementById('showJoined')?.classList.contains('active');
  const groupsGrid = document.getElementById('groupsGrid');
  if (!groupsGrid) return;

  groupsGrid.innerHTML = '';

  // Firestore güncellenmiş snapshot'ı render edeceğiz.
  // Bu fonksiyon sadece davet noktasında çağrılır; bu fonksiyonun içinde snapshot verisi olacak.
};

const subscribeToGroups = (currentUid) => {
  const q = query(groupsCollection, orderBy('startAt', 'desc'));
  onSnapshot(q, (snapshot) => {
    const container = document.getElementById('groupsGrid');
    if (!container) return;

    const filterText = getInputValue('groupSearch').trim().toLowerCase();
    const category = getInputValue('groupCategory');
    const showJoinedOnly = document.getElementById('showJoined')?.classList.contains('active');

    container.innerHTML = '';

    const items = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (!data) return;
      const title = (data.title || '').toLowerCase();
      const desc = (data.desc || '').toLowerCase();
      const cat = data.category || '';
      const members = Array.isArray(data.members) ? data.members.map(m => m.uid) : [];

      const matchesText = !filterText || title.includes(filterText) || desc.includes(filterText);
      const matchesCategory = !category || cat === category;
      const matchesJoined = !showJoinedOnly || members.includes(currentUid);

      if (matchesText && matchesCategory && matchesJoined) {
        items.push(renderGroupCard(docSnap, currentUid));
      }
    });

    if (!items.length) {
      container.innerHTML = '<div style="grid-column: 1 / -1; text-align:center; color: var(--text-muted); padding: 30px 0;">Eşleşen grup bulunamadı.</div>';
      return;
    }

    items.forEach(el => container.appendChild(el));
  });
};

const initGroupPage = () => {
  const createBtn = document.getElementById('createGroupBtn');
  const statusEl = document.getElementById('createGroupStatus');
  const startInput = document.getElementById('newGroupStart');
  const endInput = document.getElementById('newGroupEnd');

  const setDefaultDateRange = () => {
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60 * 1000); // +5 dakika
    const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 saat

    if (startInput) {
      startInput.value = formatForDatetimeLocal(start);
      startInput.min = formatForDatetimeLocal(now);
    }

    if (endInput) {
      endInput.value = formatForDatetimeLocal(end);
      endInput.min = formatForDatetimeLocal(start);
    }
  };

  const resetForm = () => {
    document.getElementById('newGroupTitle').value = '';
    document.getElementById('newGroupDesc').value = '';
    document.getElementById('newGroupCategory').value = 'kamp';
    setDefaultDateRange();
  };

  const validate = ({ title, desc, start, end }) => {
    if (!title.trim()) return 'Grup başlığı gerekli.';
    if (!desc.trim()) return 'Açıklama giriniz.';
    if (!start) return 'Başlangıç tarihi/saatini seçiniz.';
    if (!end) return 'Bitiş tarihi/saatini seçiniz.';
    if (new Date(start) >= new Date(end)) return 'Bitiş, başlangıçtan sonra olmalıdır.';
    return '';
  };

  if (!createBtn) return;

  // Varsayılan başlangıç/bitiş tarih/saat aralığını sağla ve kullanıcının
  // başlangıç tarihini değiştirdiğinde bitiş tarihini minimum o tarihe ayarla.
  resetForm();

  if (startInput && endInput) {
    startInput.addEventListener('change', () => {
      if (!startInput.value) return;
      endInput.min = startInput.value;

      const startDate = new Date(startInput.value);
      const endDate = endInput.value ? new Date(endInput.value) : null;
      if (!endDate || endDate <= startDate) {
        const newEnd = new Date(startDate.getTime() + 60 * 60 * 1000);
        endInput.value = formatForDatetimeLocal(newEnd);
      }
    });
  }

  createBtn.onclick = async () => {
    const title = getInputValue('newGroupTitle');
    const desc = getInputValue('newGroupDesc');
    const category = getInputValue('newGroupCategory');
    const start = getInputValue('newGroupStart');
    const end = getInputValue('newGroupEnd');

    const error = validate({ title, desc, start, end });
    if (error) {
      if (statusEl) {
        statusEl.innerText = error;
        statusEl.style.color = 'var(--danger)';
      }
      return;
    }

    if (!auth.currentUser) {
      window.location.href = 'login.html';
      return;
    }

    try {
      const now = new Date();
      await addDoc(groupsCollection, {
        title: title.trim(),
        desc: desc.trim(),
        category,
        startAt: new Date(start),
        endAt: new Date(end),
        createdAt: serverTimestamp(),
        ownerUid: auth.currentUser.uid,
        ownerName: auth.currentUser.displayName || auth.currentUser.email || 'Anonim',
        icon: '👥',
        members: [
          { uid: auth.currentUser.uid, displayName: auth.currentUser.displayName || auth.currentUser.email || 'Anonim' }
        ]
      });

      if (statusEl) {
        statusEl.innerText = 'Grup başarıyla oluşturuldu.';
        statusEl.style.color = 'var(--success)';
      }
      resetForm();
    } catch (err) {
      console.error('Grup oluşturma hatası:', err);
      if (statusEl) {
        statusEl.innerText = 'Grup oluşturulamadı. Lütfen tekrar deneyin.';
        statusEl.style.color = 'var(--danger)';
      }
    }
  };

  const searchInput = document.getElementById('groupSearch');
  const categorySelect = document.getElementById('groupCategory');
  const showJoinedBtn = document.getElementById('showJoined');

  if (searchInput) searchInput.addEventListener('input', () => subscribeToGroups(auth.currentUser.uid));
  if (categorySelect) categorySelect.addEventListener('change', () => subscribeToGroups(auth.currentUser.uid));
  if (showJoinedBtn) showJoinedBtn.addEventListener('click', () => {
    showJoinedBtn.classList.toggle('active');
    subscribeToGroups(auth.currentUser.uid);
  });
};

onAuthStateChanged(auth, (fbUser) => {
  if (!fbUser) {
    window.location.href = 'login.html';
    return;
  }
  initGroupPage();
  subscribeToGroups(fbUser.uid);
});
