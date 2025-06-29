import React, { useState, useEffect } from 'react';
import { Trophy, Award, Star, Crown, Medal, TrendingUp, Users, Eye } from 'lucide-react';

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

          // Calculate total votes for this category
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

const ResultsDisplay = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    loadResults();
    // Auto-refresh every 30 seconds
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
    } catch (error) {
      setError('Failed to load results. Please try again.');
      console.error('Failed to load results:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate overall stats
  const totalVotesAcrossAll = categories.reduce((sum, cat) => sum + cat.totalVotes, 0);
  const totalNominees = categories.reduce((sum, cat) => sum + cat.nominees.length, 0);

  // Get position suffix
  const getPositionSuffix = (position) => {
    if (position === 1) return 'st';
    if (position === 2) return 'nd';
    if (position === 3) return 'rd';
    return 'th';
  };

  // Get position icon
  const getPositionIcon = (position) => {
    if (position === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (position === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (position === 3) return <Medal className="h-6 w-6 text-amber-600" />;
    return <Trophy className="h-5 w-5 text-gray-400" />;
  };

  // Get position colors
  const getPositionColors = (position) => {
    if (position === 1) return 'from-yellow-400 to-yellow-600 text-white';
    if (position === 2) return 'from-gray-300 to-gray-500 text-white';
    if (position === 3) return 'from-amber-400 to-amber-600 text-white';
    return 'from-gray-100 to-gray-200 text-gray-700';
  };

  if (loading && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading Results</h2>
          <p className="text-gray-600">Fetching the latest voting data...</p>
        </div>
      </div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-md">
          <div className="bg-red-100 rounded-full p-4 w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <Eye className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Unable to Load Results</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button 
            onClick={loadResults}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-2xl font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src={AppLogo} alt="ACK Logo" className="w-12 h-12 rounded-full" />
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ACK SRC Awards Results
                </h1>
                <p className="text-gray-600">Live voting results - Updated in real time</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totalVotesAcrossAll.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">Total Votes</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{categories.length}</div>
                  <div className="text-sm text-gray-500">Categories</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totalNominees}</div>
                  <div className="text-sm text-gray-500">Nominees</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 flex items-center justify-end">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                Last updated: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Category Navigation */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                selectedCategory === null
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-6 py-3 rounded-2xl font-medium transition-all duration-200 ${
                  selectedCategory === category.id
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {category.name}
                <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
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
            .map((category) => (
              <div key={category.id} className="bg-white rounded-3xl shadow-xl overflow-hidden">
                {/* Category Header */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-white/20 rounded-full p-3">
                        <Award className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-bold">{category.name}</h2>
                        <p className="text-blue-100 mt-1">
                          {category.nominees.length} nominees competing
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold">{category.totalVotes.toLocaleString()}</div>
                      <div className="text-blue-100">Total Votes</div>
                    </div>
                  </div>
                </div>

                {/* Nominees Results */}
                <div className="p-8">
                  <div className="grid gap-6">
                    {category.nominees.map((nominee, index) => {
                      const position = index + 1;
                      return (
                        <div
                          key={nominee.id}
                          className={`relative overflow-hidden rounded-2xl transition-all duration-300 hover:shadow-lg ${
                            position <= 3 ? 'border-2 border-yellow-200 shadow-md' : 'border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center p-6">
                            {/* Position Badge */}
                            <div className={`flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r ${getPositionColors(position)} mr-6 flex-shrink-0`}>
                              <div className="text-center">
                                {getPositionIcon(position)}
                                <div className="text-xs font-bold mt-1">
                                  {position}{getPositionSuffix(position)}
                                </div>
                              </div>
                            </div>

                            {/* Nominee Photo */}
                            <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 mr-6 flex-shrink-0">
                              {nominee.photo ? (
                                <img
                                  src={getPocketbaseImageUrl(nominee.collectionId, nominee.id, nominee.photo)}
                                  alt={nominee.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                                  <Star className="h-8 w-8 text-gray-500" />
                                </div>
                              )}
                            </div>

                            {/* Nominee Details */}
                            <div className="flex-grow">
                              <h3 className="text-xl font-bold text-gray-900 mb-2">{nominee.name}</h3>
                              
                              {/* Vote Count and Percentage */}
                              <div className="flex items-center space-x-4 mb-3">
                                <div className="flex items-center space-x-2">
                                  <Users className="h-5 w-5 text-blue-500" />
                                  <span className="text-2xl font-bold text-gray-900">
                                    {(nominee.votes || 0).toLocaleString()}
                                  </span>
                                  <span className="text-gray-500">votes</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <TrendingUp className="h-5 w-5 text-green-500" />
                                  <span className="text-xl font-bold text-green-600">
                                    {nominee.percentage}%
                                  </span>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                <div
                                  className={`h-3 rounded-full transition-all duration-1000 ${
                                    position === 1 
                                      ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' 
                                      : position === 2
                                      ? 'bg-gradient-to-r from-gray-400 to-gray-600'
                                      : position === 3
                                      ? 'bg-gradient-to-r from-amber-400 to-amber-600'
                                      : 'bg-gradient-to-r from-blue-400 to-purple-500'
                                  }`}
                                  style={{ width: `${nominee.percentage}%` }}
                                ></div>
                              </div>

                              {/* Position Status */}
                              {position <= 3 && (
                                <div className="flex items-center space-x-2">
                                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    position === 1 ? 'bg-yellow-100 text-yellow-800' :
                                    position === 2 ? 'bg-gray-100 text-gray-800' :
                                    'bg-amber-100 text-amber-800'
                                  }`}>
                                    {position === 1 ? '🏆 Leading' : position === 2 ? '🥈 2nd Place' : '🥉 3rd Place'}
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
          <div className="bg-white rounded-3xl shadow-lg p-8 max-w-2xl mx-auto">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Star className="h-6 w-6 text-yellow-500" />
              <h3 className="text-2xl font-bold text-gray-800">ACK SRC Awards</h3>
              <Star className="h-6 w-6 text-yellow-500" />
            </div>
            <p className="text-gray-600 mb-4">
              Celebrating excellence and leadership in our community
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Live Results</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span>Real-time Updates</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
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
