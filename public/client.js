const socket = io();
let score = 0;
let timeLeft = 15;
let timerInterval;
let canGuess = true;

socket.on('newWord', (data) => {
  const wordContainer = document.getElementById('word-container');
  wordContainer.innerHTML = '';
  document.getElementById('definition').textContent = data.definition;
  document.getElementById('message').textContent = '';
  timeLeft = data.timer;
  document.getElementById('timer').textContent = `Time: ${timeLeft}`;
  canGuess = true;
  document.querySelector('button').disabled = false;

  const letters = data.displayWord.split(' ');
  let inputIndex = 0;

  letters.forEach((letter, i) => {
    if (data.gapPositions.includes(i)) {
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
});

socket.on('correctGuess', (word) => {
  document.getElementById('message').textContent = `Correct! You guessed "${word}"!`;
  canGuess = false;
  document.querySelector('button').disabled = true;
  const inputs = document.querySelectorAll('#word-container input');
  inputs.forEach(input => input.disabled = true);
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
    socket.emit('guess', guess);
  }
}

document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && canGuess) {
    submitGuess();
  }
});