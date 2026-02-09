document.addEventListener('DOMContentLoaded', async () => {
  const includes = Array.from(document.querySelectorAll('[data-include]'));
  await Promise.all(includes.map(async (el) => {
    const url = el.getAttribute('data-include');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
      const text = await res.text();
      el.innerHTML = text;

      // Execute any scripts inside the included fragment
      const scripts = Array.from(el.querySelectorAll('script'));
      scripts.forEach((s) => {
        const ns = document.createElement('script');
        if (s.src) ns.src = s.src;
        else ns.textContent = s.textContent;
        if (s.type) ns.type = s.type;
        document.body.appendChild(ns);
        s.remove();
      });
    } catch (err) {
      console.error('Include error:', url, err);
    }
  }));
});
