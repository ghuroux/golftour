'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';

export default function MakeAdminPage() {
  const auth = useAuth();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const makeAdmin = async () => {
    if (!auth.user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Update the current user's document to add admin flag
      await updateDoc(doc(db, 'users', auth.user.uid), {
        isAdmin: true,
        updatedAt: new Date()
      });
      
      setSuccess(true);
    } catch (err) {
      console.error('Error making user admin:', err);
      setError('Failed to make user admin. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  if (!auth.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Sign In Required</h2>
          <p className="mb-6 text-gray-600">
            Please sign in to access this page.
          </p>
          <Link
            href="/login"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-800">Make Admin</h1>
      
      <div className="mb-8 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Make Current User Admin</h2>
        <p className="mb-4 text-gray-600">
          This page allows you to make the current user an admin. This is a temporary solution and should be removed after use.
        </p>
        
        <div className="mb-6">
          <p className="mb-2 font-medium">Current User: {auth.user.email}</p>
          <p className="mb-4 text-sm text-gray-500">User ID: {auth.user.uid}</p>
          
          {!success ? (
            <button
              onClick={makeAdmin}
              disabled={loading}
              className="rounded-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {loading ? 'Processing...' : 'Make Admin'}
            </button>
          ) : (
            <div className="rounded-md bg-green-50 p-4 text-green-700">
              <p className="font-medium">Success!</p>
              <p>You are now an admin. You can now access the admin pages.</p>
              <div className="mt-4">
                <Link
                  href="/admin/update-users"
                  className="inline-block rounded-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800"
                >
                  Go to Admin Page
                </Link>
              </div>
            </div>
          )}
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
      </div>
      
      <div className="text-center">
        <Link
          href="/dashboard"
          className="inline-block rounded-md bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
} 