// Sliding thumb for the desktop header nav; slides to the clicked item, then navigates.
(() => {
  const list = document.querySelector('.site-header .nav-links');
  if (!list) return;
  const thumb = document.createElement('span');
  thumb.className = 'nav-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  list.prepend(thumb);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const place = (a, instant) => {
    if (!a) return;
    if (instant) thumb.dataset.instant = '';
    thumb.style.inlineSize = a.offsetWidth + 'px';
    thumb.style.transform = `translateX(${a.offsetLeft}px)`;
    if (instant) { thumb.getBoundingClientRect(); delete thumb.dataset.instant; }
  };
  const current = () => list.querySelector('a.active, a[aria-current="page"]');
  place(current(), true);
  addEventListener('resize', () => place(current(), true));
  document.fonts?.ready.then(() => place(current(), true));
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => place(current(), true)); ro.observe(list); list.querySelectorAll('a').forEach(a => ro.observe(a)); }
  addEventListener('pageshow', () => place(current(), true));
  list.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a === current() || reduce.matches || getComputedStyle(thumb).display === 'none') return;
    e.preventDefault();
    place(a);
    setTimeout(() => { location.href = a.href; }, 200);
  });
})();
