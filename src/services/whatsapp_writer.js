const {
  WATags,
  WASingleByteTokens,
  WADoubleByteTokens,
  WAWebMessageInfo,
} = require("../whatsapp_defines");
const { ceil, encodeUTF8, getNumValidKeys } = require("./utils");

class WABinaryWriter {
  constructor() {
    this.data = [];
  }

  getData() {
    return this.data.map((c) => String.fromCharCode(c)).join("");
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
    this.data = this.data.concat(encodeUTF8(str).map((c) => c.charCodeAt(0)));
  }

  writeByteLength(length) {
    if (length >= 4294967296) {
      throw "string too large to encode (len = " + length + "): " + str;
    }

    if (length >= 1 << 20) {
      this.pushByte(WATags.BINARY_32);
      this.pushInt32(length);
    } else if (length >= 256) {
      this.pushByte(WATags.BINARY_20);
      this.pushInt20(length);
    } else {
      this.pushByte(WATags.BINARY_8);
      this.pushByte(length);
    }
  }

  writeNode(node) {
    if (!node) return;

    if (!Array.isArray(node) || node.length != 3) {
      throw "invalid node";
    }

    const numAttributes = !!node[1] ? getNumValidKeys(node[1]) : 0;

    this.writeListStart(2 * numAttributes + 1 + (!!node[2] ? 1 : 0));
    this.writeString(node[0]);
    this.writeAttributes(node[1]);
    this.writeChildren(node[2]);
  }

  writeString(token, i = null) {
    if (typeof token != "string") {
      throw "invalid string";
    }

    if (!!i && token == "c.us") {
      this.writeToken(WASingleByteTokens.indexOf("s.whatsapp.net"));
      return;
    }

    if (!WASingleByteTokens.includes(token)) {
      const jidSepIndex = token.indexOf("@");
      if (jidSepIndex < 1) {
        this.writeStringRaw(token);
      } else {
        this.writeJid(
          token.slice(0, jidSepIndex),
          token.slice(jidSepIndex + 1)
        );
      }
    }
  }

  writeStringRaw(strng) {
    strng = encodeUTF8(strng);
    this.writeByteLength(strng.length);
    this.pushString(strng);
  }

  writeJid(jidLeft, jidRight) {
    this.pushByte(WATags.JID_PAIR);

    if (!!jidLeft && jidLeft.length > 0) {
      this.writeString(jidLeft);
    } else {
      this.writeToken(WATags.LIST_EMPTY);
    }

    this.writeString(jidRight);
  }

  writeToken(token) {
    if (token < 245) {
      this.pushByte(token);
    } else if (token <= 500) {
      throw "invalid token";
    }
  }

  writeAttributes(attrs) {
    if (!attrs) return;

    for (const key in attrs) {
      const value = attrs[key];
      if (!!vallue) {
        this.writeString(key);
        this.writeString(value);
      }
    }
  }

  writeChildren(children) {
    if (!children) return;

    if (typeof children == "string") {
      this.writeString(children, true);
    } else if (Buffer.isBuffer(children)) {
      this.writeByteLength(len(children));
      this.pushBytes(children);
    } else {
      if (!Array.isArray(children)) throw "invalid children";

      this.writeListStart(children.length);

      for (let c of children) {
        this.writeNode(c);
      }
    }
  }

  writeListStart(listSize) {
    if (listSize == 0) {
      this.pushByte(WATags.LIST_EMPTY);
    } else if (listSize < 256) {
      this.pushBytes([WATags.LIST_8, listSize]);
    } else {
      this.pushBytes([WATags.LIST_16, listSize]);
    }
  }

  writePackedBytes(strng) {
    try {
      this.writePackedBytesImpl(strng, WATags.NIBBLE_8);
    } catch (e) {
      this.writePackedBytesImpl(strng, WATags.HEX_8);
    }
  }

  writePackedBytesImpl(strng, dataType) {
    strng = encodeUTF8(strng);
    const numBytes = strng.length;

    if (numBytes > WATags.PACKED_MAX) {
      throw "too many bytes to nibble-encode: len = " + numBytes;
    }

    this.pushByte(dataType);
    this.pushByte((numBytes % 2 > 0 ? 128 : 0) | ceil(numBytes / 2));

    for (let i = 0; i < numBytes / 2; i++) {
      this.pushByte(this.packBytePair(dataType, strng[2 * i], str[2 * i + 1]));
    }

    if (numBytes % 2 != 0) {
      this.pushByte(this.packBytePair(dataType, strng[numBytes - 1], "\x00"));
    }
  }

  packBytePair(packType, part1, part2) {
    if (packType == WATags.NIBBLE_8) {
      return (this.packNibble(part1) << 4) | this.packNibble(part2);
    } else if (packType == WATags.HEX_8) {
      return (this.packHex(part1) << 4) | this.packHex(part2);
    } else {
      throw "invalid byte pack type: " + packType;
    }
  }

  packNibble(value) {
    if (value >= "0" && value <= "9") {
      return parseInt(value);
    } else if (value == "-") {
      return 10;
    } else if (value == ".") {
      return 11;
    } else if (value == "\x00") {
      return 15;
    }

    throw "invalid byte to pack as nibble: " + value;
  }

  packHex(value) {
    if (
      (value >= "0" && value <= "9") ||
      (value >= "A" && value <= "F") ||
      (value >= "a" && value <= "f")
    ) {
      return parseInt(value, 16);
    } else if (value == "\x00") {
      return 15;
    }

    throw "invalid byte to pack as hex: " + value;
  }
}

const whatsappWriteBinary = (node) => {
  const stream = new WABinaryWriter();
  stream.writeNode(node);
  return stream.getData();
};

module.exports = {
  whatsappWriteBinary,
};
