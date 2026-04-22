const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const fetchWithAuth = async (url, options = {}) => {
  const token = localStorage.getItem('assetaura_token');
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
  
  const res = await fetch(url, { ...options, headers });
  
  // Auto-logout on token expiration
  if (res.status === 401) {
    localStorage.removeItem('assetaura_token');
    window.dispatchEvent(new Event('auth_expired'));
  }
  
  return res;
};

// ─── Auth APIs ────────────────────────────────────────────────

export const registerUser = async (username, password) => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Registration failed');
  }
  return res.json();
};

export const loginUser = async (username, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Login failed');
  }
  return res.json();
};

export const changePassword = async (currentPassword, newPassword) => {
  const res = await fetchWithAuth(`${API_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to change password');
  }
  return res.json();
};
/**
 * Fetch the portfolio summary (enriched assets and total net worth)
 */
export const fetchPortfolioSummary = async () => {
  const res = await fetchWithAuth(`${API_URL}/portfolio`);
  if (!res.ok) throw new Error('Failed to fetch portfolio summary');
  return res.json();
};

/**
 * Fetch the cached portfolio (instant, no live price fetching)
 */
export const fetchCachedPortfolio = async () => {
  const res = await fetchWithAuth(`${API_URL}/portfolio/cached`);
  if (!res.ok) throw new Error('Failed to fetch cached portfolio');
  return res.json();
};

/**
 * Fetch historical portfolio snapshots
 */
export const fetchPortfolioHistory = async () => {
  const res = await fetchWithAuth(`${API_URL}/history`);
  if (!res.ok) throw new Error('Failed to fetch portfolio history');
  return res.json();
};

/**
 * Fetch all application settings
 */
export const fetchSettings = async () => {
  const res = await fetchWithAuth(`${API_URL}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

/**
 * Update a specific setting
 */
export const updateSetting = async (key, value) => {
  const res = await fetchWithAuth(`${API_URL}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value })
  });
  if (!res.ok) throw new Error(`Failed to update setting: ${key}`);
  return res.json();
};

/**
 * Manually add or update a holding units/price
 */
export const addOrUpdateHolding = async (payload) => {
  const res = await fetchWithAuth(`${API_URL}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Failed to update holding');
  }
  return res.json();
};

/**
 * Handle individual broker imports (form-data/file)
 */
export const importBrokerFile = async (broker, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithAuth(`${API_URL}/import/${broker}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || `Failed to import from ${broker}`);
  }
  return res.json();
};

/**
 * Search for ticker symbols using external APIs (via backend)
 */
export const searchSymbols = async (query, type) => {
  const res = await fetchWithAuth(`${API_URL}/search-symbols?q=${encodeURIComponent(query)}&type=${type}`);
  if (!res.ok) throw new Error('Failed to search symbols');
  return res.json();
};

/**
 * Validate a ticker and fetch its current price
 */
export const validateTicker = async (ticker, type, currency) => {
  const params = new URLSearchParams({ ticker, type, currency: currency || 'USD' });
  const res = await fetchWithAuth(`${API_URL}/validate-ticker?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to validate ticker');
  return res.json();
};

/**
 * Management: Apply a suggested name to an asset
 */
export const applySuggestion = async (id) => {
  const res = await fetchWithAuth(`${API_URL}/assets/${id}/apply-suggestion`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to apply suggestion');
  return res.json();
};

/**
 * Management: Ignore a suggested name for an asset
 */
export const ignoreSuggestion = async (id) => {
  const res = await fetchWithAuth(`${API_URL}/assets/${id}/ignore-suggestion`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to ignore suggestion');
  return res.json();
};

/**
 * Bulk: Trigger enrichment for all equity assets
 */
export const bulkEnrichAssets = async () => {
  const res = await fetchWithAuth(`${API_URL}/assets/bulk-enrich`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start bulk enrichment');
  return res.json();
};
