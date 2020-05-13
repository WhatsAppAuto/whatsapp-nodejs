const { Server } = require("ws");
const WhatsApp = require("./whatsapp");
const { generateRandomBytes } = require("./crypto");

const wss = new Server({
  port: 4444,
});

wss.on("connection", (ws) => {
  const id = generateRandomBytes(10);
  const whatsapp = new WhatsApp();

  const send = (c, d) => ws.send(JSON.stringify({ c, d }));

  send(0, id);

  whatsapp.on("message", (msg) => send(3, msg));
  whatsapp.on("qr-code", (qrCode) => send(1, qrCode));
  whatsapp.on("logged-in", () => send(2, true));

  whatsapp.start();

  ws.on("message", (message) => {
    // TODO
  });

  ws.on("close", () => {
    whatsapp.ws.close();
  });
});
