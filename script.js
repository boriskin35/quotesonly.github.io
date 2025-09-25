// script.js
document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const quoteTextElement = document.getElementById('quote-text');
  const quoteAuthorElement = document.getElementById('quote-author');
  const nextQuoteBtn = document.getElementById('next-quote-btn');
  const copyQuoteBtn = document.getElementById('copy-quote-btn');
  const shareQuoteBtn = document.getElementById('share-quote-btn');
  const quoteContent = document.querySelector('.quote-content');
  const loader = document.querySelector('.loading-indicator');
  const quoteWrapper = document.querySelector('.quote-wrapper');

  // --- Constants ---
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours
  const CHUNK_SIZE = 50;
  const STORAGE_KEY = 'quotesSession';

  // --- State ---
  let allQuotes = [];
  let session = {};
  let isAnimating = false;
  let isLoadSuccess = false;

  // --- Utilities ---
  const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const formatInnerQuotes = (text) => {
    if (!text) return '';
    let isOpening = true;
    return text.replace(/"/g, () => {
      const mark = isOpening ? '„' : '“';
      isOpening = !isOpening;
      return mark;
    });
  };

  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const saveSession = () => {
    const { allChunks, ...sessionToSave } = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionToSave));
  };

  const loadSession = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  };

  // --- Core Logic ---
  const startNewSession = () => {
    const quoteChunks = chunkArray(allQuotes, CHUNK_SIZE);
    const chunkIndices = Array.from(quoteChunks.keys());
    session = {
      sessionStartTimestamp: Date.now(),
      shuffledChunkIndices: shuffleArray(chunkIndices),
      currentChunkPointer: 0,
      currentQuotes: [],
      allChunks: quoteChunks
    };
    loadNextChunk();
  };

  const loadNextChunk = () => {
    if (session.currentChunkPointer >= session.shuffledChunkIndices.length) {
      startNewSession();
      return;
    }
    const nextIndex = session.shuffledChunkIndices[session.currentChunkPointer];
    session.currentQuotes = shuffleArray([...session.allChunks[nextIndex]]);
    session.currentChunkPointer++;
    saveSession();
  };

  const displayQuote = () => {
    if (!isLoadSuccess || isAnimating) return;
    isAnimating = true;
    nextQuoteBtn.disabled = true;
    quoteContent.setAttribute('aria-busy', 'true');
    quoteContent.classList.add('fade-out');

    const updateAndFadeIn = () => {
      if (!session.currentQuotes || session.currentQuotes.length === 0) {
        loadNextChunk();
      }
      if (!session.currentQuotes || session.currentQuotes.length === 0) {
        quoteTextElement.textContent = "Не удалось загрузить цитаты. Попробуйте обновить страницу.";
        quoteAuthorElement.textContent = "";
        quoteContent.classList.remove('fade-out');
        setTimeout(() => {
          isAnimating = false;
          nextQuoteBtn.disabled = false;
          quoteContent.setAttribute('aria-busy', 'false');
        }, 500);
        return;
      }
      const quote = session.currentQuotes.pop();
      quoteTextElement.textContent = `«${formatInnerQuotes(quote.quote)}»`;
      quoteAuthorElement.textContent = quote.author ? `— ${quote.author}` : '— Неизвестный автор';
      saveSession();
      quoteContent.classList.remove('fade-out');
      setTimeout(() => {
        isAnimating = false;
        nextQuoteBtn.disabled = false;
        quoteContent.setAttribute('aria-busy', 'false');
      }, 500);
    };

    quoteContent.addEventListener('transitionend', updateAndFadeIn, { once: true });
  };

  const initialize = async () => {
    try {
      const response = await fetch('quotes.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Network response was not ok');
      allQuotes = await response.json();
      if (!Array.isArray(allQuotes) || allQuotes.length === 0) {
        throw new Error("Quotes data is empty or invalid");
      }
      session = loadSession();
      const now = Date.now();
      if (!session || (now - session.sessionStartTimestamp > SESSION_DURATION)) {
        startNewSession();
      } else {
        session.allChunks = chunkArray(allQuotes, CHUNK_SIZE);
      }
      loader.style.display = 'none';
      quoteWrapper.style.display = 'block';
      if (!session.currentQuotes || session.currentQuotes.length === 0) {
        loadNextChunk();
      }
      if (session.currentQuotes && session.currentQuotes.length > 0) {
        const quote = session.currentQuotes.pop();
        quoteTextElement.textContent = `«${formatInnerQuotes(quote.quote)}»`;
        quoteAuthorElement.textContent = quote.author ? `— ${quote.author}` : '— Неизвестный автор';
        saveSession();
      } else {
        throw new Error("Failed to load a valid quote chunk.");
      }
      isLoadSuccess = true;
    } catch (error) {
      console.error('Initialization failed:', error);
      loader.innerHTML = '<p class="error-text" role="alert">Ошибка загрузки цитат.</p>';
      quoteWrapper.style.display = 'none';
    }
  };

  // --- Event Listeners ---
  nextQuoteBtn.addEventListener('click', displayQuote);

  copyQuoteBtn.addEventListener('click', () => {
    const fullQuote = `${quoteTextElement.textContent} ${quoteAuthorElement.textContent}`;
    navigator.clipboard.writeText(fullQuote).then(() => {
      const useElement = copyQuoteBtn.querySelector('use');
      const originalHref = useElement.getAttribute('href');
      useElement.setAttribute('href', '#icon-check');
      copyQuoteBtn.disabled = true;
      copyQuoteBtn.setAttribute('aria-label', 'Цитата скопирована');
      setTimeout(() => {
        useElement.setAttribute('href', originalHref);
        copyQuoteBtn.disabled = false;
        copyQuoteBtn.setAttribute('aria-label', 'Копировать цитату');
      }, 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  });

  shareQuoteBtn.addEventListener('click', () => {
    const fullQuote = `${quoteTextElement.textContent} ${quoteAuthorElement.textContent}`;
    const showFailure = () => {
      const useElement = shareQuoteBtn.querySelector('use');
      const originalHref = useElement.getAttribute('href');
      useElement.setAttribute('href', '#icon-cross');
      shareQuoteBtn.disabled = true;
      shareQuoteBtn.setAttribute('aria-label', 'Не удалось поделиться');
      setTimeout(() => {
        useElement.setAttribute('href', originalHref);
        shareQuoteBtn.disabled = false;
        shareQuoteBtn.setAttribute('aria-label', 'Поделиться цитатой');
      }, 2000);
    };
    if (navigator.share) {
      navigator.share({
        title: 'Цитата для Вдохновения',
        text: fullQuote,
        url: window.location.href
      }).catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
          showFailure();
        }
      });
    } else {
      showFailure();
    }
  });

  // --- Start ---
  initialize();
});
