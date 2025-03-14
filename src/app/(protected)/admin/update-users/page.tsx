'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';

export default function UpdateUsersPage() {
  const auth = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualUserId, setManualUserId] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Check if the current user is an admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!auth.user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', auth.user.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error('Error checking admin status:', err);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };
    
    checkAdmin();
  }, [auth.user]);

  const updateUsersWithEmail = async () => {
    if (!auth.user || !isAdmin) return;
    
    setUpdating(true);
    setResults([]);
    setError(null);
    
    try {
      // For a real application, this would be a Cloud Function
      // Here we'll just update the current user as a demonstration
      
      // Get the current user's document
      const userDoc = await getDoc(doc(db, 'users', auth.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (!userData.email && auth.user.email) {
          // Update the user with their email
          await setDoc(doc(db, 'users', auth.user.uid), {
            email: auth.user.email.toLowerCase(),
            updatedAt: new Date()
          }, { merge: true });
          
          setResults(prev => [...prev, `Updated user ${auth.user?.uid} with email ${auth.user?.email}`]);
        } else {
          setResults(prev => [...prev, `User ${auth.user?.uid} already has email field: ${userData.email}`]);
        }
      }
      
      // Instructions for implementing a Cloud Function
      setResults(prev => [...prev, 
        'To update all users, you would need to create a Cloud Function:',
        '1. Create a Firebase Cloud Function that uses the Admin SDK',
        '2. List all users from Firebase Auth',
        '3. For each user, check if they have a Firestore document',
        '4. If they do, ensure it has an email field',
        '5. If not, update the document with the email from Auth'
      ]);
      
      setResults(prev => [...prev, 'Update process completed']);
    } catch (err) {
      console.error('Error updating users:', err);
      setError('Failed to update users. See console for details.');
    } finally {
      setUpdating(false);
    }
  };

  const updateSpecificUser = async () => {
    if (!auth.user || !isAdmin || !manualUserId || !manualEmail) return;
    
    setUpdating(true);
    setResults([]);
    setError(null);
    
    try {
      // Get the specified user's document
      const userDoc = await getDoc(doc(db, 'users', manualUserId));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Update the user with the provided email
        await setDoc(doc(db, 'users', manualUserId), {
          email: manualEmail.toLowerCase(),
          updatedAt: new Date()
        }, { merge: true });
        
        setResults(prev => [...prev, `Updated user ${manualUserId} with email ${manualEmail}`]);
      } else {
        setResults(prev => [...prev, `User ${manualUserId} does not exist in Firestore`]);
      }
      
      setResults(prev => [...prev, 'Manual update completed']);
    } catch (err) {
      console.error('Error updating specific user:', err);
      setError('Failed to update user. See console for details.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }

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

  if (!isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg">
          <h2 className="mb-4 text-xl font-semibold text-gray-800">Access Denied</h2>
          <p className="mb-6 text-gray-600">
            You do not have permission to access this page.
          </p>
          <Link
            href="/dashboard"
            className="inline-block rounded-md bg-green-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold text-gray-800">Admin: Update Users</h1>
      
      <div className="mb-8 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Update Users with Email Field</h2>
        <p className="mb-4 text-gray-600">
          This utility will update all existing user documents in Firestore to include the email field.
          This is useful for ensuring that the friends search functionality works correctly.
        </p>
        
        <div className="mb-6">
          <button
            onClick={updateUsersWithEmail}
            disabled={updating}
            className="rounded-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
          >
            {updating ? 'Updating Users...' : 'Update Users with Email'}
          </button>
        </div>
        
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">Manually Update Specific User</h3>
          <p className="mb-4 text-gray-600">
            Use this form to manually update a specific user with an email field.
          </p>
          
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="userId">
                User ID
              </label>
              <input
                id="userId"
                type="text"
                value={manualUserId}
                onChange={(e) => setManualUserId(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Firebase Auth UID"
              />
            </div>
            
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="user@example.com"
              />
            </div>
          </div>
          
          <button
            onClick={updateSpecificUser}
            disabled={updating || !manualUserId || !manualEmail}
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
          >
            {updating ? 'Updating User...' : 'Update Specific User'}
          </button>
        </div>
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {results.length > 0 && (
          <div className="rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 font-medium text-gray-800">Results:</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-gray-600">
              {results.map((result, index) => (
                <li key={index}>{result}</li>
              ))}
            </ul>
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