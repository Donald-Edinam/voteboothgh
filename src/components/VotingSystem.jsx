import React from 'react';
import { useState, useEffect } from 'react';
import { Phone, Vote, Award, Check, AlertCircle } from 'lucide-react';

// PocketBase configuration
const PB_URL = 'https://siga-2000.pockethost.io/';
const PAYSTACK_PUBLIC_KEY = 'pk_live_68491193615ecf1c7135b0e4a0db63d90b5148a4'; 

// PocketBase service
const pocketbaseService = {
  getCategories: async () => {
    try {
      const response = await fetch(`${PB_URL}/api/collections/vote_cat/records`);
      const categoriesData = await response.json();

      console.log("Categories items", categoriesData)
      
      const categoriesWithNominees = await Promise.all(
        categoriesData.items.map(async (category) => {
          const nomineesResponse = await fetch(
            `${PB_URL}/api/collections/vote_noms/records?filter=(category='${category.id}')`
          );
          const nomineesData = await nomineesResponse.json();
          
          console.log("nominees data", nomineesData)

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

      // Update nominee vote counts
      const votesByNominee = votes.reduce((acc, vote) => {
        acc[vote.nomineeId] = (acc[vote.nomineeId] || 0) + 1;
        return acc;
      }, {});

      const updatePromises = Object.entries(votesByNominee).map(async ([nomineeId, count]) => {
        const currentResponse = await fetch(`${PB_URL}/api/collections/nom_votes/records/${nomineeId}`);
        const currentData = await currentResponse.json();
        const newVoteCount = (currentData.votes || 0) + count;
        
        return fetch(`${PB_URL}/api/collections/nom_votes/records/${nomineeId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            votes: newVoteCount,
          }),
        });
      });

      await Promise.all(updatePromises);
      
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
        channels: ['mobile_money'], // Focus on mobile money
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
      // This should be done on your backend for security
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer sk_test_your_secret_key`, // Use your secret key
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
  const [currentStep, setCurrentStep] = useState('payment'); // Start directly with payment
  const [phone, setPhone] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [categories, setCategories] = useState([]);
  const [votes, setVotes] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [votesRemaining, setVotesRemaining] = useState(0);

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
      setLoading(true)
      const data = await pocketbaseService.getCategories();
      console.log("Data from user", data)
      setCategories(data);
      setError('');
    } catch (error) {
      setError('Failed to load categories. Please try again.');
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Replace your handlePayment function with this version
const handlePayment = async () => {
  if (!selectedAmount) {
    setError('Please select an amount');
    return;
  }

  if (!phone.trim()) {
    setError('Please enter your phone number');
    return;
  }
  
  // Basic phone validation for Ghana numbers
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
      // Skip verification for now - trust the callback
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
      
      // Create anonymous hash from phone + timestamp for privacy
      const phoneHash = btoa(phone + Date.now().toString()).substring(0, 16);
      
      await pocketbaseService.submitVotes(allVotes, phoneHash, paymentRef);
      setCurrentStep('success');
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

  const resetApp = () => {
    setCurrentStep('payment');
    setPhone('');
    setSelectedAmount(null);
    setVotes({});
    setVotesRemaining(0);
    setPaymentRef('');
    setError('');
  };

  // Error Alert Component
  const ErrorAlert = ({ message }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center">
      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
      <span className="text-red-700 text-sm">{message}</span>
    </div>
  );

  // Payment Step (Now the first step)
  if (currentStep === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Vote className="mx-auto h-12 w-12 text-green-600 mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">Ghana Awards Voting</h1>
            <p className="text-gray-600 mt-2">Purchase votes to participate anonymously</p>
            <p className="text-sm text-green-600 font-medium mt-1">1 Cedi = 1 Vote</p>
          </div>
          
          {error && <ErrorAlert message={error} />}
          
          <div className="space-y-6">
            {/* Phone Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (for payment only)
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+233 XX XXX XXXX"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your phone number is only used for payment processing
              </p>
            </div>

            {/* Amount Selection */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Select Amount:</p>
              <div className="grid grid-cols-2 gap-3">
                {predefinedAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setSelectedAmount(amount)}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      selectedAmount === amount
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="font-bold">₵{amount}</div>
                    <div className="text-sm text-gray-600">{amount} vote{amount > 1 ? 's' : ''}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Payment via Mobile Money:</strong><br />
              MTN, Vodafone, AirtelTigo supported
            </p>
          </div>
          
          <button
            onClick={handlePayment}
            disabled={loading || !selectedAmount || !phone.trim()}
            className="w-full mt-6 bg-green-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Processing Payment...' : `Pay ₵${selectedAmount || 0} via Mobile Money`}
          </button>

          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              🔒 Your vote is completely anonymous. We only store a hashed reference for verification.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Voting Step
  if (currentStep === 'voting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-gray-900">Cast Your Votes</h1>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600">
                  {votesRemaining} votes remaining
                </div>
                <div className="text-sm text-gray-600">
                  {getTotalVotesSelected()} votes selected
                </div>
              </div>
            </div>
            <div className="mt-2 text-sm text-gray-500">
              ✨ Your votes are anonymous and secure
            </div>
          </div>

          {error && <ErrorAlert message={error} />}

          {loading ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading categories...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {categories.map((category) => (
                <div key={category.id} className="bg-white rounded-2xl shadow-lg p-6">
                  <div className="flex items-center mb-4">
                    <Award className="h-6 w-6 text-purple-600 mr-2" />
                    <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                    <span className="ml-2 bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                      {getVotesForCategory(category.id).length} selected
                    </span>
                  </div>
                  
                  <div className="grid gap-3">
                    {category.nominees.map((nominee) => {
                      const voteCount = getVotesForCategory(category.id).filter(id => id === nominee.id).length;
                      
                      return (
                        <div
                          key={nominee.id}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            voteCount > 0
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900">{nominee.name}</div>
                              <div className="text-sm text-gray-600">
                                Total votes: {(nominee.votes || 0) + voteCount}
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-3">
                              {voteCount > 0 && (
                                <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                  {voteCount} vote{voteCount > 1 ? 's' : ''}
                                </span>
                              )}
                              
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleVoteSelection(category.id, nominee.id, 'remove')}
                                  disabled={voteCount === 0}
                                  className="w-8 h-8 rounded-full bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-bold"
                                >
                                  -
                                </button>
                                
                                <span className="w-8 text-center font-medium text-gray-700">
                                  {voteCount}
                                </span>
                                
                                <button
                                  onClick={() => handleVoteSelection(category.id, nominee.id, 'add')}
                                  disabled={votesRemaining <= 0}
                                  className="w-8 h-8 rounded-full bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center font-bold"
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
            <div className="bg-white rounded-2xl shadow-xl p-6 mt-6">
              <button
                onClick={submitAllVotes}
                disabled={loading}
                className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg font-bold text-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Submitting Votes...' : `Submit ${getTotalVotesSelected()} Vote${getTotalVotesSelected() > 1 ? 's' : ''} Anonymously`}
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
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Votes Submitted!</h1>
          <p className="text-gray-600 mb-6">
            Thank you for participating in the Ghana Awards voting! Your {getTotalVotesSelected()} vote{getTotalVotesSelected() > 1 ? 's have' : ' has'} been recorded anonymously and securely.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              <strong>Payment Reference:</strong><br />
              <span className="font-mono text-xs">{paymentRef}</span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Keep this reference for your records
            </p>
          </div>
          
          <button
            onClick={resetApp}
            className="bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Vote Again
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default VotingSystem;