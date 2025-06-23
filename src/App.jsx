import React from 'react';
import VotingSystem from './components/VotingSystem';

const App = () => {
  // Voting deadline: June 23, 2025, 11:59 PM
  const votingDeadline = new Date('2025-06-23T23:59:59');
  const now = new Date();
  const isVotingClosed = now > votingDeadline;

  if (isVotingClosed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 flex items-center justify-center p-4 overflow-hidden relative">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white/5 rounded-full blur-2xl animate-bounce"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-xl animate-ping"></div>
        </div>
        
        {/* Main content */}
        <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-12 max-w-2xl w-full text-center transform hover:scale-105 transition-transform duration-300">
          {/* Icon */}
          <div className="relative mb-8">
            <div className="w-24 h-24 mx-auto bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-ping"></div>
          </div>
          
          {/* Title with gradient text */}
          <h1 className="text-6xl font-black bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 bg-clip-text text-transparent mb-6 animate-pulse">
            VOTING CLOSED
          </h1>
          
          {/* Subtitle */}
          <div className="space-y-4 mb-8">
            <p className="text-2xl font-semibold text-gray-700">
              The polls have officially closed! 🗳️
            </p>
            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-2xl p-6 border border-red-200">
              <p className="text-lg text-gray-600">
                <span className="font-bold text-red-600">Deadline:</span> June 23, 2025 at 11:59 PM
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Thank you to everyone who participated in the democratic process!
              </p>
            </div>
          </div>
          
          {/* Call to action */}
          <div className="space-y-4">
            <p className="text-lg font-medium text-gray-600">
              Stay tuned for results! 📊
            </p>
            <div className="flex justify-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <VotingSystem />;
}

export default App;
