// clockwork/js/lib/osc_fast.js
var BUFFER_SIZE = 2 * 1024 * 1024;
var mainBuffer = new Uint8Array(BUFFER_SIZE);
var mainView = new DataView(mainBuffer.buffer);
var encodeBuffer = mainBuffer;
var encodeView = mainView;
var stringCache = /* @__PURE__ */ new Map();
var STRING_CACHE_MAX = 1e3;
var textDecoder = new TextDecoder();
var textEncoder = new TextEncoder();
var _strPair = [null, 0];
var NTP_EPOCH_OFFSET = 2208988800;
var TWO_POW_32 = 4294967296;
var BUNDLE_HEADER = new Uint8Array([35, 98, 117, 110, 100, 108, 101, 0]);
var TAG_COMMA = 44;
var TAG_INT = 105;
var TAG_FLOAT = 102;
var TAG_STRING = 115;
var TAG_BLOB = 98;
var TAG_TRUE = 84;
var TAG_FALSE = 70;
var TAG_INT64 = 104;
var TAG_DOUBLE = 100;
var TAG_TIMETAG = 116;
var TAG_UUID = 117;
var TAG_ARRAY_OPEN = 91;
var TAG_ARRAY_CLOSE = 93;
function estimateMessageSize(address, args, argsStart = 0) {
  let size = address.length + 4;
  size += 1 + 4;
  for (let ai = argsStart; ai < args.length; ai++) {
    size += estimateArgSize(args[ai]);
  }
  return size;
}
function estimateArgSize(arg) {
  if (arg instanceof Uint8Array) return 1 + 4 + arg.length + 3;
  if (arg instanceof ArrayBuffer) return 1 + 4 + arg.byteLength + 3;
  if (typeof arg === "string") return 1 + arg.length * 3 + 4;
  if (Array.isArray(arg)) {
    let s = 2;
    for (let k = 0; k < arg.length; k++) s += estimateArgSize(arg[k]);
    return s;
  }
  if (arg && arg.type === "string") return 1 + arg.value.length * 3 + 4;
  if (arg && arg.type === "blob") {
    const v = arg.value;
    const len = v instanceof Uint8Array ? v.length : v.byteLength;
    return 1 + 4 + len + 3;
  }
  if (arg && arg.type === "uuid") return 1 + 16;
  return 1 + 8;
}
function estimateBundleSize(packets) {
  let size = 16;
  for (const packet of packets) {
    size += 4;
    if (Array.isArray(packet)) {
      size += estimateMessageSize(packet[0], packet, 1);
    } else if (packet.packets !== void 0) {
      size += estimateBundleSize(packet.packets);
    } else {
      size += estimateMessageSize(packet.address, packet.args || []);
    }
  }
  return size;
}
function ensureBufferSize(estimatedSize) {
  if (estimatedSize <= BUFFER_SIZE) {
    encodeBuffer = mainBuffer;
    encodeView = mainView;
    return;
  }
  encodeBuffer = new Uint8Array(estimatedSize);
  encodeView = new DataView(encodeBuffer.buffer);
}
function encodeMessage(address, args = []) {
  const estimated = estimateMessageSize(address, args);
  ensureBufferSize(estimated);
  let pos = 0;
  pos = writeStringCached(address, pos);
  pos = writeTypeTags(args, pos);
  for (let i = 0; i < args.length; i++) {
    pos = writeArg(args[i], pos);
  }
  return encodeBuffer.subarray(0, pos);
}
function encodeBundle(timeTag, packets) {
  const estimated = estimateBundleSize(packets);
  ensureBufferSize(estimated);
  let pos = 0;
  encodeBuffer.set(BUNDLE_HEADER, pos);
  pos += 8;
  pos = writeTimeTag(timeTag, pos);
  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    const sizePos = pos;
    pos += 4;
    const packetStart = pos;
    if (Array.isArray(packet)) {
      pos = encodeMessageInto(packet[0], packet, pos, 1);
    } else if (packet.packets !== void 0) {
      pos = encodeBundleInto(packet.timeTag, packet.packets, pos);
    } else {
      pos = encodeMessageInto(packet.address, packet.args || [], pos);
    }
    const packetSize = pos - packetStart;
    encodeView.setUint32(sizePos, packetSize, false);
  }
  return encodeBuffer.subarray(0, pos);
}
function encodeSingleBundle(timeTag, address, args = []) {
  const estimated = 16 + 4 + estimateMessageSize(address, args);
  ensureBufferSize(estimated);
  let pos = 0;
  encodeBuffer.set(BUNDLE_HEADER, pos);
  pos += 8;
  pos = writeTimeTag(timeTag, pos);
  const sizePos = pos;
  pos += 4;
  const messageStart = pos;
  pos = writeStringCached(address, pos);
  pos = writeTypeTags(args, pos);
  for (let i = 0; i < args.length; i++) {
    pos = writeArg(args[i], pos);
  }
  encodeView.setUint32(sizePos, pos - messageStart, false);
  return encodeBuffer.subarray(0, pos);
}
function encodeMessageInto(address, args, pos, argsStart = 0) {
  pos = writeStringCached(address, pos);
  pos = writeTypeTags(args, pos, argsStart);
  for (let i = argsStart; i < args.length; i++) {
    pos = writeArg(args[i], pos);
  }
  return pos;
}
function encodeBundleInto(timeTag, packets, pos) {
  encodeBuffer.set(BUNDLE_HEADER, pos);
  pos += 8;
  pos = writeTimeTag(timeTag, pos);
  for (let i = 0; i < packets.length; i++) {
    const packet = packets[i];
    const sizePos = pos;
    pos += 4;
    const packetStart = pos;
    if (Array.isArray(packet)) {
      pos = encodeMessageInto(packet[0], packet, pos, 1);
    } else if (packet.packets !== void 0) {
      pos = encodeBundleInto(packet.timeTag, packet.packets, pos);
    } else {
      pos = encodeMessageInto(packet.address, packet.args || [], pos);
    }
    encodeView.setUint32(sizePos, pos - packetStart, false);
  }
  return pos;
}
function writeStringCached(str, pos) {
  const cached = stringCache.get(str);
  if (cached) {
    encodeBuffer.set(cached, pos);
    return pos + cached.length;
  }
  const startPos = pos;
  pos = writeString(str, pos);
  if (stringCache.size < STRING_CACHE_MAX) {
    const encoded = encodeBuffer.slice(startPos, pos);
    stringCache.set(str, encoded);
  }
  return pos;
}
function writeString(str, pos) {
  let needsUTF8 = false;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) >= 128) {
      needsUTF8 = true;
      break;
    }
  }
  if (needsUTF8) {
    const result = textEncoder.encodeInto(str, encodeBuffer.subarray(pos));
    pos += result.written;
  } else {
    for (let i = 0; i < str.length; i++) {
      encodeBuffer[pos++] = str.charCodeAt(i);
    }
  }
  encodeBuffer[pos++] = 0;
  while (pos & 3) {
    encodeBuffer[pos++] = 0;
  }
  return pos;
}
function writeTypeTags(args, pos, argsStart = 0) {
  encodeBuffer[pos++] = TAG_COMMA;
  for (let i = argsStart; i < args.length; i++) {
    pos = writeTagFor(args[i], pos, i);
  }
  encodeBuffer[pos++] = 0;
  while (pos & 3) {
    encodeBuffer[pos++] = 0;
  }
  return pos;
}
function writeTagFor(arg, pos, i) {
  const type = typeof arg;
  if (type === "number") {
    encodeBuffer[pos++] = Number.isInteger(arg) ? TAG_INT : TAG_FLOAT;
  } else if (type === "string") {
    encodeBuffer[pos++] = TAG_STRING;
  } else if (type === "boolean") {
    encodeBuffer[pos++] = arg ? TAG_TRUE : TAG_FALSE;
  } else if (arg instanceof Uint8Array || arg instanceof ArrayBuffer) {
    encodeBuffer[pos++] = TAG_BLOB;
  } else if (Array.isArray(arg)) {
    encodeBuffer[pos++] = TAG_ARRAY_OPEN;
    for (let k = 0; k < arg.length; k++) {
      pos = writeTagFor(arg[k], pos, i);
    }
    encodeBuffer[pos++] = TAG_ARRAY_CLOSE;
  } else if (arg && arg.type === "int") {
    encodeBuffer[pos++] = TAG_INT;
  } else if (arg && arg.type === "float") {
    encodeBuffer[pos++] = TAG_FLOAT;
  } else if (arg && arg.type === "string") {
    encodeBuffer[pos++] = TAG_STRING;
  } else if (arg && arg.type === "blob") {
    encodeBuffer[pos++] = TAG_BLOB;
  } else if (arg && arg.type === "bool") {
    encodeBuffer[pos++] = arg.value ? TAG_TRUE : TAG_FALSE;
  } else if (arg && arg.type === "int64") {
    encodeBuffer[pos++] = TAG_INT64;
  } else if (arg && arg.type === "double") {
    encodeBuffer[pos++] = TAG_DOUBLE;
  } else if (arg && arg.type === "timetag") {
    encodeBuffer[pos++] = TAG_TIMETAG;
  } else if (arg && arg.type === "uuid") {
    encodeBuffer[pos++] = TAG_UUID;
  } else if (arg === null || arg === void 0) {
    throw new Error(`OSC argument at index ${i} is ${arg}`);
  } else {
    throw new Error(`Unknown OSC argument type at index ${i}: ${type}`);
  }
  return pos;
}
function writeArg(arg, pos) {
  const type = typeof arg;
  if (type === "number") {
    if (Number.isInteger(arg)) {
      encodeView.setInt32(pos, arg, false);
      return pos + 4;
    } else {
      encodeView.setFloat32(pos, arg, false);
      return pos + 4;
    }
  }
  if (type === "string") {
    return writeString(arg, pos);
  }
  if (type === "boolean") {
    return pos;
  }
  if (arg instanceof Uint8Array) {
    const size = arg.length;
    encodeView.setUint32(pos, size, false);
    pos += 4;
    encodeBuffer.set(arg, pos);
    pos += size;
    while (pos & 3) {
      encodeBuffer[pos++] = 0;
    }
    return pos;
  }
  if (arg instanceof ArrayBuffer) {
    return writeArg(new Uint8Array(arg), pos);
  }
  if (Array.isArray(arg)) {
    for (let i = 0; i < arg.length; i++) {
      pos = writeArg(arg[i], pos);
    }
    return pos;
  }
  if (arg && arg.type === "int") {
    encodeView.setInt32(pos, arg.value, false);
    return pos + 4;
  }
  if (arg && arg.type === "float") {
    encodeView.setFloat32(pos, arg.value, false);
    return pos + 4;
  }
  if (arg && arg.type === "string") {
    return writeString(arg.value, pos);
  }
  if (arg && arg.type === "blob") {
    const blobVal = arg.value instanceof Uint8Array ? arg.value : new Uint8Array(arg.value);
    const size = blobVal.length;
    encodeView.setUint32(pos, size, false);
    pos += 4;
    encodeBuffer.set(blobVal, pos);
    pos += size;
    while (pos & 3) {
      encodeBuffer[pos++] = 0;
    }
    return pos;
  }
  if (arg && arg.type === "bool") {
    return pos;
  }
  if (arg && arg.type === "int64") {
    encodeView.setBigInt64(pos, BigInt(arg.value), false);
    return pos + 8;
  }
  if (arg && arg.type === "double") {
    encodeView.setFloat64(pos, arg.value, false);
    return pos + 8;
  }
  if (arg && arg.type === "timetag") {
    return writeTimeTag(arg.value, pos);
  }
  if (arg && arg.type === "uuid") {
    encodeBuffer.set(arg.value, pos);
    return pos + 16;
  }
  return pos;
}
function writeTimeTag(time, pos) {
  if (time === 1 || time === null || time === void 0) {
    encodeView.setUint32(pos, 0, false);
    encodeView.setUint32(pos + 4, 1, false);
    return pos + 8;
  }
  if (Array.isArray(time)) {
    if (time.length !== 2) {
      throw new Error(`TimeTag array must have exactly 2 elements [seconds, fraction], got ${time.length}`);
    }
    encodeView.setUint32(pos, time[0] >>> 0, false);
    encodeView.setUint32(pos + 4, time[1] >>> 0, false);
    return pos + 8;
  }
  if (typeof time !== "number") {
    throw new TypeError(`TimeTag must be a number, array, null, or undefined, got ${typeof time}`);
  }
  if (time > 1 && time < NTP_EPOCH_OFFSET) {
    console.warn(`TimeTag ${time} looks like a Unix timestamp (< NTP_EPOCH_OFFSET). Did you mean to add NTP_EPOCH_OFFSET (2208988800)?`);
  }
  const seconds = time >>> 0;
  const fraction = (time - Math.floor(time)) * TWO_POW_32 >>> 0;
  encodeView.setUint32(pos, seconds, false);
  encodeView.setUint32(pos + 4, fraction, false);
  return pos + 8;
}
function decodePacket(data) {
  if (!(data instanceof Uint8Array)) {
    data = new Uint8Array(data);
  }
  if (data[0] === 35 && data[1] === 98) {
    return decodeBundle(data);
  }
  return decodeMessage(data);
}
function decodeMessage(data) {
  if (!(data instanceof Uint8Array)) {
    data = new Uint8Array(data);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 0;
  const [address, addrEnd] = readString(data, pos);
  pos = addrEnd;
  if (pos >= data.length || data[pos] !== TAG_COMMA) {
    return [address];
  }
  const [tags, tagsEnd] = readString(data, pos);
  pos = tagsEnd;
  const result = [address];
  let target = result;
  const stack = [];
  for (let i = 1; i < tags.length; i++) {
    const tag = tags.charCodeAt(i);
    switch (tag) {
      case TAG_INT:
        target.push(view.getInt32(pos, false));
        pos += 4;
        break;
      case TAG_FLOAT:
        target.push(view.getFloat32(pos, false));
        pos += 4;
        break;
      case TAG_STRING:
        const [str, strEnd] = readString(data, pos);
        target.push(str);
        pos = strEnd;
        break;
      case TAG_BLOB:
        const blobSize = view.getUint32(pos, false);
        pos += 4;
        target.push(data.slice(pos, pos + blobSize));
        pos += blobSize;
        pos = pos + 3 & ~3;
        break;
      case TAG_INT64:
        target.push(view.getBigInt64(pos, false));
        pos += 8;
        break;
      case TAG_DOUBLE:
        target.push(view.getFloat64(pos, false));
        pos += 8;
        break;
      case TAG_TRUE:
        target.push(true);
        break;
      case TAG_FALSE:
        target.push(false);
        break;
      case TAG_TIMETAG:
        const seconds = view.getUint32(pos, false);
        const fraction = view.getUint32(pos + 4, false);
        target.push(seconds + fraction / TWO_POW_32);
        pos += 8;
        break;
      case TAG_UUID:
        target.push({ type: "uuid", value: data.slice(pos, pos + 16) });
        pos += 16;
        break;
      case TAG_ARRAY_OPEN: {
        const sub = [];
        target.push(sub);
        stack.push(target);
        target = sub;
        break;
      }
      case TAG_ARRAY_CLOSE:
        target = stack.pop() || result;
        break;
    }
  }
  return result;
}
function decodeBundle(data) {
  if (!(data instanceof Uint8Array)) {
    data = new Uint8Array(data);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let pos = 8;
  const seconds = view.getUint32(pos, false);
  const fraction = view.getUint32(pos + 4, false);
  const timeTag = seconds + fraction / TWO_POW_32;
  pos += 8;
  const packets = [];
  while (pos < data.length) {
    const packetSize = view.getUint32(pos, false);
    pos += 4;
    if (packetSize > 0 && pos + packetSize <= data.length) {
      const packetData = data.subarray(pos, pos + packetSize);
      packets.push(decodePacket(packetData));
    }
    pos += packetSize;
  }
  return { timeTag, packets };
}
function readString(data, pos) {
  let end = pos;
  while (end < data.length && data[end] !== 0) {
    end++;
  }
  const str = textDecoder.decode(data.subarray(pos, end));
  end++;
  end = end + 3 & ~3;
  _strPair[0] = str;
  _strPair[1] = end;
  return _strPair;
}
function copyEncoded(encoded) {
  return encoded.slice();
}
function clearCache() {
  stringCache.clear();
}
function getCacheStats() {
  return {
    stringCacheSize: stringCache.size,
    maxSize: STRING_CACHE_MAX
  };
}
function isBundle(data) {
  if (!data || data.length < 8) return false;
  return data[0] === 35 && data[1] === 98;
}
function getBundleTimeTag(data) {
  if (!isBundle(data)) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const seconds = view.getUint32(8, false);
  const fraction = view.getUint32(12, false);
  return seconds + fraction / TWO_POW_32;
}
export {
  NTP_EPOCH_OFFSET,
  TWO_POW_32,
  clearCache,
  copyEncoded,
  decodeBundle,
  decodeMessage,
  decodePacket,
  encodeBundle,
  encodeMessage,
  encodeSingleBundle,
  getBundleTimeTag,
  getCacheStats,
  isBundle
};
