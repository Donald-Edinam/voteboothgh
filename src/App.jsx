import React from 'react';
import VotingSystem from './components/VotingSystem';
import ResultsDisplay from './components/ResultsDisplay';

const App = () => {
  // Voting deadline: June 23, 2025, 11:59 PM
  const votingDeadline = new Date('2025-06-23T23:59:59');
  const now = new Date();
  const isVotingClosed = now > votingDeadline;

  if (isVotingClosed) {
    return (
      <ResultsDisplay />
    );
  }

  return <VotingSystem />;
}

export default App;
