'use client';

export const redirectWeightUpdateToWeightUpdate = () => {
  if (typeof window === 'undefined') return; // Server-side check

  try {
    const userRole = localStorage.getItem('user_role');

    if (userRole?.toLowerCase() === 'weight_update') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/weight-update') {
        window.location.href = '/weight-update';
      }
    }
  } catch (error) {
    console.error('Error checking user role:', error);
  }
};

export const isWeightUpdateRole = (): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const userRole = localStorage.getItem('user_role');
    return userRole?.toLowerCase() === 'weight_update';
  } catch (error) {
    return false;
  }
};