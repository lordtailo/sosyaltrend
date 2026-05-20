import '../assets/js/app.js';
import './ai-client.js';

// Firebase client (Firestore) — used to store/retrieve chat history server-side
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs, startAfter } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "AIzaSyBegJHqlfPagx8biFyS_FnE3iXOksgfoAU",
	authDomain: "sosyaltrend-21d21.firebaseapp.com",
	projectId: "sosyaltrend-21d21",
	storageBucket: "sosyaltrend-21d21.firebasestorage.app",
	messagingSenderId: "207734473261",
	appId: "1:207734473261:web:f31b6bf2908c6d88986ea4",
	measurementId: "G-5T2RCQL3MB"
};

let fbApp, fbDb;
try {
	fbApp = initializeApp(firebaseConfig, 'stbot-client');
	fbDb = getFirestore(fbApp);
} catch (e) {
	// ignore if already initialized
}

// Shared storage helpers for stbot history clearing
function getStbotStorageKey() {
	return 'stbot_history_' + ((window.user && window.user.id) ? window.user.id : 'guest');
}

function clearStbotHistoryLocal(conversationId = null) {
	const storageKey = getStbotStorageKey();
	try {
		if (!conversationId) {
			localStorage.removeItem(storageKey);
			return true;
		}
		const raw = localStorage.getItem(storageKey);
		if (!raw) return false;
		const arr = JSON.parse(raw);
		const filtered = arr.filter(it => (it.conversation || 'global') !== conversationId);
		localStorage.setItem(storageKey, JSON.stringify(filtered));
		return filtered.length !== arr.length;
	} catch (e) {
		return false;
	}
}

window.clearStBotHistory = function(conversationId = null) {
	const ok = clearStbotHistoryLocal(conversationId);
	const modal = document.getElementById('stbot-ai-modal');
	if (modal) {
		const messages = modal.querySelector('div[style*="overflow: auto"]');
		if (messages) {
			messages.innerHTML = '';
			const info = document.createElement('div');
			info.style.textAlign = 'center';
			info.style.color = 'var(--text-muted)';
			info.style.margin = '8px 0';
			info.textContent = ok ? 'Geçmiş temizlendi.' : 'Silinecek geçmiş yok.';
			messages.appendChild(info);
		}
	}
	return ok;
};

// Yapay Zeka admin chat page entrypoint — shared app.js contains the common application logic.
// `openStBotChat()` fonksiyonu global olarak atanır ve stbot sayfasındaki butondan çağrılır.

function createChatModal(conversationId = 'global', conversationLabel = '') {
    if (document.getElementById('stbot-ai-modal')) return document.getElementById('stbot-ai-modal');

    const overlay = document.createElement('div');
    overlay.id = 'stbot-ai-modal';
    Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
        width: '720px', maxWidth: '94%', maxHeight: '84%', background: 'var(--card-bg, #0f1724)',
        borderRadius: '12px', padding: '14px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    });

    const header = document.createElement('div');
    header.style.display = 'flex'; header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center'; header.style.marginBottom = '8px';
    header.innerHTML = '<strong>Yapay Zeka Sohbeti</strong>' + (conversationLabel ? (' — ' + conversationLabel) : '');

    const actions = document.createElement('div');
    actions.style.display = 'flex'; actions.style.alignItems = 'center'; actions.style.gap = '6px';

    const clearBtn = document.createElement('button');
    clearBtn.innerHTML = '🗑️ Geçmişi Sil';
    Object.assign(clearBtn.style, { border: 'none', background: 'rgba(255,255,255,0.02)', color: 'var(--text-main, #fff)', cursor: 'pointer', marginRight: '10px', padding: '6px 10px', borderRadius: '6px' });
    clearBtn.title = 'Sohbet geçmişini yönet';

    // Ayrıca modal başlığı içinde belirgin bir temizle butonu (her zaman görünür)
    const headerClearBtn = document.createElement('button');
    headerClearBtn.id = 'stbot-modal-clear-btn';
    headerClearBtn.innerHTML = 'Geçmişi Temizle';
    Object.assign(headerClearBtn.style, { border: 'none', background: 'linear-gradient(90deg,#ef4444,#fb7185)', color: '#fff', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', fontWeight: '700' });
    headerClearBtn.title = 'Bu konuşmanın geçmişini temizle (yerel)';


    // Adminler için: herkesten sil butonu — sunucu tarafı desteklenmelidir
    let clearAllBtn = null;
    if (window.user && window.user.isAdmin) {
        clearAllBtn = document.createElement('button');
        clearAllBtn.textContent = '⚠️ Herkesten Sil';
        Object.assign(clearAllBtn.style, { border: 'none', background: 'rgba(255,0,0,0.06)', color: '#ff6666', cursor: 'pointer', marginRight: '10px', padding: '6px 10px', borderRadius: '6px' });
        clearAllBtn.title = 'Tüm kullanıcıların sohbet geçmişini siler (sunucu desteklemelidir)';
        clearAllBtn.onclick = async () => {
            if (!confirm('Tüm kullanıcıların sohbet geçmişini sunucudan silmek istediğinize emin misiniz?')) return;
            try {
                const res = await fetch('/yapay-zeka/clear-all', { method: 'POST' });
                if (res.ok) {
                    alert('Sunucudaki geçmişler temizlendi.');
                } else {
                    const txt = await res.text();
                    alert('Sunucu hatası: ' + (txt || res.statusText));
                }
            } catch (e) {
                alert('Sunucuya ulaşılamadı; herkesten silme başarısız.');
            }
        };
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Kapat';
    Object.assign(closeBtn.style, { border: 'none', background: 'rgba(255,255,255,0.02)', color: 'var(--text-main, #fff)', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px' });
    closeBtn.onclick = () => overlay.remove();

    actions.appendChild(clearBtn);
    actions.appendChild(headerClearBtn);
    if (clearAllBtn) actions.appendChild(clearAllBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);

    const messages = document.createElement('div');
    messages.style.flex = '1'; messages.style.overflow = 'auto'; messages.style.padding = '8px'; messages.style.marginBottom = '8px';
    messages.style.background = 'transparent';

    const storageKey = 'stbot_history_' + ((window.user && window.user.id) ? window.user.id : 'guest');
    const convKey = conversationId || 'global';

    // Firestore pagination state for this modal
    let fbLastDoc = null;
    let fbHasMore = true;

    function loadHistory() {
        // Prefer Firestore when available
        if (fbDb && navigator.onLine) {
            loadHistoryFromFirestore().catch(() => {
                // fallback to local
                try {
                    const raw = localStorage.getItem(storageKey);
                    if (!raw) return;
                    const items = JSON.parse(raw);
                    const filtered = items.filter(it => (it.conversation || 'global') === convKey);
                    filtered.forEach(it => appendMessage(messages, it.who, it.text, false));
                    messages.scrollTop = messages.scrollHeight;
                } catch (e) { }
            });
            return;
        }
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return;
            const items = JSON.parse(raw);
            const filtered = items.filter(it => (it.conversation || 'global') === convKey);
            filtered.forEach(it => appendMessage(messages, it.who, it.text, false));
            messages.scrollTop = messages.scrollHeight;
        } catch (e) {
            // ignore
        }
    }

    function persistMessage(who, text) {
        try {
            const raw = localStorage.getItem(storageKey);
            const arr = raw ? JSON.parse(raw) : [];
            arr.push({ conversation: convKey, who, text, time: Date.now() });
            // limit history
            while (arr.length > 60) arr.shift();
            localStorage.setItem(storageKey, JSON.stringify(arr));

            // also persist to Firestore (fire-and-forget)
            if (fbDb) {
                persistMessageToFirestore(convKey, who, text).catch(err => console.error('stbot persist error', err));
            }
        } catch (e) {
            // ignore
        }
    }

    async function persistMessageToFirestore(conv, who, text) {
        try {
            const colRef = collection(fbDb, 'stbot_conversations', conv, 'messages');
            await addDoc(colRef, {
                who, text, createdAt: Date.now(), userId: (window.user && window.user.id) ? window.user.id : null
            });
        } catch (e) {
            throw e;
        }
    }

    async function loadHistoryFromFirestore(initial = true) {
        if (!fbDb) return;
        const colRef = collection(fbDb, 'stbot_conversations', convKey, 'messages');
        const pageSize = 40;
        let q;
        if (initial) {
            q = query(colRef, orderBy('createdAt', 'desc'), limit(pageSize));
        } else {
            if (!fbHasMore || !fbLastDoc) return;
            q = query(colRef, orderBy('createdAt', 'desc'), startAfter(fbLastDoc), limit(pageSize));
        }
        const snap = await getDocs(q);
        if (snap.empty) { fbHasMore = false; return; }
        // save last doc for pagination
        fbLastDoc = snap.docs[snap.docs.length - 1];
        if (snap.docs.length < pageSize) fbHasMore = false;
        // results are newest-first; display oldest-first
        const docs = snap.docs.slice().reverse();
        // if initial load, prepend a Load More button if there are older messages
        if (initial && fbHasMore) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = 'Daha öncekileri yükle';
            Object.assign(loadMoreBtn.style, { display: 'block', margin: '6px auto', padding: '6px 10px', borderRadius: '6px' });
            loadMoreBtn.onclick = async () => {
                loadMoreBtn.disabled = true;
                await loadHistoryFromFirestore(false);
                loadMoreBtn.remove();
            };
            messages.appendChild(loadMoreBtn);
        }
        docs.forEach(d => {
            const data = d.data();
            appendMessage(messages, data.who, data.text, false);
        });
        messages.scrollTop = messages.scrollHeight;
    }

    function clearConversationLocal() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return false;
            const arr = JSON.parse(raw);
            const filtered = arr.filter(it => (it.conversation || 'global') !== convKey);
            localStorage.setItem(storageKey, JSON.stringify(filtered));
            return (filtered.length !== arr.length);
        } catch (e) { return false; }
    }

    // headerClearBtn aksiyonunu bağla
    if (typeof headerClearBtn !== 'undefined') {
        headerClearBtn.addEventListener('click', () => {
            if (!confirm('Bu konuşmanın geçmişini silmek istiyor musunuz?')) return;
            const ok = clearConversationLocal();
            messages.innerHTML = '';
            const info = document.createElement('div'); info.style.textAlign = 'center'; info.style.color = 'var(--text-muted)'; info.style.margin = '8px 0';
            info.textContent = ok ? 'Konuşma geçmişi temizlendi (yerel).' : 'Konuşma geçmişi bulunamadı.';
            messages.appendChild(info);
        });
    }

    // clearBtn onclick: önce 'sadece benden' seçeneği, aksi halde (admin ise) 'herkesten' seçeneği sunulur
    clearBtn.onclick = async () => {
        const onlyMe = confirm('Geçmişi sadece sizin için silmek istiyor musunuz? (Tamam = Sadece benden, İptal = Diğer seçenek)');
        if (onlyMe) {
            clearConversationLocal();
            messages.innerHTML = '';
            const info = document.createElement('div'); info.style.textAlign = 'center'; info.style.color = 'var(--text-muted)'; info.style.margin = '8px 0'; info.textContent = 'Sadece sizin geçmişiniz temizlendi.';
            messages.appendChild(info);
            return;
        }

        // İptal seçeneği ile geldi -> admin ise herkesten silme dene
        if (window.user && window.user.isAdmin) {
            if (!confirm('Herkesten silmek istediğinize emin misiniz?')) return;
            try {
                const res = await fetch('/yapay-zeka/clear-conversation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId: convKey }) });
                if (res.ok) {
                    alert('Sunucudaki konuşma geçmişi temizlendi.');
                    clearConversationLocal();
                    messages.innerHTML = '';
                } else {
                    const txt = await res.text();
                    alert('Sunucu hatası: ' + (txt || res.statusText));
                }
            } catch (e) { alert('Sunucuya ulaşılamadı; herkesten silme başarısız.'); }
        } else {
            alert('Herkesten silme işlemi yalnızca adminler içindir.');
        }
    };

    const form = document.createElement('form');
    form.style.display = 'flex'; form.style.gap = '8px';

    const input = document.createElement('input');
    input.type = 'text'; input.placeholder = 'Sorunuzu yazın...';
    Object.assign(input.style, { flex: '1', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' });

    const send = document.createElement('button');
    send.type = 'submit'; send.textContent = 'Gönder';
    Object.assign(send.style, { padding: '10px 14px', borderRadius: '8px', background: 'var(--primary)', color: '#fff', border: 'none' });

    // Footer clear button — görünür ve kolay erişilebilir
    const footerClear = document.createElement('button');
    footerClear.type = 'button'; footerClear.innerHTML = '🧹 Temizle';
    Object.assign(footerClear.style, { padding: '10px 12px', borderRadius: '8px', background: 'transparent', color: 'var(--text-main, #fff)', border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' });
    footerClear.title = 'Sohbet geçmişinizi siler';
    footerClear.onclick = () => {
        if (!confirm('Bu konuşmanın geçmişini temizlemek istiyor musunuz?')) return;
        const ok = clearConversationLocal();
        messages.innerHTML = '';
        const info = document.createElement('div');
        info.style.textAlign = 'center'; info.style.color = 'var(--text-muted)'; info.style.margin = '8px 0';
        info.textContent = ok ? 'Konuşma geçmişi temizlendi.' : 'Konuşma geçmişi bulunamadı.';
        messages.appendChild(info);
    };

    form.appendChild(input);
    form.appendChild(footerClear);
    form.appendChild(send);

    card.appendChild(header); card.appendChild(messages); card.appendChild(form);
    overlay.appendChild(card);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        const username = (window.user && (window.user.username || window.user.name)) ? (window.user.username || window.user.name) : 'Siz';
        appendMessage(messages, 'you', username + ': ' + text);
        persistMessage('you', username + ': ' + text);
        input.value = '';
        appendMessage(messages, 'bot', 'Gönderiliyor...');
        try {
            const reply = await window.yapayZekaClient.getAIResponse(text);
            // son bot mesajını güncelle
            const last = messages.querySelector('.stbot-bot:last-child');
            if (last) last.textContent = reply;
            else appendMessage(messages, 'bot', reply);
            persistMessage('bot', reply);
        } catch (err) {
            appendMessage(messages, 'bot', 'Hata: cevap alınamadı.');
            persistMessage('bot', 'Hata: cevap alınamadı.');
        }
        messages.scrollTop = messages.scrollHeight;
    });

    function appendMessage(container, who, text, save = true) {
        const el = document.createElement('div');
        el.className = who === 'bot' ? 'stbot-bot' : 'stbot-you';
        el.style.margin = '8px 0';
        el.style.padding = '10px 12px';
        el.style.borderRadius = '10px';
        el.style.maxWidth = '86%';
        if (who === 'bot') {
            el.style.background = 'rgba(255,255,255,0.04)'; el.style.color = 'var(--text-main)'; el.style.alignSelf = 'flex-start';
        } else {
            el.style.background = 'var(--primary)'; el.style.color = '#fff'; el.style.alignSelf = 'flex-end';
        }
        el.textContent = text;
        container.appendChild(el);
        if (save) persistMessage(who, text);
    }

    document.body.appendChild(overlay);
    // load persisted history after appended so scroll works
    loadHistory();
    return overlay;
}

function openStBotChat(conversationId, conversationLabel) {
    const modal = createChatModal(conversationId, conversationLabel);
    // focus input
    const inp = modal.querySelector('input');
    if (inp) setTimeout(() => inp.focus(), 100);
}

// ata global fonksiyona (HTML onclick çağırıyor)
window.openStBotChat = openStBotChat;

export { openStBotChat };
