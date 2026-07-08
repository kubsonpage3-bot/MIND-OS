import React, { createContext, useState, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { queryClientInstance } from '@/lib/query-client';

/**
 * @typedef {Object} DjangoAuthContextValue
 * @property {any} user
 * @property {any} profile
 * @property {boolean} isAuthenticated
 * @property {boolean} isLoading
 * @property {any} error
 * @property {Function} login
 * @property {Function} register
 * @property {Function} guestLogin
 * @property {Function} convertGuest
 * @property {Function} logout
 * @property {Function} refreshProfile
 */

/** @type {React.Context<DjangoAuthContextValue | null>} */
const DjangoAuthContext = createContext(null);

export const DjangoAuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('access_token');
  });
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  // useQuery to manage user profile
  const { 
    data: profile, 
    refetch: refreshProfile, 
    isLoading: isProfileLoading,
  } = useQuery({
    queryKey: ['userprofile'],
    queryFn: djangoApi.profile.get,
    enabled: isAuthenticated,
    retry: false,
  });

  const isLoading = isAuthenticated && isProfileLoading;

  useEffect(() => {
    if (profile) {
      setUser({ username: profile.username || 'Hero' });
      
      // Auto-detect and sync timezone if it differs from the backend
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (profile.timezone !== clientTz) {
        djangoApi.profile.update({ timezone: clientTz })
          .then(() => {
            // Optimistically update the cache to avoid re-triggering this effect
            queryClientInstance.setQueryData(['userprofile'], old => ({ ...old, timezone: clientTz }));
          })
          .catch(e => console.warn('Failed to auto-update timezone', e));
      }
    }
  }, [profile]);

  useEffect(() => {
    const handleLogoutEvent = () => {
      setUser(null);
      setIsAuthenticated(false);
      queryClientInstance.clear();
    };

    window.addEventListener('django-auth-logout', handleLogoutEvent);
    return () => window.removeEventListener('django-auth-logout', handleLogoutEvent);
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const tokenData = await djangoApi.auth.login(username, password);
      localStorage.setItem('access_token', tokenData.access);
      localStorage.setItem('refresh_token', tokenData.refresh);
      setIsAuthenticated(true);

      const profileData = await queryClientInstance.fetchQuery({
        queryKey: ['userprofile'],
        queryFn: djangoApi.profile.get,
      });
      setUser({ username: profileData.username || 'Hero' });
      return profileData;
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid username or password');
      throw err;
    }
  };

  const register = async (username, email, password, password2) => {
    setError(null);
    try {
      await djangoApi.auth.register(username, email, password, password2);
      return await login(username, password);
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Registration failed');
      throw err;
    }
  };

  const logout = async () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setIsAuthenticated(false);
    queryClientInstance.clear();
  };

  const generateUUID = () => {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  };

  const generateRandomSecret = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  };

  const guestLogin = async () => {
    setError(null);
    try {
      let guestId = localStorage.getItem('guest_id');
      let guestSecret = localStorage.getItem('guest_secret');

      if (!guestId || !guestSecret) {
        guestId = `guest_${generateUUID()}`;
        guestSecret = generateRandomSecret();
        localStorage.setItem('guest_id', guestId);
        localStorage.setItem('guest_secret', guestSecret);
      }

      const tokenData = await djangoApi.auth.guestLogin(guestId, guestSecret);
      localStorage.setItem('access_token', tokenData.access);
      localStorage.setItem('refresh_token', tokenData.refresh);
      setIsAuthenticated(true);

      const profileData = await queryClientInstance.fetchQuery({
        queryKey: ['userprofile'],
        queryFn: djangoApi.profile.get,
      });
      setUser({ username: profileData.username || 'Hero' });
      return profileData;
    } catch (err) {
      console.error('Guest login failed:', err);
      setError(err.message || 'Guest login failed');
      throw err;
    }
  };

  const convertGuest = async (username, email, password, password2) => {
    setError(null);
    try {
      const tokenData = await djangoApi.auth.convertGuest(username, email, password, password2);
      localStorage.setItem('access_token', tokenData.access);
      localStorage.setItem('refresh_token', tokenData.refresh);
      
      // Clear guest credentials from localStorage
      localStorage.removeItem('guest_id');
      localStorage.removeItem('guest_secret');
      
      const profileData = await queryClientInstance.fetchQuery({
        queryKey: ['userprofile'],
        queryFn: djangoApi.profile.get,
      });
      setUser({ username: profileData.username || 'Hero' });
      return profileData;
    } catch (err) {
      console.error('Guest conversion failed:', err);
      setError(err.message || 'Conversion failed');
      throw err;
    }
  };

  return (
    <DjangoAuthContext.Provider value={{
      user,
      profile: profile || null,
      isAuthenticated,
      isLoading,
      error,
      login,
      register,
      guestLogin,
      convertGuest,
      logout,
      refreshProfile,
    }}>
      {children}
    </DjangoAuthContext.Provider>
  );
};

/**
 * @returns {DjangoAuthContextValue}
 */
export const useDjangoAuth = () => {
  const context = useContext(DjangoAuthContext);
  if (!context) {
    throw new Error('useDjangoAuth must be used within a DjangoAuthProvider');
  }
  return context;
};
