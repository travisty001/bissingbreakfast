import React from 'react';
import GuestOrderingApp from './GuestOrderingApp';
import AdminDashboard from './AdminDashboard';

export default function App() {
  const path = window.location.pathname.toLowerCase();

  // Serve the kitchen reference when accessing /admin
  if (path.includes('admin') || path.includes('kitchen')) {
    return <AdminDashboard />;
  }

  // Otherwise serve the guest ordering app
  return <GuestOrderingApp />;
}
