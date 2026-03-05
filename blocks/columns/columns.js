export default function decorate(block) {
  const cols = [...block.firstElementChild.children];
  block.classList.add(`columns-${cols.length}-cols`);

  // setup image columns
  [...block.children].forEach((row) => {
    [...row.children].forEach((col) => {
      const pic = col.querySelector('picture');
      if (pic) {
        const picWrapper = pic.closest('div');
        if (picWrapper && picWrapper.children.length === 1) {
          // picture is only content in column
          picWrapper.classList.add('columns-img-col');
        }
      }
    });
  });

  // scroll-driven 3D parallax for the station image
  const imgCol = block.querySelector('.columns-img-col');
  if (!imgCol) return;

  const img = imgCol.querySelector('img');
  if (!img) return;

  // Only apply 3D effect on desktop and when the image is tall (station renders)
  const apply3D = () => window.matchMedia('(min-width: 900px)').matches;

  let ticking = false;

  function onScroll() {
    if (!apply3D()) {
      img.style.transform = '';
      return;
    }
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const rect = block.getBoundingClientRect();
      const vh = window.innerHeight;
      // progress: 0 when block enters viewport bottom, 1 when it exits top
      const progress = 1 - (rect.top + rect.height) / (vh + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));

      // Parallax: image moves slower than scroll (translateY offset)
      const parallax = (clamped - 0.5) * -60;
      // Subtle Y-axis rotation driven by scroll (like turning the station)
      const rotateY = (clamped - 0.5) * 12;
      // Very subtle tilt on X axis
      const rotateX = (clamped - 0.5) * -4;

      img.style.transform = `translateY(${parallax}px) rotateY(${rotateY}deg) rotateX(${rotateX}deg)`;
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
