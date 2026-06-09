'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { encodeMessage, MessageDecoder } = require('../src/framing');

test('encodeMessage 写 4 字节小端长度前缀 + JSON', () => {
  const buf = encodeMessage({ a: 1 });
  assert.strictEqual(buf.readUInt32LE(0), buf.length - 4);
  assert.deepStrictEqual(JSON.parse(buf.slice(4).toString('utf8')), { a: 1 });
});

test('MessageDecoder 能把跨 chunk 切开的消息拼回来', () => {
  const dec = new MessageDecoder();
  const buf = encodeMessage({ hello: 'world' });
  assert.deepStrictEqual(dec.push(buf.slice(0, 3)), []);
  assert.deepStrictEqual(dec.push(buf.slice(3)), [{ hello: 'world' }]);
});

test('MessageDecoder 能在一个 chunk 里产出多条消息', () => {
  const dec = new MessageDecoder();
  const combined = Buffer.concat([encodeMessage({ n: 1 }), encodeMessage({ n: 2 })]);
  assert.deepStrictEqual(dec.push(combined), [{ n: 1 }, { n: 2 }]);
});
