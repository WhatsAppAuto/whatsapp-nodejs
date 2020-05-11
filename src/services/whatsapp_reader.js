const { WATags, WASingleByteTokens } = require("../whatsapp_defines");

class WABinaryReader {
  /**
   *
   * @param {Buffer} data
   */
  constructor(data) {
    this.data = data;
    this.index = 0;
  }

  checkEOS(length) {
    if (this.index + length > this.data.length) {
      throw "end of stream reached";
    }
  }

  readByte() {
    this.checkEOS(1);

    const ret = this.data[this.index];
    this.index++;

    return ret;
  }

  readIntN(n, littleEndian = false) {
    this.checkEOS(n);
    let ret = 0;

    for (let i = 0; i < n; i++) {
      const currShift = littleEndian ? i : n - 1 - i;
      ret |= this.data[this.index + i] << (currShift * 8);
    }

    this.index += n;
    return ret;
  }

  readInt16(littleEndian = false) {
    return this.readIntN(2, littleEndian);
  }

  isListTag(tag) {
    return (
      tag == WATags.LIST_EMPTY || tag == WATags.LIST_8 || tag == WATags.LIST_16
    );
  }

  readListSize(tag) {
    if (tag == WATags.LIST_EMPTY) {
      return 0;
    } else if (tag == WATags.LIST_8) {
      return this.readByte();
    } else if (tag == WATags.LIST_16) {
      return this.readInt16();
    }

    throw `invalid tag for list size: ${tag}`;
  }

  readString(tag) {
    if (tag >= 3 && tag <= 235) {
      let token = this.getToken(tag);
      if (token == "s.whatsapp.net") {
        token = "c.us";
      }
      return token;
    }

    if (
      tag == WATags.DICTIONARY_0 ||
      tag == WATags.DICTIONARY_1 ||
      tag == WATags.DICTIONARY_2 ||
      tag == WATags.DICTIONARY_3
    ) {
      return this.getTokenDouble(tag - WATags.DICTIONARY_0, this.readByte());
    } else if (tag == WATags.LIST_EMPTY) {
      return;
    } else if (tag == WATags.BINARY_8) {
      return this.readStringFromChars(this.readByte());
    } else if (tag == WATags.BINARY_20) {
      return this.readStringFromChars(this.readInt20());
    } else if (tag == WATags.BINARY_32) {
      return this.readStringFromChars(self.readInt32());
    } else if (tag == WATags.JID_PAIR) {
      const i = this.readString(this.readByte());
      const j = this.readString(this.readByte());

      if (!i || !j) {
        throw `invalid jid pair: ${i},${j}`;
      }

      return `${i}@${j}`;
    } else if (tag == WATags.NIBBLE_8 || tag == WATags.HEX_8) {
      return this.readPacked8(tag);
    } else {
      return `invalid string with tag ${tag}`;
    }
  }

  readStringFromChars(length) {
    this.checkEOS(length);

    const ret = this.data.slice(this.index, this.index + length).toString();
    this.index += length;

    return ret;
  }

  readAttributes(n) {
    const ret = {};

    if (n == 0) return;

    for (let i = 0; i < n; i++) {
      const index = this.readString(this.readByte());
      ret[index] = this.readString(this.readByte());
    }

    return ret;
  }

  readList(tag) {
    const ret = [];

    const listSize = this.readListSize(tag);
    for (let i = 0; i < listSize; i++) {
      const node = this.readNode();
      ret.push(node);
    }

    return ret;
  }

  readNode() {
    console.log("===");

    const listSize = this.readListSize(this.readByte());
    const descrTag = this.readByte();

    console.log({
      listSize,
      descrTag,
    });

    if (descrTag == WATags.STREAM_END) {
      throw "unexpected stream end";
    }

    const descr = this.readString(descrTag);

    console.log({ descr });

    if (listSize == 0 || !descr) {
      throw "invalid node";
    }

    const attrs = this.readAttributes((listSize - 1) >> 1);

    console.log({ attrs });

    if (listSize % 2 == 1) {
      return [descr, attrs, null];
    }

    const tag = this.readByte();

    console.log({ tag });

    let content;
    if (this.isListTag(tag)) {
      content = this.readList(tag);
    } else if (tag == WATags.BINARY_8) {
      // content = this.readBytes(this.readByte());
    }

    console.log({ content });
  }

  readBytes(n) {
    const ret = "";

    for (let i = 0; i < n; i++) {
      ret += this.readByte().toString();
    }

    return ret;
  }

  getToken(index) {
    if (index < 3 || index >= WASingleByteTokens.length)
      throw `invalid token index: ${index}`;
    return WASingleByteTokens[index];
  }
}

const buffer = Buffer.from(
  "f8 06 09 0a 10 2f 5a f8 14 f8 02 34 fd 00 01 b8 0a 42 0a 1c 35 37 33 30 31 32 33 31 36 33 36 39 2d 31 35 38 34 37 35 30 37 32 30 40 67 2e 75 73 10 00".replace(
    / +/g,
    ""
  ),
  "hex"
);

console.log(buffer);

const reader = new WABinaryReader(buffer);

reader.readNode();
