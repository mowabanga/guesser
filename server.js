const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const basicAuth = require('express-basic-auth');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', basicAuth({ users: { 'admin': 'supersecret' }, challenge: true, unauthorizedResponse: 'Unauthorized - Admin access only' }), 
  (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const activePlayers = new Map();
const totalPlayers = new Set();

io.on('connection', (socket) => {
  activePlayers.set(socket.id, 0);
  totalPlayers.add(socket.id);
  console.log('New player connected:', socket.id);
  io.emit('playerList', Array.from(activePlayers.entries()));
  io.emit('adminStats', { activePlayers: Array.from(activePlayers.entries()), totalPlayers: totalPlayers.size });

  socket.on('guess', ({ word, guess }) => {
    if (!word || activePlayers.get(socket.id) === -1) return; // -1 indicates already guessed correctly
    const missingLetters = word.split('').filter((_, i) => word.split(' ').join('').split('_').length - 1 === guess.length && i in missingIndices).join('');
    if (guess.toLowerCase() === missingLetters.toLowerCase()) {
      activePlayers.set(socket.id, (activePlayers.get(socket.id) || 0) + 1);
      activePlayers.set(socket.id, -1); // Mark as guessed
      socket.emit('correctGuess', word);
      io.emit('winner', { playerId: socket.id, word });
      io.emit('playerList', Array.from(activePlayers.entries()));
      io.emit('adminStats', { activePlayers: Array.from(activePlayers.entries()), totalPlayers: totalPlayers.size });
    } else {
      io.emit('wrongGuess', { playerId: socket.id, guess });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    activePlayers.delete(socket.id);
    io.emit('playerList', Array.from(activePlayers.entries()));
    io.emit('adminStats', { activePlayers: Array.from(activePlayers.entries()), totalPlayers: totalPlayers.size });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));