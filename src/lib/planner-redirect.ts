'use client';

export const redirectPlannerToWeightUpdate = () => {
  if (typeof window === 'undefined') return; // Server-side check
  
  try {
    const userRole = localStorage.getItem('user_role');
    
    if (userRole?.toLowerCase() === 'planner') {
      const currentPath = window.location.pathname;
      if (currentPath !== '/weight-update') {
        window.location.href = '/weight-update';
      }
    }
  } catch (error) {
    console.error('Error checking user role:', error);
  }
};

export const isPlannerRole = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const userRole = localStorage.getItem('user_role');
    return userRole?.toLowerCase() === 'planner';
  } catch (error) {
    return false;
  }
};