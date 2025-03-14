import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';

interface MobileScoreCaptureProps {
  roundId: string;
  playerId: string;
  playerName: string;
  courseId: string;
  courseName: string;
  holeCount: number;
  holes: {
    number: number;
    par: number;
    strokeIndex: number;
    distance: number;
  }[];
  existingScores?: number[];
  existingScoreId?: string;
  playerHandicap?: number;
  onSaveSuccess?: () => void;
  onCancel?: () => void;
}

const MobileScoreCapture: React.FC<MobileScoreCaptureProps> = ({
  roundId,
  playerId,
  playerName,
  courseId,
  courseName,
  holeCount,
  holes,
  existingScores,
  existingScoreId,
  playerHandicap = 0,
  onSaveSuccess,
  onCancel
}) => {
  const router = useRouter();
  const [currentHoleIndex, setCurrentHoleIndex] = useState(0);
  const [scores, setScores] = useState<number[]>(existingScores || Array(holeCount).fill(0));
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [scoreDocId, setScoreDocId] = useState<string | undefined>(existingScoreId);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  
  // Calculate total score
  const totalScore = scores.reduce((sum, score) => sum + (score || 0), 0);
  
  // Calculate score to par
  const totalPar = holes.reduce((sum, hole) => sum + hole.par, 0);
  const scoreToPar = totalScore - totalPar;
  
  // Format score to par
  const formatScoreToPar = (score: number): string => {
    if (score === 0) return 'E';
    return score > 0 ? `+${score}` : `${score}`;
  };
  
  // Get current hole data
  const currentHole = holes[currentHoleIndex] || { number: 1, par: 4, strokeIndex: 1, distance: 0 };
  
  // Load scores from localStorage on component mount
  useEffect(() => {
    const savedScores = localStorage.getItem(`golf-scores-${roundId}-${playerId}`);
    if (savedScores) {
      try {
        const parsedScores = JSON.parse(savedScores);
        // Only use localStorage scores if we don't have existing scores from the database
        if (!existingScores || existingScores.every(score => score === 0)) {
          setScores(parsedScores);
        }
      } catch (e) {
        console.error('Error parsing saved scores from localStorage', e);
      }
    }
  }, [roundId, playerId, existingScores]);
  
  // Save scores to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`golf-scores-${roundId}-${playerId}`, JSON.stringify(scores));
    
    // Set unsaved changes flag if scores have been modified
    if (existingScores && JSON.stringify(scores) !== JSON.stringify(existingScores)) {
      setUnsavedChanges(true);
    }
  }, [scores, roundId, playerId, existingScores]);
  
  // Handle beforeunload event to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (unsavedChanges) {
        const message = 'You have unsaved scores. Are you sure you want to leave?';
        e.returnValue = message;
        return message;
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [unsavedChanges]);
  
  // Handle score change
  const handleScoreChange = (score: number) => {
    const newScores = [...scores];
    newScores[currentHoleIndex] = score;
    setScores(newScores);
    setUnsavedChanges(true);
  };
  
  // Auto-save scores to database
  const autoSaveScores = async () => {
    if (!scores[currentHoleIndex]) return; // Don't auto-save if current hole score is not set
    
    setAutoSaving(true);
    setError('');
    
    try {
      const total = scores.reduce((sum, score) => sum + (score || 0), 0);
      
      if (scoreDocId) {
        // Update existing score
        await updateDoc(doc(db, 'scores', scoreDocId), {
          holeScores: scores,
          total,
          lastUpdatedAt: Timestamp.now()
        });
      } else {
        // Create new score
        const docRef = await addDoc(collection(db, 'scores'), {
          roundId,
          playerId,
          playerName,
          holeScores: scores,
          total,
          submittedAt: Timestamp.now()
        });
        
        // Save the new document ID
        setScoreDocId(docRef.id);
      }
      
      // Show brief auto-save message
      setSuccessMessage('Auto-saved');
      setTimeout(() => {
        setSuccessMessage('');
      }, 1500);
      
      setUnsavedChanges(false);
    } catch (error) {
      console.error('Error auto-saving scores:', error);
      setError('Failed to auto-save. Your scores are still saved locally.');
      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setAutoSaving(false);
    }
  };
  
  // Navigate to next hole
  const goToNextHole = async () => {
    if (scores[currentHoleIndex]) {
      // Auto-save when navigating if the current hole has a score
      await autoSaveScores();
    }
    
    if (currentHoleIndex < holeCount - 1) {
      setCurrentHoleIndex(currentHoleIndex + 1);
    }
  };
  
  // Navigate to previous hole
  const goToPrevHole = async () => {
    if (scores[currentHoleIndex]) {
      // Auto-save when navigating if the current hole has a score
      await autoSaveScores();
    }
    
    if (currentHoleIndex > 0) {
      setCurrentHoleIndex(currentHoleIndex - 1);
    }
  };
  
  // Save scores to database
  const saveScores = async () => {
    setSaving(true);
    setError('');
    
    try {
      const total = scores.reduce((sum, score) => sum + (score || 0), 0);
      
      if (scoreDocId) {
        // Update existing score
        await updateDoc(doc(db, 'scores', scoreDocId), {
          holeScores: scores,
          total,
          lastUpdatedAt: Timestamp.now()
        });
      } else {
        // Create new score
        const docRef = await addDoc(collection(db, 'scores'), {
          roundId,
          playerId,
          playerName,
          holeScores: scores,
          total,
          submittedAt: Timestamp.now()
        });
        
        // Save the new document ID
        setScoreDocId(docRef.id);
      }
      
      setSuccessMessage('Scores saved successfully!');
      setUnsavedChanges(false);
      
      // Clear success message after 2 seconds
      setTimeout(() => {
        setSuccessMessage('');
        if (onSaveSuccess) onSaveSuccess();
      }, 2000);
    } catch (error) {
      console.error('Error saving scores:', error);
      setError('Failed to save scores. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  
  // Determine if player gets a stroke on current hole
  const getStrokesOnHole = (holeIndex: number): number => {
    if (!playerHandicap || playerHandicap <= 0) return 0;
    
    const hole = holes[holeIndex];
    if (!hole) return 0;
    
    // Calculate strokes based on handicap and stroke index
    // For handicaps higher than 18, players can get multiple strokes on holes
    const strokesOnHole = Math.floor(playerHandicap / 18) + (hole.strokeIndex <= (playerHandicap % 18) ? 1 : 0);
    
    return strokesOnHole;
  };
  
  // Get strokes for current hole
  const strokesOnCurrentHole = getStrokesOnHole(currentHoleIndex);

  // Quick score buttons
  const quickScoreButtons = [
    currentHole.par - 2, // Eagle or better
    currentHole.par - 1, // Birdie
    currentHole.par,     // Par
    currentHole.par + 1, // Bogey
    currentHole.par + 2, // Double bogey
  ];
  
  // Add triple bogey if player gets strokes on this hole
  if (strokesOnCurrentHole > 0) {
    quickScoreButtons.push(currentHole.par + 3); // Triple bogey
  }
  
  // Filter out non-positive scores
  const filteredQuickScoreButtons = quickScoreButtons.filter(score => score > 0);
  
  // Get score color based on relation to par
  const getScoreColor = (score: number, par: number): string => {
    if (!score) return 'text-gray-400';
    if (score < par - 1) return 'text-purple-600';
    if (score === par - 1) return 'text-blue-600';
    if (score === par) return 'text-green-600';
    if (score === par + 1) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  return (
    <div className="flex h-full min-h-screen w-full flex-col bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-green-600 to-green-500 px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <button 
            onClick={onCancel}
            className="rounded-full bg-white/20 p-2 text-white backdrop-blur-sm shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">{courseName}</h1>
          <div className="h-9 w-9"></div> {/* Spacer for alignment */}
        </div>
      </div>
      
      {/* Hole Stats */}
      <div className="border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Hole {currentHole.number}</h2>
            <p className="text-sm text-gray-600">Par {currentHole.par} • {currentHole.distance} yards</p>
            <p className="text-xs text-gray-500">
              Stroke Index: {currentHole.strokeIndex}
              {strokesOnCurrentHole > 0 && (
                <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                  {strokesOnCurrentHole > 1 ? `${strokesOnCurrentHole} strokes` : '1 stroke'}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="rounded-lg bg-green-50 px-4 py-2 text-center">
              <p className="text-xs font-medium text-green-700">HOLE SCORE</p>
              <div className="flex items-center justify-center">
                <p className={`text-2xl font-bold ${getScoreColor(scores[currentHoleIndex], currentHole.par)}`}>
                  {scores[currentHoleIndex] || '-'}
                </p>
                {scores[currentHoleIndex] > 0 && (
                  <span className={`ml-2 ${
                    scores[currentHoleIndex] < currentHole.par 
                      ? 'text-blue-600' 
                      : scores[currentHoleIndex] > currentHole.par 
                        ? 'text-red-600' 
                        : 'text-green-600'
                  }`}>
                    {scores[currentHoleIndex] < currentHole.par && `(-${currentHole.par - scores[currentHoleIndex]})`}
                    {scores[currentHoleIndex] > currentHole.par && `(+${scores[currentHoleIndex] - currentHole.par})`}
                    {scores[currentHoleIndex] === currentHole.par && '(E)'}
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 px-4 py-2 text-center">
              <p className="text-xs font-medium text-blue-700">GROSS SCORE</p>
              <div className="flex items-center justify-center">
                <p className="text-3xl font-bold text-blue-800">
                  {totalScore > 0 ? totalScore : '-'}
                </p>
                {totalScore > 0 && (
                  <span className={`ml-2 text-lg ${
                    scoreToPar < 0 
                      ? 'text-blue-600' 
                      : scoreToPar > 0 
                        ? 'text-red-600' 
                        : 'text-green-600'
                  }`}>
                    {scoreToPar < 0 && `(-${Math.abs(scoreToPar)})`}
                    {scoreToPar > 0 && `(+${scoreToPar})`}
                    {scoreToPar === 0 && '(E)'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Error/Success Messages */}
      {error && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 shadow-sm">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="mx-4 mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-green-700 shadow-sm">
          {successMessage}
        </div>
      )}
      
      {/* Auto-save Indicator */}
      {autoSaving && (
        <div className="mx-4 mt-2 flex items-center justify-center rounded-lg bg-blue-50 p-2 text-sm text-blue-700">
          <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Auto-saving...
        </div>
      )}
      
      {/* Score Input */}
      <div className="flex-1 px-4 py-6">
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-gray-700">Enter your score for hole {currentHole.number}:</p>
          
          <div className="mb-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
            <button 
              onClick={() => handleScoreChange(Math.max(1, (scores[currentHoleIndex] || 0) - 1))}
              className="rounded-full bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-400 shadow-sm"
              aria-label="Decrease score"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            
            <input
              type="number"
              min="1"
              value={scores[currentHoleIndex] || ''}
              onChange={(e) => handleScoreChange(parseInt(e.target.value) || 0)}
              className="w-16 bg-transparent p-2 text-center text-3xl font-bold text-gray-800 focus:outline-none"
            />
            
            <button 
              onClick={() => handleScoreChange((scores[currentHoleIndex] || 0) + 1)}
              className="rounded-full bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-400 shadow-sm"
              aria-label="Increase score"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          
          <div className="mb-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Quick score:</p>
            <div className="flex flex-wrap gap-2">
              {filteredQuickScoreButtons.map(score => (
                <button
                  key={score}
                  onClick={() => handleScoreChange(score)}
                  className={`flex-1 rounded-md px-3 py-2.5 text-sm font-medium shadow-sm transition-colors
                    ${scores[currentHoleIndex] === score 
                      ? 'bg-green-600 text-white shadow' 
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                >
                  {score}
                  {score === currentHole.par - 2 && ' (Eagle)'}
                  {score === currentHole.par - 1 && ' (Birdie)'}
                  {score === currentHole.par && ' (Par)'}
                  {score === currentHole.par + 1 && ' (Bogey)'}
                  {score === currentHole.par + 2 && ' (Double)'}
                  {score === currentHole.par + 3 && ' (Triple)'}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Hole Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={goToPrevHole}
            disabled={currentHoleIndex === 0}
            className={`flex items-center rounded-lg px-4 py-2.5 text-sm font-medium shadow transition-colors
              ${currentHoleIndex === 0 
                ? 'bg-gray-100 text-gray-400' 
                : 'bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Previous
          </button>
          
          <span className="text-sm font-medium text-gray-600">
            Hole {currentHoleIndex + 1} of {holeCount}
          </span>
          
          <button
            onClick={goToNextHole}
            disabled={currentHoleIndex === holeCount - 1}
            className={`flex items-center rounded-lg px-4 py-2.5 text-sm font-medium shadow transition-colors
              ${currentHoleIndex === holeCount - 1 
                ? 'bg-gray-100 text-gray-400' 
                : 'bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100'
              }`}
          >
            Next
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* Scorecard Summary */}
        <div className="mb-6 overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-4 py-3">
            <h3 className="text-sm font-medium text-gray-700">Your Scorecard</h3>
            <p className="mt-1 text-xs text-gray-500">Tap on any hole to edit its score</p>
          </div>
          
          <div className="max-h-40 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Hole</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Par</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {holes.map((hole, index) => (
                  <tr 
                    key={hole.number}
                    className={`${currentHoleIndex === index ? 'bg-green-50 font-semibold' : ''} cursor-pointer hover:bg-gray-50 transition-colors`}
                    onClick={() => {
                      // Auto-save current hole score before switching if it exists
                      if (scores[currentHoleIndex]) {
                        autoSaveScores().then(() => {
                          setCurrentHoleIndex(index);
                        });
                      } else {
                        setCurrentHoleIndex(index);
                      }
                    }}
                  >
                    <td className={`whitespace-nowrap px-3 py-2.5 text-sm ${currentHoleIndex === index ? 'font-bold text-green-700' : 'font-medium text-gray-900'}`}>
                      {hole.number}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-gray-500">
                      {hole.par}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm font-medium">
                      {scores[index] ? (
                        <div className={`inline-flex items-center ${currentHoleIndex === index ? 'ring-2 ring-green-200 rounded-full px-2 py-0.5' : ''}`}>
                          <span className={getScoreColor(scores[index], hole.par)}>
                            {scores[index]}
                          </span>
                          <span className={`ml-1 text-xs ${
                            scores[index] < hole.par 
                              ? 'text-blue-600' 
                              : scores[index] > hole.par 
                                ? 'text-red-600' 
                                : 'text-green-600'
                          }`}>
                            {scores[index] < hole.par && `(-${hole.par - scores[index]})`}
                            {scores[index] > hole.par && `(+${scores[index] - hole.par})`}
                            {scores[index] === hole.par && '(E)'}
                          </span>
                        </div>
                      ) : (
                        <span className={`text-gray-300 ${currentHoleIndex === index ? 'ring-2 ring-green-200 rounded-full px-2 py-0.5' : ''}`}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Total</span>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Par: {totalPar}
                </span>
                <span className={`text-sm font-medium ${
                  scoreToPar < 0 
                    ? 'text-blue-600' 
                    : scoreToPar > 0 
                      ? 'text-red-600' 
                      : 'text-green-600'
                }`}>
                  {totalScore > 0 ? totalScore : '-'} 
                  {totalScore > 0 && (
                    <span>
                      {scoreToPar < 0 && `(-${Math.abs(scoreToPar)})`}
                      {scoreToPar > 0 && `(+${scoreToPar})`}
                      {scoreToPar === 0 && '(E)'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer with Save Button */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3 shadow-lg">
        <button
          onClick={saveScores}
          disabled={saving}
          className="w-full rounded-lg bg-green-600 py-3.5 text-center font-medium text-white shadow-md transition-colors hover:bg-green-700 active:bg-green-800 disabled:bg-green-400"
        >
          {saving ? (
            <span className="flex items-center justify-center">
              <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ) : (
            <>
              {unsavedChanges && (
                <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-400"></span>
              )}
              Save Scores
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MobileScoreCapture; 