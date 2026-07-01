function safelyInjectIncludedScript(sourceScript, targetContainer) {
  if (!sourceScript || !sourceScript.src) return false;

  try {
    const scriptTag = document.createElement('script');
    scriptTag.src = sourceScript.src;
    if (sourceScript.type) scriptTag.type = sourceScript.type;
    if (sourceScript.async) scriptTag.async = true;
    if (sourceScript.defer) scriptTag.defer = true;
    scriptTag.dataset.includeInjected = 'true';
    targetContainer.appendChild(scriptTag);
    return true;
  } catch (err) {
    console.warn('Included external script could not be injected safely:', err);
    return false;
  }
}

async function runIncludes() {
  const includes = Array.from(document.querySelectorAll('[data-include]'));
  await Promise.all(includes.map(async (el) => {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      const buffer = await res.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buffer);
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      const safeHtml = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
      el.innerHTML = safeHtml;

      const scripts = Array.from(el.querySelectorAll('script'));
      const targetContainer = document.body || document.documentElement;
      scripts.forEach((s) => {
        safelyInjectIncludedScript(s, targetContainer);
        s.remove();
      });
    } catch (err) {
      console.error('Include error:', url, err);
    }
  }));

  // signal that all includes have been processed so other scripts can act
  document.dispatchEvent(new Event('includesLoaded'));
  // mark globally so late listeners can still act
  window.includesLoaded = true;
}

// Run immediately if DOM is already ready, otherwise wait for DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runIncludes);
} else {
  runIncludes();
}
