const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

// Basic auth middleware for admin route
const adminAuth = basicAuth({
  users: { 'admin': 'supersecret' }, // Username: admin, Password: supersecret
  challenge: true, // Prompt for credentials
  unauthorizedResponse: 'Unauthorized - Admin access only'
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

let currentWord = '';
let missingIndices = new Set();
let wordGuessed = false;
const activePlayers = new Map();
const totalPlayers = new Set();

async function fetchRandomWordWithDefinition() {
  let word, definition;
  let attempts = 0;
  const maxAttempts = 5;

  do {
    try {
      const wordResponse = await fetch('https://random-word-api.herokuapp.com/word');
      if (!wordResponse.ok) throw new Error('Word fetch failed');
      [word] = await wordResponse.json();

      const defResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (!defResponse.ok) throw new Error('Definition fetch failed');
      const data = await defResponse.json();
      if (data[0] && data[0].meanings[0] && data[0].meanings[0].definitions[0]) {
        definition = data[0].meanings[0].definitions[0].definition;
      } else {
        throw new Error('No definition available');
      }
    } catch (error) {
      console.error(`Attempt ${attempts + 1} failed for "${word || 'unknown'}":`, error.message);
      word = null;
      definition = null;
    }
    attempts++;
  } while (!word && attempts < maxAttempts);

  if (!word) {
    console.error('Failed to find a word with definition after max attempts');
    return { word: 'error', definition: 'A common English word' };
  }

  return { word, definition };
}

function createGappedWord(word) {
  const letters = word.split('');
  const gapCount = Math.floor(letters.length / 2);
  missingIndices = new Set();
  
  while (missingIndices.size < gapCount) {
    const index = Math.floor(Math.random() * letters.length);
    if (index !== 0 && index !== letters.length - 1) {
      missingIndices.add(index);
    }
  }
  
  return {
    display: letters.map((letter, i) => missingIndices.has(i) ? '_' : letter).join(' '),
    gaps: Array.from(missingIndices)
  };
}

function getMissingLetters(word) {
  return word.split('').filter((_, i) => missingIndices.has(i)).join('');
}

async function startGame() {
  const { word, definition } = await fetchRandomWordWithDefinition();
  currentWord = word;
  wordGuessed = false;
  const { display, gaps } = createGappedWord(currentWord);
  console.log(`New word: ${currentWord}, Gapped: ${display}, Definition: ${definition}`);
  io.emit('newWord', { 
    displayWord: display, 
    definition: definition, 
    timer: 15,
    gapPositions: gaps
  });
  io.emit('playerList', Array.from(activePlayers.entries()));
  io.emit('adminStats', { 
    activePlayers: Array.from(activePlayers.entries()), 
    totalPlayers: totalPlayers.size 
  });
}

io.on('connection', (socket) => {
  activePlayers.set(socket.id, 0);
  totalPlayers.add(socket.id);
  console.log('New player connected:', socket.id);
  io.emit('playerList', Array.from(activePlayers.entries()));
  io.emit('adminStats', { 
    activePlayers: Array.from(activePlayers.entries()), 
    totalPlayers: totalPlayers.size 
  });
  
  socket.on('guess', (guess) => {
    if (wordGuessed) return;
    const missingLetters = getMissingLetters(currentWord);
    if (guess.toLowerCase() === missingLetters.toLowerCase()) {
      wordGuessed = true;
      socket.emit('correctGuess', currentWord);
      io.emit('winner', { playerId: socket.id, word: currentWord });
      const newScore = (activePlayers.get(socket.id) || 0) + 1;
      activePlayers.set(socket.id, newScore);
      socket.emit('scoreUpdate', newScore);
      io.emit('playerList', Array.from(activePlayers.entries()));
      io.emit('adminStats', { 
        activePlayers: Array.from(activePlayers.entries()), 
        totalPlayers: totalPlayers.size 
      });
    } else {
      io.emit('wrongGuess', { playerId: socket.id, guess: guess });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    activePlayers.delete(socket.id);
    io.emit('playerList', Array.from(activePlayers.entries()));
    io.emit('adminStats', { 
      activePlayers: Array.from(activePlayers.entries()), 
      totalPlayers: totalPlayers.size 
    });
  });
});

let gameInterval;
if (!gameInterval) {
  gameInterval = setInterval(startGame, 15000);
  startGame();
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});