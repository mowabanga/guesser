const socket = io();

socket.on('adminStats', (data) => {
  // Update total players
  document.getElementById('total-players').textContent = 
    `Total Players Ever: ${data.totalPlayers}`;

  // Update active players table
  const activeList = document.getElementById('active-list');
  if (data.activePlayers.length === 0) {
    activeList.innerHTML = '<tr><td colspan="2">No active players</td></tr>';
  } else {
    activeList.innerHTML = data.activePlayers
      .map(([id, score]) => `<tr><td>${id.slice(0, 8)}</td><td>${score}</td></tr>`)
      .join('');
  }
});