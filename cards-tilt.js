// Cards lean a few degrees toward the pointer. CSS (wireframe.css) turns --tx/--ty into the tilt.
if (matchMedia("(hover: hover) and (prefers-reduced-motion: no-preference)").matches) {
  const cards = ".card, .roadmap-step";
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || document.documentElement.hasAttribute("data-lite")) return; // lite mode: no tilt
    const card = e.target.closest?.(cards);
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--tx", ((e.clientX - r.left) / r.width * 2 - 1).toFixed(3));
    card.style.setProperty("--ty", ((e.clientY - r.top) / r.height * 2 - 1).toFixed(3));
  });
  document.addEventListener("pointerout", (e) => {
    const card = e.target.closest?.(cards);
    if (card && !card.contains(e.relatedTarget)) {
      card.style.removeProperty("--tx");
      card.style.removeProperty("--ty");
    }
  });
}
