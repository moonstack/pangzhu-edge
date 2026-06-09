'use strict';

function encodeMessage(obj) {
  const json = Buffer.from(JSON.stringify(obj), 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  return Buffer.concat([header, json]);
}

class MessageDecoder {
  constructor() {
    this._buf = Buffer.alloc(0);
  }
  push(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    const out = [];
    while (this._buf.length >= 4) {
      const len = this._buf.readUInt32LE(0);
      if (this._buf.length < 4 + len) break;
      const json = this._buf.slice(4, 4 + len).toString('utf8');
      this._buf = this._buf.slice(4 + len);
      out.push(JSON.parse(json));
    }
    return out;
  }
}

module.exports = { encodeMessage, MessageDecoder };
