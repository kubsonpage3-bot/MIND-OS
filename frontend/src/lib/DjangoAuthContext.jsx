import React, { createContext, useState, useContext, useEffect } from 'react';
import { djangoApi } from '@/api/djangoClient';

const DjangoAuthContext = createContext(null);

export const DjangoAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const accessToken = localStorage.getItem('access_token');
        if (accessToken) {
          await djangoApi.auth.verifyToken(accessToken);
          const profileData = await djangoApi.profile.get();
          setProfile(profileData);
          setUser({ username: profileData.username || 'Hero' });
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn('Initial session validation failed:', err);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    const handleLogoutEvent = () => {
      setUser(null);
      setProfile(null);
      setIsAuthenticated(false);
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

      const profileData = await djangoApi.profile.get();
      setProfile(profileData);
      setUser({ username });
      setIsAuthenticated(true);
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
    setProfile(null);
    setIsAuthenticated(false);
  };

  const refreshProfile = async () => {
    try {
      const profileData = await djangoApi.profile.get();
      setProfile(profileData);
      return profileData;
    } catch (err) {
      console.error('Failed to refresh profile:', err);
    }
  };

  return (
    <DjangoAuthContext.Provider value={{
      user,
      profile,
      isAuthenticated,
      isLoading,
      error,
      login,
      register,
      logout,
      refreshProfile,
    }}>
      {children}
    </DjangoAuthContext.Provider>
  );
};

export const useDjangoAuth = () => {
  const context = useContext(DjangoAuthContext);
  if (!context) {
    throw new Error('useDjangoAuth must be used within a DjangoAuthProvider');
  }
  return context;
};
