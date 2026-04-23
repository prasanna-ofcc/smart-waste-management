const { WebSocketServer } = require('ws');

function createRealtime(server) {
  const wss = new WebSocketServer({ server });
  const clients = new Set();

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => ws.close());
  });

  function broadcast(payload) {
    const message = JSON.stringify(payload);
    for (const ws of clients) {
      if (ws.readyState === 1) {
        ws.send(message);
      }
    }
  }

  return { broadcast };
}

module.exports = { createRealtime };
