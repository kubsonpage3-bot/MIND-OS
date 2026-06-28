import React, { createContext, useState, useContext, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { djangoApi } from '@/api/djangoClient';
import { queryClientInstance } from '@/lib/query-client';

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

  return (
    <DjangoAuthContext.Provider value={{
      user,
      profile: profile || null,
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
