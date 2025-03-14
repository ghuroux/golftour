'use client';
import { useContext, useState, useEffect } from 'react';
import { AuthContext } from '@/lib/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation'; // Add useSearchParams
import Link from 'next/link';
import Image from 'next/image';
// Import the necessary Firebase utility functions
import { registerWithEmailAndPassword, signInWithEmailAndPassword, resetPassword } from '@/lib/firebase/firebaseUtils';

// Create a union type for the mode states
type AuthMode = 'login' | 'register' | 'reset';

export default function LoginPage() {
  const searchParams = useSearchParams(); // Get search parameters
  const initialMode = searchParams.get('mode') as AuthMode || 'login';
  
  // Use the proper type for the mode state with initial value from URL
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  // Add state variables for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { user, loading: authLoading, signInWithGoogle } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Error signing in with Google', error);
      setError('Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };
  
  const handleEmailPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      if (mode === 'login') {
        // Handle login with email/password
        await signInWithEmailAndPassword(email, password);
        setSuccess('Login successful! Redirecting to dashboard...');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      } else if (mode === 'register') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Handle registration using the imported function
        await registerWithEmailAndPassword(email, password, displayName);
        setSuccess('Account created successfully! Redirecting to dashboard...');
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else if (mode === 'reset') {
        // Handle password reset
        await resetPassword(email);
        setSuccess('Password reset email sent. Please check your inbox.');
        setTimeout(() => {
          setMode('login');
        }, 3000);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      // Format Firebase error messages to be more user-friendly
      let errorMessage = err.message || 'An error occurred';
      
      // Clean up Firebase error messages
      if (errorMessage.includes('auth/email-already-in-use')) {
        errorMessage = 'This email is already registered. Please sign in instead.';
      } else if (errorMessage.includes('auth/weak-password')) {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (errorMessage.includes('auth/invalid-email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (errorMessage.includes('auth/user-not-found') || errorMessage.includes('auth/wrong-password')) {
        errorMessage = 'Invalid email or password.';
      } else if (errorMessage.includes('auth/too-many-requests')) {
        errorMessage = 'Too many failed login attempts. Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Toggle password visibility functions
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-green-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/">
            <Image 
              src="/coastal-clash-logo.png" 
              alt="Coastal Clash Logo" 
              width={150} 
              height={150}
              priority
            />
          </Link>
        </div>
        
        <div className="rounded-lg bg-white p-8 shadow-lg">
          <h1 className="mb-6 text-center text-2xl font-bold text-green-800">
            {mode === 'login' ? 'Welcome Back' : mode === 'register' ? 'Create Account' : 'Reset Password'}
          </h1>
          
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          {success && (
            <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-800">
              {success}
            </div>
          )}
          
          <form onSubmit={handleEmailPasswordSubmit} className="mb-6 space-y-4">
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="displayName">
                  Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  required={mode === 'register'}
                  placeholder="John Doe"
                />
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
                className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                required
                placeholder="you@example.com"
              />
            </div>
            
            {mode !== 'reset' && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700" htmlFor="password">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button 
                      type="button" 
                      onClick={() => setMode('reset')} 
                      className="text-sm font-medium text-green-700 hover:text-green-800"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    required={mode === 'login' || mode === 'register'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      // Eye-slash icon (password visible)
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      // Eye icon (password hidden)
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            {mode === 'register' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-gray-300 p-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    required={mode === 'register'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={toggleConfirmPasswordVisibility}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      // Eye-slash icon (password visible)
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      // Eye icon (password hidden)
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-green-700 p-3 text-white transition-colors hover:bg-green-800 disabled:bg-green-400"
            >
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : 'Reset Password'}
            </button>
          </form>
          
          <div className="mb-6">
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-gray-500">Or continue with</span>
              </div>
            </div>
            
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white p-3 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>
          
          <div className="text-center text-sm">
            {mode === 'login' ? (
              <p>
                Don't have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => setMode('register')} 
                  className="font-medium text-green-700 hover:text-green-800"
                >
                  Create one
                </button>
              </p>
            ) : mode === 'register' ? (
              <p>
                Already have an account?{' '}
                <button 
                  type="button" 
                  onClick={() => setMode('login')} 
                  className="font-medium text-green-700 hover:text-green-800"
                >
                  Sign in
                </button>
              </p>
            ) : (
              <button 
                type="button" 
                onClick={() => setMode('login')} 
                className="font-medium text-green-700 hover:text-green-800"
              >
                Back to sign in
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-600">
          <Link href="/" className="text-green-700 hover:text-green-800">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}