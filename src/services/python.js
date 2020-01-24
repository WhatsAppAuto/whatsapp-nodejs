const { spawnSync, exec } = require("child_process");

/**
 * @returns {Promise<{ secretKey: Buffer, publicKey: Buffer }>}
 */
const generateKeys = () =>
  new Promise(resolve => {
    exec("python3 python/cli.py curve", (e, out) => {
      const [private, public] = out.trim().split("\n");

      resolve({
        secretKey: Buffer.from(private),
        publicKey: Buffer.from(public)
      });
    });
  });

/**
 * @returns {Promise<Buffer>}
 */
const randomBytes = () =>
  new Promise(resolve => {
    exec("python3 python/cli.py generate_bytes", (e, out) =>
      resolve(Buffer.from(out))
    );
  });

module.exports = {
  generateKeys,
  randomBytes
};
