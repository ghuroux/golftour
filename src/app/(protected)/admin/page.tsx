'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { fixMissingArchivedFields } from '@/lib/firebase/firebaseUtils';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // Check if user is authenticated and has admin privileges
  if (auth.loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }

  if (!auth.user) {
    router.push('/login');
    return null;
  }

  // List of admin user IDs - replace with your admin user IDs
  const adminUsers = [
    auth.user.uid, // For testing, include the current user
    // Add other admin user IDs here
  ];

  if (!adminUsers.includes(auth.user.uid)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-4 text-2xl font-bold text-red-600">Access Denied</h1>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  const handleFixMissingFields = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      const { fixedToursCount, fixedRoundsCount } = await fixMissingArchivedFields();
      setResult(`Successfully fixed ${fixedToursCount} tours and ${fixedRoundsCount} rounds with missing isArchived field.`);
    } catch (error) {
      console.error('Error fixing missing fields:', error);
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold text-gray-800">Admin Dashboard</h1>
      
      <div className="mb-8 rounded-xl bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Database Maintenance</h2>
        
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-medium text-gray-700">Fix Missing isArchived Fields</h3>
          <p className="mb-4 text-gray-600">
            This will scan all tours and rounds (quick games) in the database and add the isArchived field
            with a default value of false to any documents that are missing it.
          </p>
          
          <button
            onClick={handleFixMissingFields}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Processing...' : 'Fix Missing Fields'}
          </button>
          
          {result && (
            <div className={`mt-4 rounded-md p-4 ${result.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
              {result}
            </div>
          )}
        </div>
      </div>
      
      <div className="rounded-xl bg-white p-6 shadow-md">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Troubleshooting</h2>
        
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-medium text-gray-700">View User Data</h3>
          <p className="mb-4 text-gray-600">
            This will show information about the current user and their data in the database.
          </p>
          
          <div className="rounded-md bg-gray-100 p-4">
            <p><strong>User ID:</strong> {auth.user?.uid}</p>
            <p><strong>Email:</strong> {auth.user?.email}</p>
            <p><strong>Display Name:</strong> {auth.user?.displayName}</p>
          </div>
        </div>
      </div>
    </div>
  );
} 