'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page with register mode
    // We'll use URL search parameters to indicate the register mode
    router.push('/login?mode=register');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-green-700"></div>
    </div>
  );
}