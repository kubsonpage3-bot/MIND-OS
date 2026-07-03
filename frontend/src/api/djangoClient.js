export const API_ORIGIN = 'https://mind-os-d5sk.onrender.com';
const BASE_URL = 'https://mind-os-d5sk.onrender.com/api';

/**
 * Converts a potentially relative media/static path from the backend
 * into an absolute URL pointing to the Render backend.
 * Safe to call with already-absolute URLs.
 */
export function getMediaUrl(path) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Serve static assets directly from the frontend's public directory
  if (path.startsWith('/static/')) {
    return path;
  }

  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

function apiUrl(endpoint) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${path}`;
}

// Keeps track of whether a refresh operation is currently in progress
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token) {
  refreshSubscribers.map((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Main Fetch wrapper that automatically appends JWT tokens and handles refreshes.
 * Includes retry logic for Render cold start (502/503/504).
 */
export async function djangoFetch(endpoint, options = {}) {
  const url = apiUrl(endpoint);

  // 1. Attach authorization header if token is present
  const accessToken = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const fetchOptions = { ...options, headers };

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000];
  const COLD_START_CODES = [502, 503, 504];
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);

      // 2. If unauthorized, attempt token refresh
      if (response.status === 401 && !endpoint.includes('auth/token')) {
        return handleUnauthorized(endpoint, options);
      }

      // Cold start retry
      if (COLD_START_CODES.includes(response.status) && attempt < MAX_RETRIES) {
        if (attempt === 0) {
          window.dispatchEvent(new CustomEvent('mindos-server-waking'));
        }
        await new Promise(res => setTimeout(res, RETRY_DELAYS[attempt]));
        continue;
      }

      // Notify that server is back up (if we were retrying)
      if (attempt > 0) {
        window.dispatchEvent(new CustomEvent('mindos-server-ready'));
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          message: errorData.detail || errorData.message || 'Request failed',
          data: errorData,
        };
      }

      // Return JSON if present, otherwise empty object/text
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();

        // Intercept unlocked achievements and broadcast them globally
        if (data?.newly_unlocked_achievements?.length > 0) {
          window.dispatchEvent(new CustomEvent('mindos-achievements-unlocked', { detail: data.newly_unlocked_achievements }));
        }

        // Intercept death and broadcast it globally
        if (data?.is_dead) {
          window.dispatchEvent(new CustomEvent('mindos-death'));
        }

        return data;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && error?.status && COLD_START_CODES.includes(error.status)) {
        await new Promise(res => setTimeout(res, RETRY_DELAYS[attempt]));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

/**
 * Handle 401 errors by attempting to obtain a new Access Token using the Refresh Token.
 */
async function handleUnauthorized(endpoint, options) {
  if (isRefreshing) {
    // Wait for the active refresh to finish
    return new Promise((resolve) => {
      subscribeTokenRefresh((newToken) => {
        const newOptions = {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`,
          },
        };
        resolve(djangoFetch(endpoint, newOptions));
      });
    });
  }

  isRefreshing = true;

  try {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Perform refresh request
    const response = await fetch(apiUrl('/auth/token/refresh/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh token is invalid or expired');
    }

    const data = await response.json();
    localStorage.setItem('access_token', data.access);
    if (data.refresh) {
      localStorage.setItem('refresh_token', data.refresh);
    }

    isRefreshing = false;
    onRefreshed(data.access);

    // Retry the original request with the new access token
    const newOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${data.access}`,
      },
    };
    return djangoFetch(endpoint, newOptions);
  } catch (error) {
    isRefreshing = false;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.setItem('mindos_session_expired', 'true');
    // Dispatch custom event so the UI knows to redirect to login
    window.dispatchEvent(new CustomEvent('django-auth-logout'));
    throw {
      status: 401,
      message: 'Session expired. Please log in again.',
      data: error,
    };
  }
}

// Django API endpoints
export const djangoApi = {
  auth: {
    login: (username, password) =>
      djangoFetch('/auth/token/', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),

    register: (username, email, password, password2) =>
      djangoFetch('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, password2 }),
      }),

    verifyToken: (token) =>
      djangoFetch('/auth/token/verify/', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
  },

  profile: {
    get: () => djangoFetch('/profile/'),
    update: (data) =>
      djangoFetch('/profile/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    prestige: () =>
      djangoFetch('/profile/prestige/', {
        method: 'POST',
      }),

    reset: (resetType) =>
      djangoFetch('/profile/reset/', {
        method: 'POST',
        body: JSON.stringify({ reset_type: resetType }),
      }),
  },

  rival: {
    get: () => djangoFetch('/rival/'),
  },

  tasks: {
    list: (filters = {}) => {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          queryParams.append(key, val);
        }
      });
      const queryString = queryParams.toString();
      return djangoFetch(`/tasks/${queryString ? `?${queryString}` : ''}`);
    },

    get: (id) => djangoFetch(`/tasks/${id}/`),

    create: (taskData) =>
      djangoFetch('/tasks/', {
        method: 'POST',
        body: JSON.stringify(taskData),
      }),

    update: (id, taskData) =>
      djangoFetch(`/tasks/${id}/`, {
        method: 'PATCH',
        body: JSON.stringify(taskData),
      }),

    delete: (id) =>
      djangoFetch(`/tasks/${id}/`, {
        method: 'DELETE',
      }),

    complete: (id, isPositive = true) =>
      djangoFetch(`/tasks/${id}/complete/`, {
        method: 'POST',
        body: JSON.stringify({ is_positive: isPositive }),
      }),

    toggle: (id) =>
      djangoFetch(`/tasks/${id}/toggle/`, {
        method: 'POST',
      }),

    processMissed: () => djangoFetch('/tasks/process-missed/', { method: 'POST' })
  },

  skills: {
    activate: (skillId) =>
      djangoFetch('/skills/activate/', {
        method: 'POST',
        body: JSON.stringify({ skill_id: skillId }),
      }),

    getActiveEffects: () =>
      djangoFetch('/skills/active-effects/'),

    buy: (skillCode) =>
      djangoFetch('/skills/buy/', {
        method: 'POST',
        body: JSON.stringify({ skill_code: skillCode }),
      }),

    respec: () => djangoFetch('/skills/respec/', { method: 'POST' }),
  },

  allies: {
    recruit: (allyCode) =>
      djangoFetch('/allies/recruit/', {
        method: 'POST',
        body: JSON.stringify({ ally_code: allyCode }),
      }),
  },

  inventory: {
    equip: (id) => djangoFetch(`/inventory/${id}/equip/`, { method: 'POST' }),
  },

  shop: {
    getItems: () => djangoFetch('/shop/items/'),
    buy: (itemId) =>
      djangoFetch('/shop/buy/', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId }),
      }),
    sell: (itemId, quantity = 1) =>
      djangoFetch('/shop/sell/', {
        method: 'POST',
        body: JSON.stringify({ item_id: itemId, quantity }),
      }),
  },

  combat: {
    getBosses: () => djangoFetch('/combat/bosses/'),
    getEncounters: () => djangoFetch('/combat/encounters/'),
    summon: (bossId, cost) =>
      djangoFetch('/combat/summon/', {
        method: 'POST',
        body: JSON.stringify({ boss_id: bossId, cost }),
      }),
    sync: (data) =>
      djangoFetch('/combat/sync/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  training: {
    getLog: () => djangoFetch('/training/log/'),
    log: (data) =>
      djangoFetch('/training/log/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  party: {
    members: () => djangoFetch('/party/members/'),
    create: (name) =>
      djangoFetch('/party/create/', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    join: (invite_code) =>
      djangoFetch('/party/join/', {
        method: 'POST',
        body: JSON.stringify({ invite_code }),
      }),
    leave: () => djangoFetch('/party/leave/', { method: 'POST' }),
  },
};
