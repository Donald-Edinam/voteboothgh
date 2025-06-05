import React from 'react';
import { useState, useEffect } from 'react';
import { Phone, Vote, Award, Check, AlertCircle, Star, Trophy, Sparkles, Heart, Zap } from 'lucide-react';

// PocketBase configuration
const PB_URL = 'https://siga-2000.pockethost.io/';
const PAYSTACK_PUBLIC_KEY = 'pk_live_68491193615ecf1c7135b0e4a0db63d90b5148a4'; 

// Fixed PocketBase service
const pocketbaseService = {
  getCategories: async () => {
    try {
      const response = await fetch(`${PB_URL}/api/collections/vote_cat/records`);
      const categoriesData = await response.json();

      const categoriesWithNominees = await Promise.all(
        categoriesData.items.map(async (category) => {
          const nomineesResponse = await fetch(
            `${PB_URL}/api/collections/vote_noms/records?filter=(category='${category.id}')`
          );
          const nomineesData = await nomineesResponse.json();
          
          return {
            id: category.id,
            name: category.name,
            nominees: nomineesData.items || []
          };
        })
      );
      
      return categoriesWithNominees;
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      throw error;
    }
  },

  submitVotes: async (votes, phoneHash, paymentRef) => {
    try {
      const votePromises = votes.map(vote => 
        fetch(`${PB_URL}/api/collections/nom_votes/records`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            nominee: vote.nomineeId,
            category: vote.categoryId,
            phone_hash: phoneHash,
            payment_ref: paymentRef,
          }),
        })
      );

      const results = await Promise.all(votePromises);
      const failedVotes = results.filter(r => !r.ok);
      
      if (failedVotes.length > 0) {
        throw new Error('Some votes failed to submit');
      }

      const votesByNominee = votes.reduce((acc, vote) => {
        acc[vote.nomineeId] = (acc[vote.nomineeId] || 0) + 1;
        return acc;
      }, {});

      const updatePromises = Object.entries(votesByNominee).map(async ([nomineeId, count]) => {
        try {
          const currentResponse = await fetch(`${PB_URL}/api/collections/vote_noms/records/${nomineeId}`);
          
          if (!currentResponse.ok) {
            console.warn(`Failed to fetch nominee ${nomineeId}:`, currentResponse.status);
            return null;
          }
          
          const currentData = await currentResponse.json();
          const newVoteCount = (currentData.votes || 0) + count;
          
          return fetch(`${PB_URL}/api/collections/vote_noms/records/${nomineeId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              votes: newVoteCount,
            }),
          });
        } catch (error) {
          console.error(`Failed to update votes for nominee ${nomineeId}:`, error);
          return null;
        }
      });

      const validUpdatePromises = (await Promise.all(updatePromises)).filter(p => p !== null);
      await Promise.all(validUpdatePromises);
      
      return { success: true, votesSubmitted: votes.length };
    } catch (error) {
      console.error('Failed to submit votes:', error);
      throw error;
    }
  }
};

// Paystack service for Ghana Mobile Money
const paystackService = {
  initializePayment: (amount, phone, email = `${phone}@voting.com`) => {
    return new Promise((resolve, reject) => {
      if (!window.PaystackPop) {
        reject(new Error('Paystack not loaded'));
        return;
      }

      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: email,
        amount: amount * 1, // Convert to kobo
        currency: 'GHS',
        channels: ['mobile_money'],
        metadata: {
          phone: phone,
          custom_fields: [
            {
              display_name: "Phone Number",
              variable_name: "phone_number",
              value: phone
            }
          ]
        },
        callback: function(response) {
          resolve({
            success: true,
            reference: response.reference,
            amount: amount
          });
        },
        onClose: function() {
          reject(new Error('Payment cancelled'));
        }
      });

      handler.openIframe();
    });
  },

  verifyPayment: async (reference) => {
    try {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer sk_test_your_secret_key`,
        }
      });
      const data = await response.json();
      return data.status && data.data.status === 'success';
    } catch (error) {
      console.error('Payment verification failed:', error);
      return false;
    }
  }
};

const VotingSystem = () => {
  const [currentStep, setCurrentStep] = useState('payment');
  const [phone, setPhone] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [votes, setVotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [votesRemaining, setVotesRemaining] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

  const predefinedAmounts = [1, 2, 5, 10];

  // Load Paystack script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep === 'voting') {
      loadCategories();
    }
  }, [currentStep]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await pocketbaseService.getCategories();
      setCategories(data);
      setError('');
    } catch (error) {
      setError('Failed to load categories. Please try again.');
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!selectedAmount) {
      setError('Please select an amount');
      return;
    }

    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }
    
    const phoneRegex = /^(\+233|0)[2-9]\d{8}$/;
    if (!phoneRegex.test(phone)) {
      setError('Please enter a valid Ghana phone number');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const payment = await paystackService.initializePayment(selectedAmount, phone);
      if (payment.success) {
        setPaymentRef(payment.reference);
        setVotesRemaining(selectedAmount);
        setCurrentStep('voting');
      }
    } catch (error) {
      if (error.message === 'Payment cancelled') {
        setError('Payment was cancelled');
      } else {
        setError('Payment failed. Please try again.');
      }
      console.error('Payment failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVoteSelection = (categoryId, nomineeId, action = 'add') => {
    const currentVotes = votes[categoryId] || [];
    
    if (action === 'add' && votesRemaining > 0) {
      setVotes({ ...votes, [categoryId]: [...currentVotes, nomineeId] });
      setVotesRemaining(prev => prev - 1);
    } else if (action === 'remove') {
      const voteIndex = currentVotes.findIndex(v => v === nomineeId);
      if (voteIndex >= 0) {
        const newVotes = [...currentVotes];
        newVotes.splice(voteIndex, 1);
        setVotes({ ...votes, [categoryId]: newVotes });
        setVotesRemaining(prev => prev + 1);
      }
    }
  };

  const submitAllVotes = async () => {
    setLoading(true);
    setError('');
    try {
      const allVotes = Object.entries(votes).flatMap(([categoryId, nomineeIds]) =>
        nomineeIds.map(nomineeId => ({ categoryId, nomineeId }))
      );
      
      const phoneHash = btoa(phone + Date.now().toString()).substring(0, 16);
      
      await pocketbaseService.submitVotes(allVotes, phoneHash, paymentRef);
      setShowCelebration(true);
      setTimeout(() => {
        setCurrentStep('success');
        setShowCelebration(false);
      }, 2000);
    } catch (error) {
      setError('Failed to submit votes. Please try again.');
      console.error('Failed to submit votes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalVotesSelected = () => {
    return Object.values(votes).reduce((total, categoryVotes) => total + categoryVotes.length, 0);
  };

  const getVotesForCategory = (categoryId) => {
    return votes[categoryId] || [];
  };

  const getNomineeImageUrl = (nominee) => {
    if (nominee && nominee.image) {
      return `${PB_URL}/api/files/vote_noms/${nominee.id}/${nominee.image}`;
    }
    return 'https://via.placeholder.com/150'; // Default placeholder image
  };

  const resetApp = () => {
    setCurrentStep('payment');
    setPhone('');
    setSelectedAmount(null);
    setVotes({});
    setVotesRemaining(0);
    setPaymentRef('');
    setError('');
  };

  // Animated background stars
  const AnimatedStars = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 3}s`,
            animationDuration: `${2 + Math.random() * 3}s`
          }}
        >
          <Star className="h-4 w-4 text-yellow-300 opacity-30" />
        </div>
      ))}
    </div>
  );

  // Celebration animation
  const CelebrationOverlay = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-3xl p-8 text-center animate-bounce">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Votes Submitted!</h2>
        <p className="text-gray-600">Thank you for participating!</p>
        <div className="flex justify-center space-x-2 mt-4">
          <Sparkles className="h-6 w-6 text-yellow-500 animate-spin" />
          <Heart className="h-6 w-6 text-red-500 animate-pulse" />
          <Sparkles className="h-6 w-6 text-blue-500 animate-spin" />
        </div>
      </div>
    </div>
  );

  // Enhanced Error Alert Component
  const ErrorAlert = ({ message }) => (
    <div className="bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-2xl p-4 mb-6 flex items-center animate-pulse">
      <div className="bg-red-100 rounded-full p-2 mr-3">
        <AlertCircle className="h-5 w-5 text-red-600" />
      </div>
      <div>
        <p className="text-red-800 font-medium">Oops!</p>
        <p className="text-red-700 text-sm">{message}</p>
      </div>
    </div>
  );

  // Payment Step
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 relative overflow-hidden">
        <AnimatedStars />
        
        {/* Floating elements */}
        <div className="absolute top-20 left-10 animate-float">
          <Trophy className="h-16 w-16 text-yellow-300 opacity-20" />
        </div>
        <div className="absolute top-40 right-20 animate-bounce">
          <Award className="h-12 w-12 text-white opacity-20" />
        </div>
        <div className="absolute bottom-20 left-20 animate-pulse">
          <Star className="h-20 w-20 text-yellow-200 opacity-15" />
        </div>
        
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 w-full max-w-md transform hover:scale-105 transition-transform duration-300">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-r from-green-400 to-blue-500 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                <Vote className="h-10 w-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
                Ghana Awards
              </h1>
              <p className="text-gray-600 mt-2 font-medium">Make your voice heard! 🗳️</p>
              <div className="bg-gradient-to-r from-green-100 to-blue-100 rounded-full px-4 py-2 mt-3 inline-block">
                <p className="text-sm font-bold text-green-700">💰 1 Cedi = 1 Vote</p>
              </div>
            </div>
            
            {error && <ErrorAlert message={error} />}
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3 flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-blue-500" />
                  Phone Number (secure payment only)
                </label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-4 h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 XX XXX XXXX"
                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all duration-200 bg-gray-50 focus:bg-white"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 flex items-center">
                  🔒 Your privacy is protected - phone only for payment
                </p>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-700 mb-4 flex items-center">
                  <Zap className="h-4 w-4 mr-2 text-yellow-500" />
                  Choose Your Power:
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {predefinedAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      className={`p-6 rounded-2xl border-3 transition-all duration-300 transform hover:scale-105 ${
                        selectedAmount === amount
                          ? 'border-gradient-to-r from-green-400 to-blue-500 bg-gradient-to-r from-green-50 to-blue-50 shadow-lg scale-105'
                          : 'border-gray-200 hover:border-blue-300 hover:shadow-md bg-white'
                      }`}
                    >
                      <div className="text-2xl font-bold text-gray-800">₵{amount}</div>
                      <div className="text-sm text-gray-600 font-medium">
                        {amount} vote{amount > 1 ? 's' : ''}
                      </div>
                      {selectedAmount === amount && (
                        <div className="text-xs text-green-600 font-bold mt-1">✨ Selected!</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  <Phone className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-800">Mobile Money Ready!</p>
                  <p className="text-xs text-blue-700">MTN • Telecel • AirtelTigo</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handlePayment}
              disabled={loading || !selectedAmount || !phone.trim()}
              className="w-full mt-6 bg-gradient-to-r from-green-500 to-blue-600 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-green-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  🚀 Pay ₵{selectedAmount || 0} & Start Voting!
                </span>
              )}
            </button>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500 flex items-center justify-center">
                <span className="text-green-500 mr-1">🔐</span>
                100% anonymous voting • Secure payment • Your voice matters
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Voting Step
  if (currentStep === 'voting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-400 to-red-400 relative overflow-hidden">
        <AnimatedStars />
        
        {showCelebration && <CelebrationOverlay />}
        
        <div className="max-w-6xl mx-auto p-4 relative z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 sticky top-4 z-20">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Cast Your Votes! ✨
                </h1>
                <p className="text-gray-600 mt-1">Your voice shapes the future</p>
              </div>
              <div className="text-right">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-2xl">
                  <div className="text-2xl font-bold">{votesRemaining}</div>
                  <div className="text-sm opacity-90">votes left</div>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {getTotalVotesSelected()} votes locked in 🎯
                </div>
              </div>
            </div>
          </div>

          {error && <ErrorAlert message={error} />}

          {loading ? (
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-12 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto mb-6"></div>
              <p className="text-xl font-medium text-gray-700">Loading the stage... 🎭</p>
              <p className="text-gray-500 mt-2">Preparing nominees for you</p>
            </div>
          ) : (
            <div className="space-y-8">
              {categories.map((category, categoryIndex) => (
                <div 
                  key={category.id} 
                  className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 transform hover:scale-[1.02] transition-all duration-300"
                  style={{ animationDelay: `${categoryIndex * 0.1}s` }}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full p-3 mr-4">
                        <Award className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{category.name}</h2>
                        <p className="text-gray-600">Choose your champions</p>
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-2 rounded-full">
                      <span className="text-purple-800 font-bold">
                        {getVotesForCategory(category.id).length} selected ⚡
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid gap-4">
                    {category.nominees.map((nominee, nomineeIndex) => {
                      const voteCount = getVotesForCategory(category.id).filter(id => id === nominee.id).length;
                      
                      return (
                        <div
                          key={nominee.id}
                          className={`p-6 rounded-2xl border-2 transition-all duration-300 transform hover:scale-[1.02] ${
                            voteCount > 0
                              ? 'border-purple-400 bg-gradient-to-r from-purple-50 to-pink-50 shadow-lg'
                              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-md'
                          }`}
                          style={{ animationDelay: `${nomineeIndex * 0.05}s` }}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1 flex items-center space-x-6">
                              <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full overflow-hidden ring-4 ring-white shadow-lg">
                                  <img
                                    src={getNomineeImageUrl(nominee)}
                                    alt={`${nominee.name}'s photo`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                {voteCount > 0 && (
                                  <div className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold animate-pulse">
                                    {voteCount}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="font-bold text-xl text-gray-900 mb-1">{nominee.name}</div>
                                <div className="flex items-center text-gray-600">
                                  <Trophy className="h-4 w-4 mr-1 text-yellow-500" />
                                  <span className="text-sm">
                                    {(nominee.votes || 0) + voteCount} total votes
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              {voteCount > 0 && (
                                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full font-bold animate-pulse">
                                  ⚡ {voteCount} vote{voteCount > 1 ? 's' : ''}
                                </div>
                              )}
                              
                              <div className="flex items-center space-x-2 bg-gray-100 rounded-full p-1">
                                <button
                                  onClick={() => handleVoteSelection(category.id, nominee.id, 'remove')}
                                  disabled={voteCount === 0}
                                  className="w-10 h-10 rounded-full bg-gradient-to-r from-red-400 to-red-500 text-white hover:from-red-500 hover:to-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center font-bold text-lg transform hover:scale-110"
                                >
                                  −
                                </button>
                                
                                <span className="w-12 text-center font-bold text-lg text-gray-700 bg-white rounded-full py-2">
                                  {voteCount}
                                </span>
                                
                                <button
                                  onClick={() => handleVoteSelection(category.id, nominee.id, 'add')}
                                  disabled={votesRemaining <= 0}
                                  className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center font-bold text-lg transform hover:scale-110"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {getTotalVotesSelected() > 0 && (
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mt-8 sticky bottom-4">
              <div className="text-center mb-4">
                <p className="text-lg font-medium text-gray-700">
                  Ready to make history? 🚀
                </p>
                <p className="text-gray-600">
                  {getTotalVotesSelected()} votes ready to be cast anonymously
                </p>
              </div>
              <button
                onClick={submitAllVotes}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 text-white py-6 px-8 rounded-2xl font-bold text-xl hover:from-purple-600 hover:via-pink-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-2xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                    Casting your votes... ✨
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    🎉 Submit {getTotalVotesSelected()} Vote{getTotalVotesSelected() > 1 ? 's' : ''} Now!
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Success Step
  if (currentStep === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500 relative overflow-hidden">
        <AnimatedStars />
        
        {/* Floating celebration elements */}
        <div className="absolute top-20 left-10 animate-bounce" style={{ animationDelay: '0.2s' }}>
          <div className="text-4xl">🎉</div>
        </div>
        <div className="absolute top-32 right-16 animate-bounce" style={{ animationDelay: '0.8s' }}>
          <div className="text-3xl">🏆</div>
        </div>
        <div className="absolute bottom-32 left-20 animate-bounce" style={{ animationDelay: '1.2s' }}>
          <div className="text-3xl">⭐</div>
        </div>
        <div className="absolute bottom-20 right-10 animate-bounce" style={{ animationDelay: '0.5s' }}>
          <div className="text-4xl">🎊</div>
        </div>
        
        <div className="flex items-center justify-center min-h-screen p-4 relative z-10">
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 w-full max-w-lg text-center transform hover:scale-105 transition-all duration-300">
            <div className="relative">
              <div className="mx-auto w-24 h-24 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-8 animate-pulse">
                <Check className="h-12 w-12 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 animate-spin">
                <Sparkles className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            
            <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-4">
              Mission Accomplished! 🚀
            </h1>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Fantastic! Your {getTotalVotesSelected()} vote{getTotalVotesSelected() > 1 ? 's have' : ' has'} been securely recorded. 
              You've just shaped the future of Ghana's awards! 🌟
            </p>
            
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-6 mb-8 border-2 border-gray-100">
              <div className="flex items-center justify-center mb-3">
                <div className="bg-blue-100 rounded-full p-2 mr-2">
                  <Trophy className="h-5 w-5 text-blue-600" />
                </div>
                <p className="font-bold text-gray-800">Payment Confirmation</p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Reference Number:</p>
                <p className="font-mono text-sm bg-gray-100 px-3 py-2 rounded border break-all">
                  {paymentRef}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-3 flex items-center justify-center">
                <span className="text-green-500 mr-1">🔒</span>
                Keep this for your records
              </p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Heart className="h-5 w-5 text-red-500" />
                <span>Your voice matters</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Star className="h-5 w-5 text-yellow-500" />
                <span>100% anonymous & secure</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-600">
                <Zap className="h-5 w-5 text-blue-500" />
                <span>Making Ghana proud</span>
              </div>
            </div>
            
            <button
              onClick={resetApp}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 px-8 rounded-2xl font-bold text-lg hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg"
            >
              <span className="flex items-center justify-center">
                🗳️ Vote Again & Support More!
              </span>
            </button>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200">
              <p className="text-sm text-yellow-800 font-medium">
                💡 Spread the word! Tell your friends to vote and make their voices heard too!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Add custom CSS animations
const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
  
  @keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default VotingSystem;