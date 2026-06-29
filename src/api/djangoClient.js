export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || 
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

const BASE_URL = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? `${API_ORIGIN}/api` : '/api');

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

  const fetchOptions = {
    ...options,
    headers,
  };

  console.log("--> API URL Ð² Ñ€Ð°Ð±Ð¾Ñ‚Ðµ:", url);

  try {
    const response = await fetch(url, fetchOptions);

    // 2. If unauthorized, attempt token refresh
    if (response.status === 401 && !endpoint.includes('auth/token')) {
      return handleUnauthorized(endpoint, options);
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
      if (data?.unlocked_achievements?.length > 0) {
        window.dispatchEvent(new CustomEvent("mindos-achievements-unlocked", { detail: data.unlocked_achievements }));
      }
      
      // Intercept death and broadcast it globally
      if (data?.is_dead) {
        window.dispatchEvent(new CustomEvent("mindos-death"));
      }
      
      return data;
    }
    return await response.text();
  } catch (error) {
    throw error;
  }
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
    buy: (data) =>
      djangoFetch('/shop/buy/', {
        method: 'POST',
        body: JSON.stringify({ item_id: data.item_id }),
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
    log: (data) =>
      djangoFetch('/training/log/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
