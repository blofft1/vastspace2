import {
  buildBlock,
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
  loadScript,
  getMetadata,
  sampleRUM,
  toCamelCase,
  toClassName,
} from './aem.js';

/**
 * Audience definitions for experimentation.
 */
const AUDIENCES = {
  mobile: () => window.innerWidth < 600,
  desktop: () => window.innerWidth >= 600,
};

/**
 * Returns all metadata properties that match the given prefix.
 * @param {string} prefix The meta tag prefix
 * @returns {object} An object with the matching metadata key/value pairs
 */
function getAllMetadata(prefix) {
  return [...document.head.querySelectorAll(`meta[name^="${prefix}-"],meta[property^="${prefix}:"]`)]
    .reduce((res, meta) => {
      const key = meta.name
        ? meta.name.substring(prefix.length + 1)
        : meta.getAttribute('property').substring(prefix.length + 1);
      res[key] = meta.content;
      return res;
    }, {});
}

/**
 * Builds hero block and prepends to main in a new section.
 * @param {Element} main The container element
 */
function buildHeroBlock(main) {
  const h1 = main.querySelector('h1');
  const picture = main.querySelector('picture');
  // eslint-disable-next-line no-bitwise
  if (h1 && picture && (h1.compareDocumentPosition(picture) & Node.DOCUMENT_POSITION_PRECEDING)) {
    // Check if h1 or picture is already inside a hero block
    if (h1.closest('.hero') || picture.closest('.hero')) {
      return; // Don't create a duplicate hero block
    }
    const section = document.createElement('div');
    section.append(buildBlock('hero', { elems: [picture, h1] }));
    main.prepend(section);
  }
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }

    buildHeroBlock(main);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

/**
 * Processes a page-metadata block, converting its entries into <meta> tags
 * in the document head and removing the block from the DOM.
 * @param {Element} main The main element
 */
function decoratePageMetadata(main) {
  const block = main.querySelector('.page-metadata');
  if (!block) return;
  [...block.children].forEach((row) => {
    const [keyEl, valueEl] = [...row.children];
    if (!keyEl || !valueEl) return;
    const name = keyEl.textContent.trim().toLowerCase();
    const content = valueEl.textContent.trim();
    if (name && content) {
      const meta = document.createElement('meta');
      meta.name = name;
      meta.content = content;
      document.head.appendChild(meta);
    }
  });
  block.closest('.section')?.remove();
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  decoratePageMetadata(main);
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
}

/**
 * Returns the innermost main element (handles nested mains from local dev server).
 * @param {Element} doc The document or container
 * @returns {Element|null} The main element with content
 */
function getMain(doc) {
  let main = doc.querySelector('main');
  const inner = main && main.querySelector(':scope > main');
  if (inner) main = inner;
  return main;
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();

  // Process page-metadata before experimentation so meta tags are available
  const main = getMain(doc);
  if (main) decoratePageMetadata(main);

  // Experimentation plugin: eager phase
  const experimentationMetadata = getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length;
  if (experimentationMetadata) {
    try {
      // eslint-disable-next-line import/no-unresolved, import/no-relative-packages
      const { loadEager: runEager } = await import('../plugins/experimentation/src/index.js');
      await runEager(document, {
        audiences: AUDIENCES,
      }, {
        getAllMetadata,
        getMetadata,
        loadCSS,
        loadScript,
        sampleRUM,
        toCamelCase,
        toClassName,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Experimentation plugin failed', e);
    }
  }

  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  loadHeader(doc.querySelector('header'));

  const main = getMain(doc);
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();

  // Experimentation plugin: lazy phase
  if (getMetadata('experiment')
    || Object.keys(getAllMetadata('campaign')).length
    || Object.keys(getAllMetadata('audience')).length) {
    // eslint-disable-next-line import/no-unresolved, import/no-relative-packages
    const { loadLazy: runLazy } = await import('../plugins/experimentation/src/index.js');
    await runLazy(document, {
      audiences: AUDIENCES,
    }, {
      getAllMetadata,
      getMetadata,
      loadCSS,
      loadScript,
      sampleRUM,
      toCamelCase,
      toClassName,
    });
  }
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();
