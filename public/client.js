const socket = io();
let score = 0;
let timeLeft = 15;
let timerInterval;
let canGuess = true;
let currentWord = '';

async function fetchWord() {
  try {
    const wordRes = await fetch('https://random-word-api.herokuapp.com/word');
    const [word] = await wordRes.json();
    const defRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await defRes.json();
    if (data[0]?.meanings[0]?.definitions[0]) {
      return { word, definition: data[0].meanings[0].definitions[0].definition };
    }
    throw new Error('No definition');
  } catch (error) {
    console.error('Fetch error:', error);
    return { word: 'error', definition: 'A common English word' }; // Fallback
  }
}

function createGappedWord(word) {
  const letters = word.split('');
  const gapCount = Math.floor(letters.length / 2);
  const missingIndices = new Set();
  while (missingIndices.size < gapCount) {
    const index = Math.floor(Math.random() * letters.length);
    if (index !== 0 && index !== letters.length - 1) missingIndices.add(index);
  }
  return {
    display: letters.map((letter, i) => missingIndices.has(i) ? '_' : letter).join(' '),
    gaps: Array.from(missingIndices)
  };
}

async function startRound() {
  canGuess = true;
  document.querySelector('button').disabled = false;
  const { word, definition } = await fetchWord();
  currentWord = word;
  const { display, gaps } = createGappedWord(word);
  const wordContainer = document.getElementById('word-container');
  wordContainer.innerHTML = '';
  document.getElementById('definition').textContent = definition;
  document.getElementById('message').textContent = '';
  timeLeft = 15;
  document.getElementById('timer').textContent = `Time: ${timeLeft}`;

  const letters = display.split(' ');
  let inputIndex = 0;
  letters.forEach((letter, i) => {
    if (gaps.includes(i)) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 1;
      input.dataset.index = inputIndex++;
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1 && i < letters.length - 1) {
          const nextInput = wordContainer.querySelector(`input[data-index="${parseInt(e.target.dataset.index) + 1}"]`);
          if (nextInput) nextInput.focus();
        }
      });
      wordContainer.appendChild(input);
    } else {
      const span = document.createElement('span');
      span.textContent = letter;
      wordContainer.appendChild(span);
    }
  });

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timeLeft--;
    document.getElementById('timer').textContent = `Time: ${timeLeft}`;
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      canGuess = false;
      document.querySelector('button').disabled = true;
    }
  }, 1000);
}

socket.on('correctGuess', (word) => {
  document.getElementById('message').textContent = `Correct! You guessed "${word}"!`;
  canGuess = false;
  document.querySelector('button').disabled = true;
  document.querySelectorAll('#word-container input').forEach(input => input.disabled = true);
});

socket.on('winner', (data) => {
  if (data.playerId !== socket.id) {
    document.getElementById('message').textContent = `Someone won with "${data.word}"!`;
  }
});

socket.on('wrongGuess', (data) => {
  document.getElementById('message').textContent = 
    `${data.playerId === socket.id ? 'Your' : 'Someone\'s'} guess "${data.guess}" was wrong!`;
});

socket.on('scoreUpdate', (newScore) => {
  score = newScore;
  document.getElementById('score').textContent = `Score: ${score}`;
});

socket.on('playerList', (players) => {
  const playerList = document.getElementById('players-list');
  playerList.innerHTML = '<strong>Active Players:</strong><br>' + 
    players.map(([id, score]) => `${id.slice(0, 5)}...: ${score}`).join('<br>');
});

function submitGuess() {
  if (!canGuess) return;
  const inputs = document.querySelectorAll('#word-container input');
  const guess = Array.from(inputs).map(input => input.value).join('');
  if (guess.length === inputs.length) {
    socket.emit('guess', { word: currentWord, guess });
  }
}

document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && canGuess) submitGuess();
});

setInterval(startRound, 15000); // Start game loop
startRound(); // Initial round