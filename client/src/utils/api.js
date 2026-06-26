const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'include',
    ...options,
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);
  const data = await res.json();

  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  register: (body) => request('/api/auth/register', { method: 'POST', body }),
  login: (body) => request('/api/auth/login', { method: 'POST', body }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  updateProfile: (body) => request('/api/auth/me', { method: 'PATCH', body }),

  getBoards: () => request('/api/boards'),
  createBoard: (body) => request('/api/boards', { method: 'POST', body }),
  getBoard: (id) => request(`/api/boards/${id}/full`),
  updateBoard: (id, body) => request(`/api/boards/${id}`, { method: 'PATCH', body }),
  deleteBoard: (id) => request(`/api/boards/${id}`, { method: 'DELETE' }),
  addMember: (boardId, body) => request(`/api/boards/${boardId}/members`, { method: 'POST', body }),

  createColumn: (boardId, body) => request(`/api/boards/${boardId}/columns`, { method: 'POST', body }),
  updateColumn: (boardId, colId, body) => request(`/api/boards/${boardId}/columns/${colId}`, { method: 'PATCH', body }),
  deleteColumn: (boardId, colId) => request(`/api/boards/${boardId}/columns/${colId}`, { method: 'DELETE' }),
  reorderColumns: (boardId, body) => request(`/api/boards/${boardId}/columns-reorder`, { method: 'PATCH', body }),

  createCard: (boardId, body) => request(`/api/boards/${boardId}/cards`, { method: 'POST', body }),
  getCard: (boardId, cardId) => request(`/api/boards/${boardId}/cards/${cardId}`),
  updateCard: (boardId, cardId, body) => request(`/api/boards/${boardId}/cards/${cardId}`, { method: 'PATCH', body }),
  moveCard: (boardId, cardId, body) => request(`/api/boards/${boardId}/cards/${cardId}/move`, { method: 'PATCH', body }),
  deleteCard: (boardId, cardId) => request(`/api/boards/${boardId}/cards/${cardId}`, { method: 'DELETE' }),

  getLabels: (boardId) => request(`/api/boards/${boardId}/labels`),
  createLabel: (boardId, body) => request(`/api/boards/${boardId}/labels`, { method: 'POST', body }),
  deleteLabel: (boardId, labelId) => request(`/api/boards/${boardId}/labels/${labelId}`, { method: 'DELETE' }),

  getComments: (cardId) => request(`/api/cards/${cardId}/comments`),
  addComment: (cardId, body) => request(`/api/cards/${cardId}/comments`, { method: 'POST', body }),
  deleteComment: (cardId, commentId) => request(`/api/cards/${cardId}/comments/${commentId}`, { method: 'DELETE' }),

  previewImport: (boardId, body) => request(`/api/boards/${boardId}/github-import/preview`, { method: 'POST', body }),
  importIssues: (boardId, body) => request(`/api/boards/${boardId}/github-import`, { method: 'POST', body }),

  getInsights: (boardId) => request(`/api/boards/${boardId}/ai/insights`),
  updateInsight: (boardId, insightId, body) => request(`/api/boards/${boardId}/ai/insights/${insightId}`, { method: 'PATCH', body }),
  runAI: (boardId) => request(`/api/boards/${boardId}/ai/run`, { method: 'POST' }),
  getDigests: (boardId) => request(`/api/boards/${boardId}/ai/digest`),
  getTeamStats: (boardId) => request(`/api/boards/${boardId}/team-stats`),
};

export default api;
