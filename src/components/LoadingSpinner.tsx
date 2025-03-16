'use client';

import React from 'react';

const LoadingSpinner: React.FC = () => {
  return (
    <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-green-600"></div>
  );
};

export default LoadingSpinner; 