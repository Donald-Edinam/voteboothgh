import React, { useState, useEffect } from 'react';
import { Trophy, Award, Star, Crown, Medal, TrendingUp, Users, Eye, Sparkles, Zap, Heart, Flame } from 'lucide-react';

// Mock logo - replace with actual logo
const AppLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='40' fill='%23059669'/%3E%3Ctext x='50' y='58' font-family='Arial' font-size='24' font-weight='bold' text-anchor='middle' fill='white'%3EACK%3C/text%3E%3C/svg%3E";

// PocketBase service for fetching results
const pocketbaseService = {
  getResults: async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_PB_URL}/api/collections/vote_cat/records`);
      const categoriesData = await response.json();

      const categoriesWithResults = await Promise.all(
        categoriesData.items.map(async (category) => {
          const nomineesResponse = await fetch(
            `${import.meta.env.VITE_PB_URL}/api/collections/vote_noms/records?filter=(category='${category.id}')&sort=-votes`
          );
          const nomineesData = await nomineesResponse.json();

          const totalVotes = nomineesData.items.reduce((sum, nominee) => sum + (nominee.votes || 0), 0);

          return {
            id: category.id,
            name: category.name,
            nominees: nomineesData.items.map(nominee => ({
              ...nominee,
              percentage: totalVotes > 0 ? ((nominee.votes || 0) / totalVotes * 100).toFixed(1) : 0
            })),
            totalVotes
          };
        })
      );

      return categoriesWithResults;
    } catch (error) {
      console.error('Failed to fetch results:', error);
      throw error;
    }
  }
};

// Utility function to get PocketBase image URL
const getPocketbaseImageUrl = (collectionId, recordId, filename) => {
  if (!filename) return null;
  return `${import.meta.env.VITE_PB_URL}/api/files/${collectionId}/${recordId}/${filename}`;
};

// Floating particles component
const FloatingParticles = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-float opacity-20"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${3 + Math.random() * 4}s`
          }}
        >
          <Star className="h-4 w-4 text-yellow-400" />
        </div>
      ))}
    </div>
  );
};

// Confetti component for winners
const Confetti = ({ show }) => {
  if (!show) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 animate-confetti opacity-70"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'][Math.floor(Math.random() * 6)],
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 3}s`
          }}
        />
      ))}
    </div>
  );
};

// Vote counter animation component
const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setDisplayValue(Math.floor(progress * value));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration]);

  return <span>{displayValue.toLocaleString()}</span>;
};

const ResultsDisplay = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [showConfetti, setShowConfetti] = useState(false);
  const [animateResults, setAnimateResults] = useState(false);

  useEffect(() => {
    loadResults();
    const interval = setInterval(loadResults, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadResults = async () => {
    try {
      setLoading(true);
      const data = await pocketbaseService.getResults();
      setCategories(data);
      setLastUpdate(new Date());
      setError('');
      
      // Trigger animations
      setAnimateResults(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      setTimeout(() => setAnimateResults(false), 1000);
    } catch (error) {
      setError('Failed to load results. Please try again.');
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalVotesAcrossAll = categories.reduce((sum, cat) => sum + cat.totalVotes, 0);
  const totalNominees = categories.reduce((sum, cat) => sum + cat.nominees.length, 0);

  const getPositionSuffix = (position) => {
    if (position === 1) return 'st';
    if (position === 2) return 'nd';
    if (position === 3) return 'rd';
    return 'th';
  };

  const getPositionIcon = (position) => {
    if (position === 1) return <Crown className="h-6 w-6 text-yellow-400 animate-bounce" />;
    if (position === 2) return <Medal className="h-6 w-6 text-gray-300 animate-pulse" />;
    if (position === 3) return <Medal className="h-6 w-6 text-amber-500 animate-pulse" />;
    return <Trophy className="h-5 w-5 text-gray-400" />;
  };

  const getPositionColors = (position) => {
    if (position === 1) return 'from-yellow-400 via-yellow-500 to-yellow-600 text-white shadow-lg shadow-yellow-400/50';
    if (position === 2) return 'from-gray-300 via-gray-400 to-gray-500 text-white shadow-lg shadow-gray-400/50';
    if (position === 3) return 'from-amber-400 via-amber-500 to-amber-600 text-white shadow-lg shadow-amber-400/50';
    return 'from-gray-100 to-gray-200 text-gray-700';
  };

  const getPositionEmoji = (position) => {
    if (position === 1) return '🏆';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '🏅';
  };

  if (loading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center relative overflow-hidden">
        <FloatingParticles />
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-12 text-center max-w-md border border-white/20">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-white/20 border-t-white mx-auto mb-6"></div>
            <Sparkles className="absolute top-2 left-1/2 transform -translate-x-1/2 h-6 w-6 text-yellow-400 animate-ping" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2 animate-pulse">Loading Magic</h2>
          <p className="text-white/80">Fetching the latest exciting results...</p>
          <div className="mt-6 flex justify-center space-x-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-2 h-2 bg-white rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 via-pink-500 to-rose-500 flex items-center justify-center relative overflow-hidden">
        <FloatingParticles />
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-12 text-center max-w-md border border-white/20 animate-shake">
          <div className="bg-red-500/20 rounded-full p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <Eye className="h-10 w-10 text-white animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Oops! Something went wrong</h2>
          <p className="text-white/80 mb-6">{error}</p>
          <button 
            onClick={loadResults}
            className="bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 border border-white/30"
          >
            <Zap className="inline h-5 w-5 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 relative overflow-hidden">
      <FloatingParticles />
      <Confetti show={showConfetti} />
      
      {/* Animated Background Shapes */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-400/10 rounded-full blur-3xl animate-float-reverse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl animate-pulse"></div>
      </div>

      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg shadow-2xl sticky top-0 z-50 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col lg:flex-row items-center justify-between space-y-6 lg:space-y-0">
            <div className="flex items-center space-x-4 text-center lg:text-left">
              <div className="relative">
                <img src={AppLogo} alt="ACK Logo" className="w-16 h-16 rounded-full animate-spin-slow border-4 border-white/30" />
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  🏆 ACK SRC Awards Results
                </h1>
                <p className="text-white/80 flex items-center justify-center lg:justify-start mt-2">
                  <Heart className="h-4 w-4 mr-2 text-pink-400 animate-pulse" />
                  Live voting results - Updated in real time
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-center gap-6">
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-2xl lg:text-3xl font-bold text-yellow-400">
                  <AnimatedCounter value={totalVotesAcrossAll} />
                </div>
                <div className="text-sm text-white/70 flex items-center justify-center">
                  <Users className="h-4 w-4 mr-1" />
                  Total Votes
                </div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-2xl lg:text-3xl font-bold text-pink-400">{categories.length}</div>
                <div className="text-sm text-white/70 flex items-center justify-center">
                  <Award className="h-4 w-4 mr-1" />
                  Categories
                </div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 transform hover:scale-105 transition-all duration-300">
                <div className="text-2xl lg:text-3xl font-bold text-blue-400">{totalNominees}</div>
                <div className="text-sm text-white/70 flex items-center justify-center">
                  <Star className="h-4 w-4 mr-1" />
                  Nominees
                </div>
              </div>
            </div>
          </div>
          
          <div className="text-center lg:text-right mt-4">
            <div className="text-xs text-white/60 flex items-center justify-center lg:justify-end">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-ping"></div>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Category Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-yellow-400 to-pink-500 text-white shadow-lg shadow-yellow-400/50 animate-pulse'
                  : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border border-white/20'
              }`}
            >
              ✨ All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 transform hover:scale-105 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-yellow-400 to-pink-500 text-white shadow-lg shadow-yellow-400/50 animate-pulse'
                    : 'bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 border border-white/20'
                }`}
              >
                {category.name}
                <span className="ml-2 bg-white/20 text-white text-xs px-2 py-1 rounded-full animate-bounce">
                  {category.totalVotes}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Grid */}
        <div className="space-y-12">
          {categories
            .filter(category => selectedCategory === null || category.id === selectedCategory)
            .map((category, categoryIndex) => (
              <div 
                key={category.id} 
                className={`bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden border border-white/20 transform transition-all duration-700 ${
                  animateResults ? 'animate-slide-up' : ''
                }`}
                style={{ animationDelay: `${categoryIndex * 100}ms` }}
              >
                {/* Category Header */}
                <div className="bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white p-8 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                  <div className="flex flex-col lg:flex-row items-center justify-between space-y-4 lg:space-y-0 relative z-10">
                    <div className="flex items-center space-x-4 text-center lg:text-left">
                      <div className="bg-white/20 rounded-full p-3 animate-bounce">
                        <Award className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl lg:text-4xl font-bold">{category.name}</h2>
                        <p className="text-white/80 mt-1 flex items-center justify-center lg:justify-start">
                          <Flame className="h-4 w-4 mr-2 animate-pulse" />
                          {category.nominees.length} amazing contestants
                        </p>
                      </div>
                    </div>
                    <div className="text-center bg-white/20 backdrop-blur-sm rounded-2xl p-4">
                      <div className="text-3xl lg:text-4xl font-bold">
                        <AnimatedCounter value={category.totalVotes} />
                      </div>
                      <div className="text-white/80 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        Total Votes
                      </div>
                    </div>
                  </div>
                </div>

                {/* Nominees Results */}
                <div className="p-6 lg:p-8">
                  <div className="grid gap-6">
                    {category.nominees.map((nominee, index) => {
                      const position = index + 1;
                      return (
                        <div
                          key={nominee.id}
                          className={`relative overflow-hidden rounded-2xl transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] transform ${
                            position <= 3 
                              ? 'bg-gradient-to-r from-yellow-50/20 to-pink-50/20 border-2 border-yellow-400/50 shadow-lg shadow-yellow-400/20' 
                              : 'bg-white/5 border border-white/20 hover:bg-white/10'
                          } ${animateResults ? 'animate-slide-in-right' : ''}`}
                          style={{ animationDelay: `${(categoryIndex * 100) + (index * 50)}ms` }}
                        >
                          {position <= 3 && <Confetti show={showConfetti} />}
                          
                          <div className="flex flex-col lg:flex-row items-center p-6 space-y-4 lg:space-y-0">
                            {/* Position Badge */}
                            <div className={`flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-r ${getPositionColors(position)} mr-0 lg:mr-6 flex-shrink-0 transform hover:rotate-12 transition-transform duration-300`}>
                              <div className="text-center">
                                {getPositionIcon(position)}
                                <div className="text-xs font-bold mt-1">
                                  {position}{getPositionSuffix(position)}
                                </div>
                              </div>
                            </div>

                            {/* Nominee Photo */}
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white/10 mr-0 lg:mr-6 flex-shrink-0 border-4 border-white/20 transform hover:scale-110 transition-transform duration-300">
                              {nominee.photo ? (
                                <img
                                  src={getPocketbaseImageUrl(nominee.collectionId, nominee.id, nominee.photo)}
                                  alt={nominee.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-400/50 to-pink-400/50">
                                  <Star className="h-10 w-10 text-white animate-pulse" />
                                </div>
                              )}
                            </div>

                            {/* Nominee Details */}
                            <div className="flex-grow text-center lg:text-left w-full">
                              <h3 className="text-xl lg:text-2xl font-bold text-white mb-3 flex items-center justify-center lg:justify-start">
                                {getPositionEmoji(position)} {nominee.name}
                              </h3>
                              
                              {/* Vote Count and Percentage */}
                              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-2 sm:space-y-0 sm:space-x-6 mb-4">
                                <div className="flex items-center space-x-2 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                                  <Users className="h-5 w-5 text-blue-400" />
                                  <span className="text-2xl font-bold text-white">
                                    <AnimatedCounter value={nominee.votes || 0} />
                                  </span>
                                  <span className="text-white/70">votes</span>
                                </div>
                                <div className="flex items-center space-x-2 bg-white/10 rounded-full px-4 py-2 backdrop-blur-sm">
                                  <TrendingUp className="h-5 w-5 text-green-400" />
                                  <span className="text-xl font-bold text-green-400">
                                    {nominee.percentage}%
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-white/20 rounded-full h-4 mb-4 overflow-hidden">
                                <div
                                  className={`h-4 rounded-full transition-all duration-2000 relative ${
                                    position === 1 
                                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' 
                                      : position === 2
                                      ? 'bg-gradient-to-r from-gray-400 to-gray-600'
                                      : position === 3
                                      ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                                      : 'bg-gradient-to-r from-blue-400 to-purple-500'
                                  }`}
                                  style={{ width: `${nominee.percentage}%` }}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                                </div>
                              </div>

                              {/* Position Status */}
                              {position <= 3 && (
                                <div className="flex items-center justify-center lg:justify-start space-x-2">
                                  <div className={`px-4 py-2 rounded-full text-sm font-bold flex items-center space-x-2 animate-pulse ${
                                    position === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-400/50' :
                                    position === 2 ? 'bg-gray-500/20 text-gray-300 border border-gray-400/50' :
                                    'bg-amber-500/20 text-amber-400 border border-amber-400/50'
                                  }`}>
                                    <span>
                                      {position === 1 ? '🏆 CHAMPION!' : position === 2 ? '🥈 Runner-up' : '🥉 Third Place'}
                                    </span>
                                    {position === 1 && <Sparkles className="h-4 w-4 animate-spin" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-3xl mx-auto border border-white/20 transform hover:scale-105 transition-all duration-300">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <Star className="h-8 w-8 text-yellow-400 animate-spin" />
              <h3 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
                ACK SRC Awards 2025
              </h3>
              <Star className="h-8 w-8 text-yellow-400 animate-spin-reverse" />
            </div>
            <p className="text-white/80 mb-6 text-lg">
              ✨ Celebrating excellence and leadership in our amazing community ✨
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/70">
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-4 py-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-ping"></div>
                <span>Live Results</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-4 py-2">
                <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Real-time Updates</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-4 py-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
                <span>Secure Voting</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;