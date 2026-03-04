import { createOptimizedPicture } from '../../scripts/aem.js';

function createButton(label, direction) {
  const btn = document.createElement('button');
  btn.className = `carousel-btn carousel-btn-${direction}`;
  btn.setAttribute('aria-label', label);
  btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M7.5 4L13.5 10L7.5 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return btn;
}

export default function decorate(block) {
  const slides = [...block.children];
  if (!slides.length) return;

  /* build slide track */
  const track = document.createElement('div');
  track.className = 'carousel-track';

  slides.forEach((row) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';

    const cells = [...row.children];
    /* cell 0 = image, cell 1 = text content */
    const imgCell = cells[0];
    const textCell = cells[1];

    /* image background */
    if (imgCell) {
      const imgWrap = document.createElement('div');
      imgWrap.className = 'carousel-slide-image';
      while (imgCell.firstElementChild) imgWrap.append(imgCell.firstElementChild);
      slide.append(imgWrap);
    }

    /* text overlay */
    if (textCell) {
      const overlay = document.createElement('div');
      overlay.className = 'carousel-slide-overlay';
      while (textCell.firstElementChild) overlay.append(textCell.firstElementChild);
      slide.append(overlay);
    }

    track.append(slide);
  });

  /* optimize images */
  track.querySelectorAll('picture > img').forEach((img) => {
    img.closest('picture').replaceWith(
      createOptimizedPicture(img.src, img.alt, false, [{ width: '1200' }]),
    );
  });

  /* viewport for the track */
  const viewport = document.createElement('div');
  viewport.className = 'carousel-viewport';
  viewport.append(track);

  /* navigation */
  const nav = document.createElement('div');
  nav.className = 'carousel-nav';

  const prevBtn = createButton('Previous Slide', 'prev');
  const nextBtn = createButton('Next Slide', 'next');

  /* progress indicator */
  const progress = document.createElement('div');
  progress.className = 'carousel-progress';
  const totalSlides = slides.length;
  const barsPerPage = Math.min(totalSlides, 24);
  for (let i = 0; i < barsPerPage; i += 1) {
    const bar = document.createElement('div');
    bar.className = 'carousel-progress-bar';
    if (i === 0) bar.classList.add('active');
    progress.append(bar);
  }

  const buttons = document.createElement('div');
  buttons.className = 'carousel-buttons';
  buttons.append(prevBtn, nextBtn);

  nav.append(progress, buttons);

  /* assemble */
  block.replaceChildren(viewport, nav);

  /* state */
  let currentIndex = 0;

  function getSlideWidth() {
    const slide = track.querySelector('.carousel-slide');
    if (!slide) return 0;
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
    return slide.offsetWidth + gap;
  }

  function updateProgress() {
    const bars = progress.querySelectorAll('.carousel-progress-bar');
    const barIndex = Math.round((currentIndex / Math.max(totalSlides - 1, 1)) * (barsPerPage - 1));
    bars.forEach((bar, i) => {
      bar.classList.toggle('active', i === barIndex);
    });
  }

  function goTo(index) {
    const max = totalSlides - 1;
    currentIndex = Math.max(0, Math.min(index, max));
    const offset = currentIndex * getSlideWidth();
    track.style.transform = `translateX(-${offset}px)`;
    updateProgress();
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === max;
  }

  prevBtn.addEventListener('click', () => goTo(currentIndex - 1));
  nextBtn.addEventListener('click', () => goTo(currentIndex + 1));

  /* touch / drag support */
  let startX = 0;
  let dragging = false;

  viewport.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    dragging = true;
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const diff = e.clientX - startX;
    const offset = currentIndex * getSlideWidth() - diff;
    track.style.transition = 'none';
    track.style.transform = `translateX(-${offset}px)`;
  });

  viewport.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    track.style.transition = '';
    const diff = e.clientX - startX;
    const threshold = getSlideWidth() * 0.2;
    if (diff > threshold) goTo(currentIndex - 1);
    else if (diff < -threshold) goTo(currentIndex + 1);
    else goTo(currentIndex);
  });

  viewport.addEventListener('pointerleave', () => {
    if (dragging) {
      dragging = false;
      track.style.transition = '';
      goTo(currentIndex);
    }
  });

  /* keyboard navigation */
  block.setAttribute('tabindex', '0');
  block.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') goTo(currentIndex - 1);
    if (e.key === 'ArrowRight') goTo(currentIndex + 1);
  });

  /* initialise */
  goTo(0);
}
