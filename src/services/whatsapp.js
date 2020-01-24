const WebSocketService = require("./ws");
const cryptoService = require("./crypto");
const { log, showQRCode } = require("../utils");

/**
 * WhatsApp Service
 *
 * @author krthr
 */
class WhatsAppService {
  constructor() {
    this.connectionOpts = {
      clientToken: null,
      serverId: null,
      serverToken: null,
      browserToken: null,
      me: null,
      secret: null,
      sharedSecret: null,
      secretPublicKey: null,
      sharedSecretExpanded: null
    };

    this.loginInfo = {
      clientId: null,
      serverRef: null,
      publicKey: null,
      secretKey: null,
      key: {
        encKey: null,
        macKey: null
      }
    };

    this.messagesQueue = {};
  }

  /**
   * Send a "ping" message every 25 seconds.
   */
  ping() {
    setTimeout(() => this.ws.send("?,,") && this.ping(), 25000);
  }

  /**
   * Handle a received message.
   * @param {String | Buffer} message
   */
  handleMessage(message = "") {
    let tag, content;
    const isMessageBuffer = typeof message !== "string";

    if (!isMessageBuffer) {
      [tag, ...content] = message.split(",");
      content = content.join();
    } else {
      [tag] = message.toString().split(",");
      content = message.slice(tag.length + 1);
    }

    if (this.messagesQueue[tag]) {
      // the server responds to a client's message

      const pend = this.messagesQueue[tag];

      switch (pend.desc) {
        case "_login": {
          this.generateQR(content);
          break;
        }
        case "_status": // TODO
          break;

        case "_restoresession": // TODO
          break;
      }
    } else {
      if (!isMessageBuffer && content) {
        const obj = JSON.parse(content);

        if (obj.length) {
          // JSON content

          const [name, payload] = obj;

          switch (name) {
            case "Conn": {
              this.ping();
              this.processConn(payload);
              break;
            }
            case "Stream": {
              break;
            }
            case "Props": {
              break;
            }
          }
        }
      } else {
        if (content !== "") {
          message = cryptoService.toArrayBuffer(message);

          let ba = cryptoService.sjcl.bitArray;
          let delimPos = new Uint8Array(message).indexOf(44); //look for index of comma because there is a message tag before it
          let messageContent = cryptoService.sjcl.codec.arrayBuffer.toBits(
            message.slice(delimPos + 1)
          );
          let hmacValidation = cryptoService.HmacSha256(
            this.loginInfo.key.macKey,
            cryptoService.ba.bitSlice(messageContent, 32 * 8)
          );
          if (
            !cryptoService.sjcl.bitArray.equal(
              hmacValidation,
              cryptoService.ba.bitSlice(messageContent, 0, 32 * 8)
            )
          ) {
            throw [
              "hmac mismatch",
              cryptoService.sjcl.codec.hex.fromBits(hmacValidation),
              cryptoService.sjcl.codec.hex.fromBits(
                ba.bitSlice(messageContent, 0, 32 * 8)
              )
            ];
          }

          let data = cryptoService.AESDecrypt(
            this.loginInfo.key.encKey,
            cryptoService.ba.bitSlice(messageContent, 32 * 8)
          );

          console.log(
            "got binary data: ",
            String.fromCharCode.apply(
              null,
              new Uint8Array(
                cryptoService.sjcl.codec.arrayBuffer.fromBits(data, 0)
              )
            )
          );
        }
      }
    }
  }

  /**
   * Generate the QR image.
   *
   * 1. Get the `serverRef` from the content of the response
   * 2. Generate public and secret keys
   * 3. Concatenate the following values with comma:
   *    - serverRef
   *    - `Base64(publicKey)`
   *    - clientId
   *
   * @param {String} content
   */
  generateQR(content) {
    this.loginInfo.serverRef = JSON.parse(content).ref;

    const {
      public: publicKey,
      private: privateKey
    } = cryptoService.generateKeyPair();

    this.loginInfo["secretKey"] = privateKey;
    this.loginInfo["publicKey"] = publicKey;

    const qrCodeText = [
      this.loginInfo.serverRef,
      Buffer.from(publicKey).toString("base64"),
      this.loginInfo.clientId
    ].join(",");

    showQRCode(qrCodeText);
  }

  /**
   *
   * @param {Object} obj
   */
  processConn({
    browserToken,
    clientToken,
    secret,
    serverToken,
    sharedSecret,
    wid
  }) {
    this.connectionOpts.clientToken = clientToken;
    this.connectionOpts.serverToken = serverToken;
    this.connectionOpts.browserToken = browserToken;
    this.connectionOpts.me = wid;

    this.connectionOpts.secret = cryptoService.base64ToBitArray(secret);
    this.connectionOpts.secretPublicKey = cryptoService.generateSecreyPublicKey(
      this.connectionOpts.secret
    );
    this.connectionOpts.sharedSecret = cryptoService.generateSharedSecret(
      this.loginInfo.secretKey,
      this.connectionOpts.secretPublicKey
    );
    this.connectionOpts.sharedSecretExpanded = cryptoService.HKDF(
      cryptoService.HmacSha256(
        cryptoService.repeatedNumToBits(0, 32),
        cryptoService.sjcl.codec.arrayBuffer.toBits(
          this.connectionOpts.sharedSecret.buffer
        )
      ),
      80
    );

    const sse = this.connectionOpts.sharedSecretExpanded;

    let hmacValidation = cryptoService.HmacSha256(
      cryptoService.ba.bitSlice(sse, 32 * 8, 64 * 8),
      cryptoService.ba.concat(
        cryptoService.ba.bitSlice(this.connectionOpts.secret, 0, 32 * 8),
        cryptoService.ba.bitSlice(this.connectionOpts.secret, 64 * 8)
      )
    );

    if (
      !cryptoService.ba.equal(
        hmacValidation,
        cryptoService.ba.bitSlice(this.connectionOpts.secret, 32 * 8, 64 * 8)
      )
    )
      throw "hmac mismatch";

    let keysEncrypted = cryptoService.ba.concat(
      cryptoService.ba.bitSlice(sse, 64 * 8),
      cryptoService.ba.bitSlice(this.connectionOpts.secret, 64 * 8)
    );

    let keysDecrypted = cryptoService.AESDecrypt(
      cryptoService.ba.bitSlice(sse, 0, 32 * 8),
      keysEncrypted
    );

    const encKey = cryptoService.ba.bitSlice(keysDecrypted, 0, 32 * 8);
    const macKey = cryptoService.ba.bitSlice(keysDecrypted, 32 * 8);
    console.log("got encoding and mac key.");

    this.loginInfo.key.macKey = macKey;
    this.loginInfo.key.encKey = encKey;
  }

  /**
   * Initialize the communication with the API.
   *
   * 1. Generate a new Client ID (16 random bytes converted to Base64)
   * 2. Send the message `<message_tag>,["admin","init",[0,4,315],["Windows","Chrome","10"],"<client_id>",true]`
   */
  init() {
    this.loginInfo.clientId = cryptoService.generateRandomBytes();
    const messageTag = Date.now();

    this.messagesQueue[messageTag] = {
      desc: "_login"
    };

    this.ws.send(
      `${messageTag},["admin","init",[0,4,315],["Windows Wilson","IE","7"],"${this.loginInfo.clientId}",true]`
    );
  }

  /**
   * Start the websocket connection and start listening the ws events.
   */
  start() {
    this.ws = new WebSocketService();
    this.ws.on("open", () => this.init());
    this.ws.on("close", () => null);
    this.ws.on("error", () => null);
    this.ws.on("message", data => {
      log("MESSAGE", data.slice(0, 22));
      this.handleMessage(data);
    });
  }
}

module.exports = WhatsAppService;
