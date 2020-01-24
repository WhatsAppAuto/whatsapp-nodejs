const WebSocket = require("ws");
const { log } = require("../utils");

/**
 * WebSocketService.
 * @author krthr
 */
class WebSocketService {
  constructor() {
    this.ws = new WebSocket("wss://web.whatsapp.com/ws", {
      headers: {
        Origin: "https://web.whatsapp.com"
      }
    });
  }

  /**
   *
   * @param {'close' | 'error' | 'open' | 'message'} ev
   * @param {callback} fn
   */
  on(ev, fn) {
    this.ws.on(ev, (...args) => {
      fn(...args);
    });
  }

  /**
   *
   * @param {any} data
   */
  send(data) {
    log("SEND", data);
    this.ws.send(data);
  }
}

module.exports = WebSocketService;
