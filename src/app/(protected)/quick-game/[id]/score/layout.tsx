'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ScoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.push('/login');
    }
  }, [auth.user, auth.loading, router]);

  if (auth.loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
      </div>
    );
  }

  if (!auth.user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* No navbar or footer here */}
      <main className="flex-grow">{children}</main>
    </div>
  );
} 