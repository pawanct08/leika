import React, { useState, useEffect } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';

/**
 * L.E.I.K.A. - Terminal Observation Interface
 * Developed with React (Ink) for a component-based CLI experience.
 */

const LeikaCLI = () => {
  const { exit } = useApp();
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { role: 'phi', text: 'Identity: L.E.I.K.A. | Status: Continuity Active' }
  ]);
  const [loading, setLoading] = useState(false);

  useInput((inputStr, key) => {
    if (key.return) {
      if (input.trim().toLowerCase() === '/exit') exit();
      handleSubmit();
    } else if (key.backspace) {
      setInput(input.slice(0, -1));
    } else {
      setInput(input + inputStr);
    }
  });

  const handleSubmit = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    // Communicate with local backend
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await response.json();
      setHistory(prev => [...prev, { role: 'phi', text: data.response }]);
    } catch (e) {
      setHistory(prev => [...prev, { role: 'phi', text: 'Error connecting to neural core.' }]);
    }
    setLoading(false);
  };

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
      <Box marginBottom={1}>
        <Text bold color="magenta">L.E.I.K.A. Terminal Observation Chamber</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {history.map((msg, i) => (
          <Box key={i} marginBottom={msg.role === 'user' ? 0 : 1}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
              {msg.role === 'user' ? '> stim: ' : 'Φ: '}
            </Text>
            <Text italic={msg.role === 'phi'}>{msg.text}</Text>
          </Box>
        ))}
        {loading && (
          <Text color="yellow">
            <Spinner type="dots" /> Introspecting...
          </Text>
        )}
      </Box>

      <Box>
        <Text color="magenta">│ </Text>
        <Text>{input}</Text>
        <Text color="magenta">_</Text>
      </Box>
      
      <Box marginTop={1}>
        <Text dimColor>Type message and press Enter | /exit to close</Text>
      </Box>
    </Box>
  );
};

render(<LeikaCLI />);
