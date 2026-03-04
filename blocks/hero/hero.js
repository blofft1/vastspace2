/**
 * Checks if a URL points to a video file.
 * @param {string} url The URL to check
 * @returns {boolean} True if the URL is a video file
 */
function isVideoUrl(url) {
  try {
    const { pathname } = new URL(url, window.location.href);
    return /\.(mp4|webm|ogg)$/i.test(pathname);
  } catch {
    return false;
  }
}

/**
 * Creates a video element for background playback.
 * @param {string} src The video source URL
 * @param {HTMLPictureElement} poster Optional poster picture element
 * @returns {HTMLVideoElement} The video element
 */
function createVideoBackground(src, poster) {
  const video = document.createElement('video');
  video.classList.add('hero-video');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.setAttribute('loop', '');
  video.setAttribute('playsinline', '');
  video.muted = true;

  if (poster) {
    const img = poster.querySelector('img');
    if (img) video.setAttribute('poster', img.src);
  }

  const source = document.createElement('source');
  source.setAttribute('src', src);
  source.setAttribute('type', `video/${src.split('.').pop().split('?')[0]}`);
  video.append(source);

  return video;
}

/**
 * Loads and decorates the hero block.
 * @param {Element} block The hero block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (rows.length === 0) return;

  // Determine if first row contains media (image/video)
  const firstRow = rows[0];
  const link = firstRow.querySelector('a[href]');
  const picture = firstRow.querySelector('picture');
  let hasVideo = false;

  if (link && isVideoUrl(link.href)) {
    // Video hero: link to video wrapping or near a poster image
    const video = createVideoBackground(link.href, picture);
    const mediaContainer = document.createElement('div');
    mediaContainer.classList.add('hero-media');

    if (picture) {
      // Keep picture as fallback behind the video
      mediaContainer.append(picture);
    }
    mediaContainer.append(video);

    // Replace first row content with the media container
    firstRow.textContent = '';
    firstRow.append(mediaContainer);
    hasVideo = true;
  } else if (picture) {
    // Image-only hero: move picture into a media container
    const mediaContainer = document.createElement('div');
    mediaContainer.classList.add('hero-media');
    mediaContainer.append(picture);
    firstRow.textContent = '';
    firstRow.append(mediaContainer);
  }

  // Process text overlay from second row (if exists)
  if (rows.length > 1) {
    const textRow = rows[1];
    textRow.classList.add('hero-overlay');
  }

  // Add video class to the block if video is present
  if (hasVideo) {
    block.classList.add('hero-video-bg');
  }
}
