'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import Link from 'next/link';

export default function FixOldUserPage() {
  const auth = useAuth();
  const [userId, setUserId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);

  const checkUser = async () => {
    if (!userId) return;
    
    setLoading(true);
    setError(null);
    setUserInfo(null);
    
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        setUserInfo(userDoc.data());
      } else {
        setError(`User with ID ${userId} does not exist in Firestore.`);
      }
    } catch (err) {
      console.error('Error checking user:', err);
      setError('Failed to check user. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  const fixUser = async () => {
    if (!userId || !email) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Update the user document with email and admin flag
      await setDoc(doc(db, 'users', userId), {
        email: email.toLowerCase(),
        isAdmin: true,
        updatedAt: new Date()
      }, { merge: true });
      
      // Fetch the updated user info
      const updatedUserDoc = await getDoc(doc(db, 'users', userId));
      if (updatedUserDoc.exists()) {
        setUserInfo(updatedUserDoc.data());
      }
      
      setSuccess(true);
    } catch (err) {
      console.error('Error fixing user:', err);
      setError('Failed to fix user. See console for details.');
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
      <h1 className="mb-6 text-3xl font-bold text-gray-800">Fix Old User</h1>
      
      <div className="mb-8 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Fix Old User Account</h2>
        <p className="mb-4 text-gray-600">
          This page allows you to fix an old user account by adding the email field and admin privileges.
        </p>
        
        <div className="mb-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="userId">
              User ID
            </label>
            <div className="flex">
              <input
                id="userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-l-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                placeholder="Firebase Auth UID"
              />
              <button
                onClick={checkUser}
                disabled={loading || !userId}
                className="rounded-r-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:bg-blue-300"
              >
                Check
              </button>
            </div>
          </div>
          
          {userInfo && (
            <div className="rounded-md bg-gray-50 p-4">
              <h3 className="mb-2 font-medium text-gray-800">Current User Info:</h3>
              <div className="space-y-1 text-sm">
                <p><span className="font-medium">Display Name:</span> {userInfo.displayName || 'Not set'}</p>
                <p><span className="font-medium">Email:</span> {userInfo.email || 'Not set'}</p>
                <p><span className="font-medium">Admin:</span> {userInfo.isAdmin ? 'Yes' : 'No'}</p>
                <p><span className="font-medium">Last Updated:</span> {userInfo.updatedAt ? new Date(userInfo.updatedAt.seconds * 1000).toLocaleString() : 'Never'}</p>
              </div>
            </div>
          )}
          
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
              placeholder="user@example.com"
            />
          </div>
          
          <button
            onClick={fixUser}
            disabled={loading || !userId || !email}
            className="rounded-md bg-green-700 px-4 py-2 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
          >
            {loading ? 'Processing...' : 'Fix User'}
          </button>
        </div>
        
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4 text-green-700">
            <p className="font-medium">Success!</p>
            <p>The user has been updated with the email field and admin privileges.</p>
          </div>
        )}
        
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-red-700">
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