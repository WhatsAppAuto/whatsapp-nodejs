const protobuf = require("protobufjs");
const path = require("path");

module.exports = async () => {
  const root = await protobuf.load(path.join(__dirname, "../def.proto"));
  const WebMessageInfo = root.lookupType("proto.WebMessageInfo");

  return {
    decode: (buffer) => WebMessageInfo.decode(buffer),
  };
};
