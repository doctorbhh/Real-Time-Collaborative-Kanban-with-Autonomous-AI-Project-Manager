const API_BASE = 'http://localhost:3000';


const viewLogin = document.getElementById('view-login');
const viewForm = document.getElementById('view-form');
const viewSuccess = document.getElementById('view-success');


const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const referenceUrlInput = document.getElementById('reference-url');
const boardSelect = document.getElementById('board-select');
const columnSelect = document.getElementById('column-select');


const loginError = document.getElementById('login-error');
const titleError = document.getElementById('title-error');
const createError = document.getElementById('create-error');


const btnLogin = document.getElementById('btn-login');
const btnLogout = document.getElementById('btn-logout');
const btnCreate = document.getElementById('btn-create');
const btnClipAnother = document.getElementById('btn-clip-another');
const btnOpenBoard = document.getElementById('btn-open-board');
const btnThemeList = document.querySelectorAll('.btn-theme');


let allBoards = [];


function getPageContent() {
  const selectedText = window.getSelection()?.toString()?.trim() ?? '';
  const pageTitle = document.title;
  const pageUrl = window.location.href;
  const metaDescription = document.querySelector('meta[name="description"]')?.content ?? '';

  return {
    selectedText,
    pageTitle,
    pageUrl,
    metaDescription,
    hasSelection: selectedText.length > 0,
  };
}

function showView(view) {
  viewLogin.classList.add('hidden');
  viewForm.classList.add('hidden');
  viewSuccess.classList.add('hidden');
  view.classList.remove('hidden');
}


document.addEventListener('DOMContentLoaded', async () => {
  await loadTheme();
  await checkAuth();
});


const SUN_ICON = `<svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const MOON_ICON = `<svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

async function loadTheme() {
  const { theme } = await chrome.storage.local.get('theme');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    btnThemeList.forEach(btn => btn.innerHTML = MOON_ICON);
  } else {
    btnThemeList.forEach(btn => btn.innerHTML = SUN_ICON);
  }
}

btnThemeList.forEach(btn => {
  btn.addEventListener('click', async () => {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.removeAttribute('data-theme');
      btnThemeList.forEach(b => b.innerHTML = SUN_ICON);
      await chrome.storage.local.set({ theme: 'dark' });
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      btnThemeList.forEach(b => b.innerHTML = MOON_ICON);
      await chrome.storage.local.set({ theme: 'light' });
    }
  });
});


async function checkAuth() {
  const { token, user } = await chrome.storage.local.get(['token', 'user']);

  if (token) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        await initializeForm(data.user);
        return;
      }
    } catch (e) {
      console.error('Failed to verify token', e);
    }

    await chrome.storage.local.remove(['token', 'user']);
  }

  showView(viewLogin);
}

btnLogin.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Please enter email and password';
    loginError.classList.remove('hidden');
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Signing in...';
  loginError.classList.add('hidden');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      loginError.textContent = 'Invalid email or password';
      loginError.classList.remove('hidden');
      return;
    }

    const data = await res.json();
    const user = data.user;
    const token = user.apiKey;
    await chrome.storage.local.set({ token, user });
    await initializeForm(user);
  } catch (err) {
    loginError.textContent = 'Could not reach server';
    loginError.classList.remove('hidden');
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Sign in';
  }
});

btnLogout.addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'user']);
  showView(viewLogin);
});


async function initializeForm(user) {
  document.getElementById('user-name').textContent = user.name;
  showView(viewForm);

  await loadBoards();
  await preFillContent();
}

async function loadBoards() {
  const { token } = await chrome.storage.local.get('token');

  try {
    const res = await fetch(`${API_BASE}/api/boards`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error('Failed to fetch boards');

    const data = await res.json();
    allBoards = data.boards || [];

    boardSelect.innerHTML = '';
    if (allBoards.length === 0) {
      boardSelect.innerHTML = '<option disabled>No boards found</option>';
      return;
    }

    allBoards.forEach(board => {
      const option = document.createElement('option');
      option.value = board.id;
      option.textContent = board.name;
      boardSelect.appendChild(option);
    });


    const { lastBoardId } = await chrome.storage.local.get('lastBoardId');
    if (lastBoardId && allBoards.find(b => b.id === lastBoardId)) {
      boardSelect.value = lastBoardId;
    }

    await loadColumns(boardSelect.value);
  } catch (err) {
    console.error('Error loading boards', err);
  }
}

async function loadColumns(boardId) {
  columnSelect.innerHTML = '<option value="" disabled selected>Loading...</option>';

  const board = allBoards.find(b => b.id === boardId);

  columnSelect.innerHTML = '';
  if (!board || !board.columns || board.columns.length === 0) {
    columnSelect.innerHTML = '<option disabled>No columns found</option>';
    return;
  }

  board.columns.forEach(col => {
    const option = document.createElement('option');
    option.value = col.id;
    option.textContent = col.name;
    columnSelect.appendChild(option);
  });

  const { lastColumnId } = await chrome.storage.local.get('lastColumnId');
  if (lastColumnId && board.columns.find(c => c.id === lastColumnId)) {
    columnSelect.value = lastColumnId;
  }
}

boardSelect.addEventListener('change', async (e) => {
  await loadColumns(e.target.value);
});

async function getContentFromTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const fallback = {
    pageTitle: tab.title ?? '',
    pageUrl: tab.url ?? '',
    selectedText: '',
    hasSelection: false
  };

  if (!tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    return fallback;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: getPageContent,
    });
    return results[0]?.result ?? fallback;
  } catch (err) {
    console.warn('Script injection failed:', err);
    return fallback;
  }
}

async function preFillContent() {
  const content = await getContentFromTab();

  if (content.hasSelection && content.selectedText.length > 0) {

    const lines = content.selectedText.split('\n').filter(l => l.trim().length > 0);
    const firstLine = lines.length > 0 ? lines[0].trim() : '';
    const suggestedTitle = firstLine.length > 60
      ? firstLine.slice(0, 60) + '...'
      : firstLine;

    titleInput.value = suggestedTitle;

    let descriptionText = content.selectedText;
    if (descriptionText.length > 5000) {
      descriptionText = descriptionText.slice(0, 5000) + '\n\n*(truncated — full text at reference URL)*';
    }

    descriptionInput.value = descriptionText;
  } else {

    titleInput.value = content.pageTitle.length > 200 ? content.pageTitle.slice(0, 200) + '...' : content.pageTitle;
    descriptionInput.value = content.metaDescription || '';
  }

  referenceUrlInput.value = content.pageUrl.startsWith('javascript:') ? '' : content.pageUrl;
}


btnCreate.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const description = descriptionInput.value.trim();
  const referenceUrl = referenceUrlInput.value.trim();
  const columnId = columnSelect.value;
  const boardId = boardSelect.value;

  if (!title) {
    titleError.textContent = 'Title is required';
    titleError.classList.remove('hidden');
    return;
  }
  if (!columnId) {
    createError.textContent = 'Please select a column';
    createError.classList.remove('hidden');
    return;
  }

  titleError.classList.add('hidden');
  createError.classList.add('hidden');
  btnCreate.disabled = true;
  btnCreate.textContent = 'Creating...';

  const { token } = await chrome.storage.local.get('token');

  try {
    const res = await fetch(`${API_BASE}/api/boards/${boardId}/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        columnId,
        title,
        description: description || undefined,
        referenceUrl: referenceUrl || undefined,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      createError.textContent = err.error || 'Failed to create card';
      createError.classList.remove('hidden');
      return;
    }

    const card = await res.json();

    await chrome.storage.local.set({ lastBoardId: boardId, lastColumnId: columnId });

    const boardName = allBoards.find(b => b.id === boardId)?.name || 'Board';
    const columnName = columnSelect.options[columnSelect.selectedIndex]?.text || 'Column';

    document.getElementById('success-message').textContent = `"${card.title}" added to ${columnName} on ${boardName}`;
    showView(viewSuccess);

  } catch (err) {
    createError.textContent = 'Could not reach the server. Check your connection.';
    createError.classList.remove('hidden');
  } finally {
    btnCreate.disabled = false;
    btnCreate.textContent = 'Create Card';
  }
});

btnClipAnother.addEventListener('click', async () => {
  titleInput.value = '';
  descriptionInput.value = '';
  referenceUrlInput.value = '';
  await preFillContent();
  showView(viewForm);
});

btnOpenBoard.addEventListener('click', () => {
  const boardId = boardSelect.value;

  const clientBase = API_BASE.includes('localhost') ? 'http://localhost:5173' : API_BASE;
  chrome.tabs.create({ url: `${clientBase}/board/${boardId}` });
});
