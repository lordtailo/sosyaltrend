// Standalone chat widget implementation
(function () {
  function ensureCss() {
    if (!document.querySelector('link[href*="chat-widget.css"]')) {
      const cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'assets/css/chat-widget.css?v=20260709a';
      document.head.appendChild(cssLink);
    }
  }

  function createWidget() {
    if (document.getElementById('chat-widget-container')) return;
    ensureCss();

    const chatWidget = document.createElement('div');
    chatWidget.id = 'chat-widget-container';
    chatWidget.className = 'chat-widget-container';
    chatWidget.innerHTML = `
      <div class="chat-widget-header">
        <div class="chat-header-left">
          <button class="back-btn" id="chat-back-btn" title="Geri Dön" type="button" onclick="event.preventDefault(); event.stopPropagation(); if (window.backToFriendList) window.backToFriendList();">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div class="chat-header-title">
            <h3 id="chat-widget-title">Sohbet</h3>
            <span id="chat-unread-count" class="chat-unread-badge" style="display:none;">0 yeni</span>
          </div>
        </div>
        <div class="chat-header-actions">
          <button class="chat-clear-btn" id="chat-clear-btn" style="display:none;" title="Sohbeti temizle" type="button">
            <i class="fa-solid fa-broom"></i>
          </button>
          <button class="close-btn group-chat-close-btn" id="chat-close-btn" title="Kapat">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>
      </div>
      <div id="group-chat-members-bar" class="group-chat-members-bar" style="display:none;"></div>
      <div class="chat-widget-messages" id="chat-widget-messages">
        <div class="chat-empty"><i class="fa-regular fa-comment"></i><p>Henüz mesaj yok</p></div>
      </div>
      <div class="chat-widget-input">
        <button id="chat-attach-btn" class="attach-btn" title="Dosya"><i class="fa-solid fa-paperclip"></i></button>
        <input type="text" id="chat-widget-input" placeholder="Mesaj yaz...">
        <button id="chat-send-btn"><i class="fa-solid fa-paper-plane"></i></button>
        <input type="file" id="chat-attachment-input" accept="image/*,audio/*" style="display:none;">
      </div>
    `;

    const shell = document.getElementById('chat-page-shell');
    if (shell) shell.appendChild(chatWidget); else document.body.appendChild(chatWidget);

    // Basic behavior wiring
    document.getElementById('chat-close-btn').addEventListener('click', closeChatWidget);
    document.getElementById('chat-back-btn').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof window.backToFriendList === 'function') {
        window.backToFriendList();
      }
    });
    const clearBtn = document.getElementById('chat-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (typeof window.clearChatHistory === 'function') {
          window.clearChatHistory();
        }
      });
    }
    document.getElementById('chat-send-btn').addEventListener('click', () => {
      const txt = document.getElementById('chat-widget-input').value.trim();
      if (!txt) return;
      if (typeof window.sendChatMessage === 'function') {
        window.sendChatMessage(txt);
        document.getElementById('chat-widget-input').value = '';
      } else {
        appendLocalMessage(txt);
        document.getElementById('chat-widget-input').value = '';
      }
    });

    document.getElementById('chat-widget-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-send-btn').click();
      }
    });

    document.getElementById('chat-attach-btn').addEventListener('click', () => {
      document.getElementById('chat-attachment-input').click();
    });

    document.getElementById('chat-attachment-input').addEventListener('change', (e) => {
      if (typeof window.handleChatAttachment === 'function') {
        window.handleChatAttachment(e);
      }
    });
  }

  function appendLocalMessage(text) {
    const container = document.getElementById('chat-widget-messages');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'chat-message own';
    el.innerHTML = `
      <img src="assets/img/strendsaydamv2.png" class="chat-message-avatar" alt="">
      <div class="chat-message-content">
        <div class="chat-message-bubble">${escapeHtml(text)}</div>
        <div class="chat-meta"><div class="chat-message-time">Az önce</div></div>
      </div>
    `;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
  }

  // Minimal helpers
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c)); }

  // Exposed globals
  window._initChatWidgetImpl = function() { createWidget(); };

  window.openChatWidget = function(title){
    if (!document.getElementById('chat-widget-container')) createWidget();
    const w = document.getElementById('chat-widget-container');
    if (!w) return;
    if (title) document.getElementById('chat-widget-title').textContent = title;
    w.classList.add('active');
    const msgs = document.getElementById('chat-widget-messages'); if (msgs) msgs.scrollTop = msgs.scrollHeight;
  };

  window.closeChatWidget = function(){
    const w = document.getElementById('chat-widget-container');
    if (w) w.classList.remove('active');
    const clearBtn = document.getElementById('chat-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
  };

  window.backToFriendList = function(){ window.closeChatWidget(); if (typeof window.openChatsList === 'function') window.openChatsList(true); };

  // Initialize immediately if loader already requested init
  if (window.__chatWidgetLoaderInstalled) {
    createWidget();
  }
})();
