'use client';

import { useAuth } from '@/lib/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ProfileData {
  displayName: string;
  handicap: number;
  preferredTees: string;
  homeClub: string;
  bio: string;
  experienceLevel: string;
  favoriteCourse: string;
  playingFrequency: string;
  yearsPlaying: number;
  photoURL?: string;
}

export default function EditProfilePage() {
  const auth = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    displayName: '',
    handicap: 0,
    preferredTees: '',
    homeClub: '',
    bio: '',
    experienceLevel: '',
    favoriteCourse: '',
    playingFrequency: '',
    yearsPlaying: 0,
    photoURL: ''
  });
  const [successMessage, setSuccessMessage] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.user) return;
      
      setLoading(true);
      try {
        const profileDoc = await getDoc(doc(db, 'users', auth.user.uid));
        
        if (profileDoc.exists()) {
          const profileData = profileDoc.data() as ProfileData;
          setProfile({
            displayName: profileData.displayName || auth.user.displayName || '',
            handicap: profileData.handicap || 0,
            preferredTees: profileData.preferredTees || '',
            homeClub: profileData.homeClub || '',
            bio: profileData.bio || '',
            experienceLevel: profileData.experienceLevel || '',
            favoriteCourse: profileData.favoriteCourse || '',
            playingFrequency: profileData.playingFrequency || '',
            yearsPlaying: profileData.yearsPlaying || 0,
            photoURL: profileData.photoURL || auth.user.photoURL || ''
          });
          
          if (profileData.photoURL) {
            setImagePreview(profileData.photoURL);
          } else if (auth.user.photoURL) {
            setImagePreview(auth.user.photoURL);
          }
        } else {
          // Initialize with data from auth if available
          setProfile({
            displayName: auth.user.displayName || '',
            handicap: 0,
            preferredTees: '',
            homeClub: '',
            bio: '',
            experienceLevel: '',
            favoriteCourse: '',
            playingFrequency: '',
            yearsPlaying: 0,
            photoURL: auth.user.photoURL || ''
          });
          
          if (auth.user.photoURL) {
            setImagePreview(auth.user.photoURL);
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [auth.user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: name === 'handicap' || name === 'yearsPlaying' ? parseFloat(value) : value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      
      // Create a preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.user) return;

    setSaving(true);
    setSuccessMessage('');
    try {
      let photoURL = profile.photoURL;
      
      // Upload image if a new one was selected
      if (profileImage) {
        const storageRef = ref(storage, `profile-images/${auth.user.uid}`);
        await uploadBytes(storageRef, profileImage);
        photoURL = await getDownloadURL(storageRef);
      }
      
      // Update profile in Firestore
      await setDoc(doc(db, 'users', auth.user.uid), {
        ...profile,
        photoURL,
        email: auth.user.email?.toLowerCase() || '',
        updatedAt: new Date(),
      }, { merge: true });
      
      // Also update the player document in the players collection
      await setDoc(doc(db, 'players', auth.user.uid), {
        name: profile.displayName,
        handicap: profile.handicap || 0,
        isManualPlayer: false,
        updatedAt: new Date()
      }, { merge: true });
      
      // Update auth profile if name changed
      if (auth.user.displayName !== profile.displayName) {
        await updateDoc(doc(db, 'users', auth.user.uid), {
          displayName: profile.displayName
        });
      }
      
      setSuccessMessage('Profile saved successfully!');
      
      // Clear success message after 3 seconds and redirect
      setTimeout(() => {
        setSuccessMessage('');
        router.push('/profile');
      }, 2000);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <Link 
          href="/profile" 
          className="inline-flex items-center text-sm font-medium text-green-700 hover:text-green-800"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Profile
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-800">Edit Your Golf Profile</h1>
      </div>
      
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 shadow-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-3 h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="font-medium">{successMessage}</p>
          </div>
        </div>
      )}
      
      <div className="overflow-hidden rounded-xl bg-white shadow-lg">
        <div className="bg-gradient-to-r from-green-600 to-green-500 px-6 py-4">
          <h2 className="text-xl font-bold text-white">Profile Information</h2>
          <p className="text-sm text-green-50">Update your golf profile details below</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-8">
            <div className="flex flex-col items-center">
              <div className="mb-4 h-36 w-36 overflow-hidden rounded-full border-4 border-white shadow-md">
                {imagePreview ? (
                  <img 
                    src={imagePreview} 
                    alt="Profile preview" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
              </div>
              <button 
                type="button"
                className="mb-2 inline-flex items-center rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition-colors hover:bg-green-200"
                onClick={() => document.getElementById('profile-image-input')?.click()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Change Profile Picture
              </button>
              <input 
                id="profile-image-input"
                type="file" 
                accept="image/*" 
                onChange={handleImageChange} 
                className="hidden" 
              />
              <p className="text-xs text-gray-500">Recommended: Square image, at least 300x300 pixels</p>
            </div>
            
            <div className="border-t border-gray-100 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">Basic Information</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="displayName">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={profile.displayName}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    required
                    placeholder="Your full name"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="handicap">
                    Handicap Index
                  </label>
                  <input
                    type="number"
                    id="handicap"
                    name="handicap"
                    value={profile.handicap}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    step="0.1"
                    min="-10"
                    max="54"
                    placeholder="Enter your handicap"
                  />
                  <p className="mt-1 text-xs text-gray-500">Enter your exact handicap. Use negative values for plus handicaps.</p>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">Golf Details</h3>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="homeClub">
                    Home Club
                  </label>
                  <input
                    type="text"
                    id="homeClub"
                    name="homeClub"
                    value={profile.homeClub}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    placeholder="Your home golf club"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="preferredTees">
                    Preferred Tees
                  </label>
                  <select
                    id="preferredTees"
                    name="preferredTees"
                    value={profile.preferredTees}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">Select Preferred Tees</option>
                    <option value="Red">Red</option>
                    <option value="Gold">Gold</option>
                    <option value="White">White</option>
                    <option value="Blue">Blue</option>
                    <option value="Black">Black</option>
                  </select>
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="experienceLevel">
                    Experience Level
                  </label>
                  <select
                    id="experienceLevel"
                    name="experienceLevel"
                    value={profile.experienceLevel}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">Select Experience Level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                    <option value="Expert">Expert</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="yearsPlaying">
                    Years Playing
                  </label>
                  <input
                    type="number"
                    id="yearsPlaying"
                    name="yearsPlaying"
                    value={profile.yearsPlaying}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    min="0"
                    max="80"
                    placeholder="How many years you've been playing"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="favoriteCourse">
                    Favorite Course
                  </label>
                  <input
                    type="text"
                    id="favoriteCourse"
                    name="favoriteCourse"
                    value={profile.favoriteCourse}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                    placeholder="Your favorite golf course"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="playingFrequency">
                    Playing Frequency
                  </label>
                  <select
                    id="playingFrequency"
                    name="playingFrequency"
                    value={profile.playingFrequency}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  >
                    <option value="">How often do you play?</option>
                    <option value="Rarely">Rarely (few times a year)</option>
                    <option value="Occasionally">Occasionally (once a month)</option>
                    <option value="Regularly">Regularly (2-3 times a month)</option>
                    <option value="Frequently">Frequently (weekly)</option>
                    <option value="Very Frequently">Very Frequently (multiple times a week)</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100 pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">About You</h3>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700" htmlFor="bio">
                  Golf Bio
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  value={profile.bio}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-gray-300 p-3 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                  rows={4}
                  placeholder="Tell us about your golf journey, achievements, or goals..."
                />
              </div>
            </div>
          </div>
          
          <div className="mt-8 border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-green-600 py-3 text-center font-medium text-white shadow-md transition-colors hover:bg-green-700 disabled:bg-gray-300 disabled:text-gray-500 sm:w-auto sm:px-8"
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving Profile...
                </span>
              ) : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 