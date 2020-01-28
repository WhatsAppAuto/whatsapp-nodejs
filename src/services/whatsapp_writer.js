const {
  WASingleByteTokens,
  WATags,
  WADoubleByteTokens,
  WAFlags,
  WAMediaAppInfo,
  WAMetrics,
  WAWebMessageInfo
} = require("../whatsapp_defines");

class WABinaryWriter {
  constructor() {
    this.data = [];
  }

  getData() {
    return "".join(this.data.map(d => d.charCodeAt(0)));
  }

  pushByte(value) {
    this.data.push(value & 0xff);
  }

  pushIntN(value, n, littleEndian) {
    for (let i = 0; i < n; i++) {
      const currShift = littleEndian ? i : n - 1 - i;
      this.data.push((value >> (currShift * 8)) & 0xff);
    }
  }

  pushInt20(value) {
    this.pushBytes([(value >> 16) & 0x0f, (value >> 8) & 0xff, value & 0xff]);
  }

  pushInt16(value) {
    this.pushIntN(value, 2);
  }

  pushInt32(value) {
    this.pushIntN(value, 4);
  }

  pushInt64(value) {
    this.pushIntN(value, 8);
  }

  pushBytes(bytes) {
    this.data = this.data.concat(bytes);
  }

  pushString(str) {
    // TODO
  }
}
