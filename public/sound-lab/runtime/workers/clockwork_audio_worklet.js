(() => {
  // clockwork/js/lib/metrics_offsets.js
  var ENGINE_PROCESS_COUNT = 0;
  var ENGINE_MESSAGES_PROCESSED = 1;
  var ENGINE_MESSAGES_DROPPED = 2;
  var ENGINE_SCHEDULER_DEPTH = 3;
  var ENGINE_SCHEDULER_PEAK_DEPTH = 4;
  var ENGINE_SCHEDULER_DROPPED = 5;
  var ENGINE_WASM_ERRORS = 7;
  var OSC_OUT_MESSAGES_SENT = 9;
  var OSC_OUT_BYTES_SENT = 10;
  var METRICS_RESERVED = 50;
  var SAB_METRICS_COUNT = METRICS_RESERVED + 1;
  var GUEST_METRICS_BASE = 69;
  var GUEST_METRICS_COUNT = 32;
  var MERGED_ARRAY_SIZE = GUEST_METRICS_BASE + GUEST_METRICS_COUNT;

  // clockwork/js/lib/wasm_client.js
  var REGION_INGRESS = 7;
  var CLIENT_MESSAGE_BYTES = 20;

  // clockwork/js/lib/control_offsets.js
  var IN_HEAD = 0;
  var IN_TAIL = 4;
  var OUT_HEAD = 8;
  var OUT_TAIL = 12;
  var NRT_OUT_HEAD = 16;
  var NRT_OUT_TAIL = 20;
  var IN_SEQUENCE = 24;
  var OUT_SEQUENCE = 28;
  var NRT_OUT_SEQUENCE = 32;
  var STATUS_FLAGS = 36;
  var IN_WRITE_LOCK = 40;
  function calculateAllControlIndices(ringBufferBase, CONTROL_START) {
    const base = ringBufferBase + CONTROL_START;
    return {
      IN_HEAD: (base + IN_HEAD) / 4,
      IN_TAIL: (base + IN_TAIL) / 4,
      OUT_HEAD: (base + OUT_HEAD) / 4,
      OUT_TAIL: (base + OUT_TAIL) / 4,
      NRT_OUT_HEAD: (base + NRT_OUT_HEAD) / 4,
      NRT_OUT_TAIL: (base + NRT_OUT_TAIL) / 4,
      IN_SEQUENCE: (base + IN_SEQUENCE) / 4,
      OUT_SEQUENCE: (base + OUT_SEQUENCE) / 4,
      NRT_OUT_SEQUENCE: (base + NRT_OUT_SEQUENCE) / 4,
      STATUS_FLAGS: (base + STATUS_FLAGS) / 4,
      IN_WRITE_LOCK: (base + IN_WRITE_LOCK) / 4
    };
  }

  // clockwork/js/lib/arena.js
  var ARENA_MAGIC = 1129791826;
  var ARENA_VERSION = 1;
  var ARENA_PUBLISHED = 1;
  var ENTRY_WORDS = 16;
  var HEADER_WORDS = 16;
  var OWNER = Object.freeze({ CLOCKWORK: 1, GUEST: 2, CLIENT: 3, HOST: 4 });
  var REGION = Object.freeze({
    CONTROL: 1,
    METRICS: 2,
    NATIVE_STATS: 3,
    CLOCK_STATE: 4,
    CLOCK_ANCHORS: 5,
    SAMPLE_CLOCK: 6,
    CHANNEL_MAP: 7,
    NODE_ID_COUNTER: 8,
    IN_RING: 9,
    OUT_RING: 10,
    NRT_OUT_RING: 11,
    AUDIO_TAPS: 12,
    CLIENT_SLOTS: 13,
    GUEST_CONFIG: 14,
    GUEST_WINDOW: 15,
    SCOPE: 16,
    GUEST_PERSIST: 17,
    TRACK_TAPS: 18
  });
  var GEOM = Object.freeze({
    RING_MAX_MESSAGE: 0,
    RING_MESSAGE_MAGIC: 1,
    RING_PADDING_MAGIC: 2,
    RING_PADDING_MARKER: 3,
    RING_HEADER_BYTES: 4,
    METRICS_FIELDS: 0,
    ANCHOR_NTP_START: 0,
    ANCHOR_DRIFT: 1,
    ANCHOR_GLOBAL: 2,
    TAPS_SLOTS: 0,
    TAPS_SLOT_BYTES: 1,
    TAPS_HEADER_BYTES: 2,
    TAPS_FRAMES: 3,
    TAPS_CHANNELS: 4,
    TAPS_SAMPLE_RATE: 5,
    SCOPE_SLOTS: 0,
    SCOPE_HEADER_BYTES: 1,
    SCOPE_SLOT_BYTES: 2,
    SCOPE_SLOT_HEADER: 3,
    SCOPE_RING_FRAMES: 4,
    SCOPE_CHANNELS: 5,
    TRACK_SLOTS: 0,
    TRACK_SLOT_BYTES: 1,
    TRACK_SLOT_HEADER: 2,
    TRACK_RING_FRAMES: 3,
    TRACK_CHANNELS: 4,
    TRACK_FIRST_INDEX: 5,
    SLOTS_COUNT: 0,
    SLOTS_SLOT_BYTES: 1,
    SLOTS_HEADER_BYTES: 2,
    SLOTS_STRUCTS_OFF: 3,
    SLOTS_STRUCTS_BYTES: 4,
    SLOTS_STACK_OFF: 5,
    SLOTS_STACK_BYTES: 6
  });
  function readArena(buffer, base) {
    if (base % 4 !== 0) throw new Error(`arena base ${base} is not 4-byte aligned`);
    const words = new Uint32Array(buffer, base, HEADER_WORDS);
    const [
      magic,
      version,
      headerBytes,
      instanceId,
      arenaBytes,
      blockBytes,
      guestOffset,
      guestBytes,
      entryCount,
      entryBytes,
      state
    ] = words;
    if (magic !== ARENA_MAGIC) throw new Error(`not a clockwork arena (magic ${magic.toString(16)})`);
    if (version !== ARENA_VERSION) throw new Error(`arena version ${version}, this reader knows ${ARENA_VERSION}`);
    if (state !== ARENA_PUBLISHED) throw new Error("arena not yet published");
    if (entryBytes !== ENTRY_WORDS * 4) throw new Error(`arena entry shape ${entryBytes} bytes, expected ${ENTRY_WORDS * 4}`);
    const table = new Uint32Array(buffer, base + HEADER_WORDS * 4, entryCount * ENTRY_WORDS);
    const entries = /* @__PURE__ */ new Map();
    for (let i = 0; i < entryCount; i++) {
      const at = i * ENTRY_WORDS;
      const id = table[at];
      if (id === 0) throw new Error(`arena entry ${i} is empty`);
      const offset = table[at + 1], bytes = table[at + 2];
      if (offset < headerBytes || offset + bytes > arenaBytes) throw new Error(`arena region ${id} lies outside the arena`);
      entries.set(id, { id, offset, bytes, owner: table[at + 3], geom: Array.from(table.subarray(at + 4, at + ENTRY_WORDS)) });
    }
    const region = (id) => {
      const e = entries.get(id);
      if (!e) throw new Error(`arena has no region ${id}`);
      return e;
    };
    return {
      header: { magic, version, headerBytes, instanceId, arenaBytes, blockBytes, guestOffset, guestBytes, entryCount },
      entries,
      region,
      has: (id) => entries.has(id),
      constants: constantsFrom(region, entries, { arenaBytes, blockBytes, guestOffset, guestBytes, version, instanceId })
    };
  }
  function constantsFrom(region, entries, h) {
    const track = entries.get(REGION.TRACK_TAPS) || { offset: 0, bytes: 0, geom: [] };
    const inRing = region(REGION.IN_RING), outRing = region(REGION.OUT_RING), nrt = region(REGION.NRT_OUT_RING);
    const control = region(REGION.CONTROL), metrics = region(REGION.METRICS), window = region(REGION.GUEST_WINDOW);
    const anchors = region(REGION.CLOCK_ANCHORS), clock = region(REGION.CLOCK_STATE), taps = region(REGION.AUDIO_TAPS);
    const nodeId = region(REGION.NODE_ID_COUNTER), config = region(REGION.GUEST_CONFIG), scope = region(REGION.SCOPE);
    const sample = region(REGION.SAMPLE_CLOCK), persist = region(REGION.GUEST_PERSIST), map = region(REGION.CHANNEL_MAP);
    const slots = region(REGION.CLIENT_SLOTS);
    return {
      ARENA_VERSION: h.version,
      ARENA_INSTANCE_ID: h.instanceId,
      CLOCKWORK_BLOCK_SIZE: h.blockBytes,
      GUEST_REGION_START: h.guestOffset,
      GUEST_REGION_SIZE: h.guestBytes,
      TOTAL_BUFFER_SIZE: h.arenaBytes,
      IN_BUFFER_START: inRing.offset,
      IN_BUFFER_SIZE: inRing.bytes,
      OUT_BUFFER_START: outRing.offset,
      OUT_BUFFER_SIZE: outRing.bytes,
      NRT_OUT_BUFFER_START: nrt.offset,
      NRT_OUT_BUFFER_SIZE: nrt.bytes,
      MAX_MESSAGE_SIZE: inRing.geom[GEOM.RING_MAX_MESSAGE],
      MESSAGE_MAGIC: inRing.geom[GEOM.RING_MESSAGE_MAGIC],
      PADDING_MAGIC: inRing.geom[GEOM.RING_PADDING_MAGIC],
      RING_PADDING_MARKER: inRing.geom[GEOM.RING_PADDING_MARKER],
      MESSAGE_HEADER_SIZE: inRing.geom[GEOM.RING_HEADER_BYTES],
      CONTROL_START: control.offset,
      CONTROL_SIZE: control.bytes,
      METRICS_START: metrics.offset,
      METRICS_SIZE: metrics.geom[GEOM.METRICS_FIELDS] * 4,
      SHM_WINDOW_START: window.offset,
      SHM_WINDOW_SIZE: window.bytes,
      NTP_START_TIME_START: anchors.offset + anchors.geom[GEOM.ANCHOR_NTP_START],
      NTP_START_TIME_SIZE: 8,
      DRIFT_OFFSET_START: anchors.offset + anchors.geom[GEOM.ANCHOR_DRIFT],
      DRIFT_OFFSET_SIZE: 4,
      GLOBAL_OFFSET_START: anchors.offset + anchors.geom[GEOM.ANCHOR_GLOBAL],
      GLOBAL_OFFSET_SIZE: 4,
      CLOCK_STATE_START: clock.offset,
      CLOCK_STATE_SIZE: clock.bytes,
      SHM_AUDIO_START: taps.offset,
      SHM_AUDIO_TOTAL_SIZE: taps.bytes,
      SHM_AUDIO_SLOTS: taps.geom[GEOM.TAPS_SLOTS],
      SHM_AUDIO_OUT_SLOT: 0,
      // CLOCKWORK_TAP_OUT: what left for the device
      SHM_AUDIO_IN_SLOT: 1,
      // CLOCKWORK_TAP_IN: what arrived from it
      SHM_AUDIO_SLOT_SIZE: taps.geom[GEOM.TAPS_SLOT_BYTES],
      SHM_AUDIO_HEADER_SIZE: taps.geom[GEOM.TAPS_HEADER_BYTES],
      SHM_AUDIO_FRAMES: taps.geom[GEOM.TAPS_FRAMES],
      SHM_AUDIO_CHANNELS: taps.geom[GEOM.TAPS_CHANNELS],
      SHM_AUDIO_SAMPLE_RATE: taps.geom[GEOM.TAPS_SAMPLE_RATE],
      NODE_ID_COUNTER_START: nodeId.offset,
      NODE_ID_COUNTER_SIZE: nodeId.bytes,
      GUEST_CONFIG_START: config.offset,
      GUEST_CONFIG_SIZE: config.bytes,
      SHM_SCOPE_START: scope.offset,
      SHM_SCOPE_TOTAL_SIZE: scope.bytes,
      SHM_SCOPE_MAX_SCOPES: scope.geom[GEOM.SCOPE_SLOTS],
      SHM_SCOPE_HEADER_SIZE: scope.geom[GEOM.SCOPE_HEADER_BYTES],
      SHM_SCOPE_SLOT_SIZE: scope.geom[GEOM.SCOPE_SLOT_BYTES],
      SHM_SCOPE_SLOT_HEADER_SIZE: scope.geom[GEOM.SCOPE_SLOT_HEADER],
      SHM_SCOPE_RING_FRAMES: scope.geom[GEOM.SCOPE_RING_FRAMES],
      SHM_SCOPE_CHANNELS: scope.geom[GEOM.SCOPE_CHANNELS],
      // The engine's track taps: scope slots numbered after the guest's.
      SHM_TRACK_TAPS_START: track.offset,
      SHM_TRACK_TAPS_SIZE: track.bytes,
      SHM_TRACK_TAPS_SLOTS: track.geom[GEOM.TRACK_SLOTS] || 0,
      SHM_TRACK_TAPS_FIRST_INDEX: track.geom[GEOM.TRACK_FIRST_INDEX] || scope.geom[GEOM.SCOPE_SLOTS],
      // Every slot a client can number: the guest's, then the track taps.
      SHM_SCOPE_SLOT_COUNT: scope.geom[GEOM.SCOPE_SLOTS] + (track.geom[GEOM.TRACK_SLOTS] || 0),
      SAMPLE_CLOCK_START: sample.offset,
      SAMPLE_CLOCK_SIZE: sample.bytes,
      GUEST_PERSIST_START: persist.offset,
      GUEST_PERSIST_SIZE: persist.bytes,
      CHANNEL_MAP_START: map.offset,
      CHANNEL_MAP_SIZE: map.bytes,
      CLIENT_SLOTS_START: slots.offset,
      CLIENT_SLOTS_SIZE: slots.bytes,
      CLIENT_SLOT_COUNT: slots.geom[GEOM.SLOTS_COUNT],
      CLIENT_SLOT_SIZE: slots.geom[GEOM.SLOTS_SLOT_BYTES],
      CLIENT_SLOTS_HEADER_SIZE: slots.geom[GEOM.SLOTS_HEADER_BYTES],
      CLIENT_SLOT_STRUCTS_OFFSET: slots.geom[GEOM.SLOTS_STRUCTS_OFF],
      CLIENT_SLOT_STRUCTS_SIZE: slots.geom[GEOM.SLOTS_STRUCTS_BYTES],
      CLIENT_SLOT_STACK_OFFSET: slots.geom[GEOM.SLOTS_STACK_OFF],
      CLIENT_SLOT_STACK_SIZE: slots.geom[GEOM.SLOTS_STACK_BYTES]
    };
  }

  // clockwork/js/lib/clock_math.js
  function beatAt(t, origin, bpm) {
    return (t - origin) * bpm / 60;
  }
  function originFor(beat, t, bpm) {
    return t - beat * 60 / bpm;
  }
  function retempoOrigin(origin, oldBpm, newBpm, now) {
    if (origin === 0 || !(oldBpm >= 1)) return origin;
    return originFor(beatAt(now, origin, oldBpm), now, newBpm);
  }

  // clockwork/js/lib/clockwork_clock_protocol.js
  var SC_BPM_I64 = 0;
  var SC_BEAT_ORIGIN_NTP_I64 = 1;
  var SC_IS_PLAYING_AT_NTP_I64 = 2;
  var SC_IS_PLAYING_I32 = 6;
  var SC_METER_I32 = 8;
  var SC_FLAG_LINK_ENABLED = 1 << 0;
  var SC_FLAG_START_STOP_SYNC = 1 << 1;
  var SC_FLAG_LINK_AUDIO_PUBLISH = 1 << 2;
  var ClockworkClockMessageType = Object.freeze({
    SET_SESSION_BPM: "setSessionBpm",
    // {bpm, nowNtp}: re-anchored at nowNtp
    SET_SESSION_IS_PLAYING: "setSessionIsPlaying",
    SET_SESSION_BEAT_ORIGIN_NTP: "setSessionBeatOriginNtp",
    SET_SESSION_METER: "setSessionMeter"
    // {num, den}
  });
  function clampBpm(bpm) {
    return Number.isFinite(bpm) && bpm >= 1 ? bpm : 1;
  }
  function isValidMeter(num, den) {
    return Number.isInteger(num) && num >= 1 && [1, 2, 4, 8, 16, 32].includes(den);
  }
  function packMeter(num, den) {
    return num << 16 | den & 65535 | 0;
  }
  function writeClockMeter(views, num, den) {
    Atomics.store(views.int32, SC_METER_I32, packMeter(num, den));
  }
  function readClockBpm(views) {
    return bitsToDouble(Atomics.load(views.bigInt, SC_BPM_I64));
  }
  function readClockOrigin(views) {
    return bitsToDouble(Atomics.load(views.bigInt, SC_BEAT_ORIGIN_NTP_I64));
  }
  function writeClockTempo(views, bpm, originNtp) {
    Atomics.store(views.bigInt, SC_BEAT_ORIGIN_NTP_I64, doubleToBits(originNtp));
    Atomics.store(views.bigInt, SC_BPM_I64, doubleToBits(clampBpm(bpm)));
  }
  function retempoClock(views, bpm, nowNtp) {
    const newBpm = clampBpm(bpm);
    const origin = retempoOrigin(readClockOrigin(views), readClockBpm(views), newBpm, nowNtp);
    writeClockTempo(views, newBpm, origin);
    return origin;
  }
  function writeClockOrigin(views, originNtp) {
    Atomics.store(views.bigInt, SC_BEAT_ORIGIN_NTP_I64, doubleToBits(originNtp));
  }
  function writeClockTransport(views, playing, atNtp) {
    Atomics.store(views.bigInt, SC_IS_PLAYING_AT_NTP_I64, doubleToBits(atNtp));
    Atomics.store(views.int32, SC_IS_PLAYING_I32, playing ? 1 : 0);
  }
  var _scratchBuf = new ArrayBuffer(8);
  var _scratchF64 = new Float64Array(_scratchBuf);
  var _scratchI64 = new BigInt64Array(_scratchBuf);
  function doubleToBits(v) {
    _scratchF64[0] = v;
    return _scratchI64[0];
  }
  function bitsToDouble(bits) {
    _scratchI64[0] = bits;
    return _scratchF64[0];
  }

  // clockwork/js/workers/clockwork_audio_worklet.js
  var PM_POOL_CONFIG = {
    MAX_REPLY_MESSAGES: 64,
    MAX_LOG_ENTRIES: 100,
    REPLY_BUFFER_SIZE: 128 * 1024,
    // 128KB - matches OUT_BUFFER_SIZE
    LOG_BUFFER_SIZE: 256 * 1024,
    // 256KB for log entries
    LOG_MAX_MESSAGE_SIZE: 16 * 1024
    // 16KB - truncate larger messages
  };
  var ClockworkProcessor = class extends AudioWorkletProcessor {
    constructor() {
      super();
      this.mode = "sab";
      this.sharedBuffer = null;
      this.wasmModule = null;
      this.wasmInstance = null;
      this.isInitialized = false;
      this.processCallCount = 0;
      this.lastStatusCheck = 0;
      this.lastInTail = 0;
      this.ringBufferBase = null;
      this.pendingClearSched = false;
      this.audioView = null;
      this.lastAudioBufferPtr = 0;
      this.lastWasmBufferSize = 0;
      this.lastTreeVersion = -1;
      this.treeSnapshotsSent = 0;
      this.lastTreeSendTime = -1;
      this.treeSnapshotMinInterval = 0.15;
      this.atomicView = null;
      this.uint8View = null;
      this.dataView = null;
      this.localClockOffsetView = null;
      this.bufferConstants = null;
      this.CONTROL_INDICES = null;
      this.metricsView = null;
      this.STATUS_FLAGS = {
        OK: 0,
        BUFFER_FULL: 1 << 0,
        OVERRUN: 1 << 1,
        WASM_ERROR: 1 << 2,
        FRAGMENTED_MSG: 1 << 3
      };
      this.oscPorts = [];
      this.portSourceIds = /* @__PURE__ */ new Map();
      this.channelViews = null;
      this.lastNumSamples = 0;
      this.lastNumChannels = 0;
      this.pmPools = null;
      this.nodeIdRanges = [
        { from: 0, to: 0 },
        // slot 0: current
        { from: 0, to: 0 }
        // slot 1: prefetch
      ];
      this.nodeIdRangeCount = 0;
      this.nodeIdRefillRequested = false;
      this.nodeIdPort = null;
      this.nodeIdCounterView = null;
      this._statusObj = {
        bufferFull: false,
        overrun: false,
        wasmError: false,
        fragmented: false
      };
      this._metricsObj = {
        processCount: 0,
        messagesProcessed: 0,
        messagesDropped: 0,
        schedulerQueueDepth: 0,
        schedulerQueueMax: 0,
        schedulerQueueDropped: 0
      };
      this._statusMessage = {
        type: "status",
        flags: 0,
        status: this._statusObj,
        metrics: this._metricsObj
      };
      this.egressListening = false;
      this.port.onmessage = this.handleMessage.bind(this);
    }
    // The arena's table of contents (js/lib/arena.js, src/clockwork_arena.h):
    // read from the front of the arena, by id, never by position. The
    // constants the rest of the runtime consumes are derived from it.
    loadBufferConstants() {
      const memory = this.wasmMemory;
      if (!memory) {
        throw new Error("WASM memory not available");
      }
      if (!this.wasmInstance || !this.wasmInstance.exports.get_ring_buffer_base) {
        throw new Error("WASM instance does not export get_ring_buffer_base");
      }
      const base = this.wasmInstance.exports.get_ring_buffer_base();
      this.arena = readArena(memory.buffer, base);
      this.bufferConstants = this.arena.constants;
    }
    // Calculate buffer indices based on dynamic ring buffer base address
    // Uses constants loaded from WASM via loadBufferConstants()
    calculateBufferIndices(ringBufferBase) {
      if (!this.bufferConstants) {
        throw new Error("Buffer constants not loaded. Call loadBufferConstants() first.");
      }
      const CONTROL_START = this.bufferConstants.CONTROL_START;
      const METRICS_START = this.bufferConstants.METRICS_START;
      const CLOCK_STATE_START = this.bufferConstants.CLOCK_STATE_START;
      const CLOCK_STATE_SIZE = this.bufferConstants.CLOCK_STATE_SIZE;
      this.CONTROL_INDICES = calculateAllControlIndices(ringBufferBase, CONTROL_START);
      const clockworkClockBuf = this.mode === "sab" ? this.sharedBuffer : this.wasmMemory.buffer;
      const clockworkClockBase = ringBufferBase + CLOCK_STATE_START;
      this.clockworkClockStateBigInt = new BigInt64Array(clockworkClockBuf, clockworkClockBase, CLOCK_STATE_SIZE / 8);
      this.clockworkClockStateInt32 = new Int32Array(clockworkClockBuf, clockworkClockBase, CLOCK_STATE_SIZE / 4);
      if (this.mode === "sab") {
        const metricsBase = ringBufferBase + METRICS_START;
        this.metricsView = new Uint32Array(this.sharedBuffer, metricsBase, this.bufferConstants.METRICS_SIZE / 4);
      } else {
        this.atomicView = new Int32Array(this.wasmMemory.buffer);
        this.uint8View = new Uint8Array(this.wasmMemory.buffer);
        this.dataView = new DataView(this.wasmMemory.buffer);
        const metricsBase = ringBufferBase + METRICS_START;
        this.metricsView = new Uint32Array(this.wasmMemory.buffer, metricsBase, this.bufferConstants.METRICS_SIZE / 4);
      }
    }
    // Set up Int32Array view for NODE_ID_COUNTER in WASM memory.
    // In PM mode, this view is used to seed the counter with range-based
    // allocation values before process_audio() and read it back after.
    // In SAB mode, the counter is shared and managed atomically — no seeding needed.
    initNodeIdCounter() {
      if (!this.wasmMemory || !this.bufferConstants || !this.ringBufferBase) return;
      if (this.mode !== "postMessage") return;
      const counterBase = this.ringBufferBase + this.bufferConstants.NODE_ID_COUNTER_START;
      this.nodeIdCounterView = new Int32Array(this.wasmMemory.buffer, counterBase, 1);
      if (this.nodeIdRangeCount > 0) {
        Atomics.store(this.nodeIdCounterView, 0, this.nodeIdRanges[0].from);
      }
    }
    // Push a node ID range into the pre-allocated slots.
    // Called from message handler — never during process().
    pushNodeIdRange(from, to) {
      if (this.nodeIdRangeCount < 2) {
        const slot = this.nodeIdRanges[this.nodeIdRangeCount];
        slot.from = from;
        slot.to = to;
        this.nodeIdRangeCount++;
        this.nodeIdRefillRequested = false;
        if (this.nodeIdRangeCount === 1 && this.nodeIdCounterView) {
          Atomics.store(this.nodeIdCounterView, 0, from);
        }
      }
    }
    /*
     * Copy the guest's own config block into the region reserved for it.
     *
     * CLOCKWORK DOES NOT KNOW WHAT IS IN THESE BYTES. Writing named slots here
     * — one engine's config struct, field by field — means a second guest
     * cannot be configured at all without editing this file.
     *
     * The product encodes its own block and clockwork only moves it.
     * The one thing clockwork contributes is the transport mode, which it
     * alone knows, and it contributes it as a VALUE passed to the encoder
     * rather than as a slot written here.
     */
    writeGuestConfigToMemory() {
      if (!this.guestConfigBytes || !this.wasmMemory) {
        return;
      }
      const start = this.bufferConstants?.GUEST_CONFIG_START;
      if (start === void 0) {
        console.error("GUEST_CONFIG_START not available in bufferConstants");
        return;
      }
      const src = new Uint8Array(this.guestConfigBytes);
      const cap = this.bufferConstants?.GUEST_CONFIG_SIZE ?? src.byteLength;
      if (src.byteLength > cap) {
        throw new Error(`guest config is ${src.byteLength} bytes but the region holds ${cap}: GUEST_CONFIG_SIZE and the encoder disagree`);
      }
      new Uint8Array(this.wasmMemory.buffer, this.ringBufferBase + start, src.byteLength).set(src);
    }
    // Atomic-safe load - uses Atomics in SAB mode, regular access in postMessage mode
    atomicLoad(index) {
      if (this.mode === "sab") {
        return Atomics.load(this.atomicView, index);
      } else {
        return this.atomicView[index];
      }
    }
    // Atomic-safe store - uses Atomics in SAB mode, regular access in postMessage mode
    atomicStore(index, value) {
      if (this.mode === "sab") {
        Atomics.store(this.atomicView, index, value);
      } else {
        this.atomicView[index] = value;
      }
    }
    // Initialize pre-allocated pools for allocation-free PM mode
    // Called once after mode is set and bufferConstants are loaded
    initPMPools() {
      if (this.mode !== "postMessage") return;
      const C = PM_POOL_CONFIG;
      this.pmPools = {
        // === OUTGOING POOLS ===
        // OSC replies from the DSP
        replies: {
          message: { type: "oscReplies", messages: null, count: 0 },
          buffer: new ArrayBuffer(C.REPLY_BUFFER_SIZE),
          bufferView: null,
          entries: new Array(C.MAX_REPLY_MESSAGES).fill(null).map(() => ({
            offset: 0,
            length: 0,
            sequence: 0
          }))
        },
        // Metrics + node tree snapshot
        snapshot: {
          message: { type: "snapshot", buffer: null, snapshotsSent: 0 },
          buffer: null,
          // Sized after bufferConstants known
          bufferView: null,
          size: 0
        },
        // OSC log entries
        log: {
          message: { type: "oscLog", entries: null, count: 0, buffer: null },
          buffer: new ArrayBuffer(C.LOG_BUFFER_SIZE),
          bufferView: null,
          entries: new Array(C.MAX_LOG_ENTRIES).fill(null).map(() => ({
            offset: 0,
            length: 0,
            originalLength: 0,
            sourceId: 0,
            sequence: 0
          }))
        }
      };
      const p = this.pmPools;
      p.replies.bufferView = new Uint8Array(p.replies.buffer);
      p.log.bufferView = new Uint8Array(p.log.buffer);
      p.replies.message.messages = p.replies.entries;
      p.log.message.entries = p.log.entries;
      if (this.bufferConstants && this.wasmMemory) {
        const bc = this.bufferConstants;
        const size = bc.METRICS_SIZE + bc.SHM_WINDOW_SIZE;
        p.snapshot.buffer = new ArrayBuffer(size);
        p.snapshot.bufferView = new Uint8Array(p.snapshot.buffer);
        p.snapshot.size = size;
        p.snapshot.message.buffer = p.snapshot.buffer;
        p.snapshot.metricsView = new Uint8Array(
          this.wasmMemory.buffer,
          this.ringBufferBase + bc.METRICS_START,
          bc.METRICS_SIZE
        );
        p.snapshot.windowView = new Uint8Array(
          this.wasmMemory.buffer,
          this.ringBufferBase + bc.SHM_WINDOW_START,
          bc.SHM_WINDOW_SIZE
        );
      }
    }
    // Write a single OSC message directly to the IN ring buffer (postMessage mode)
    // Called from onmessage handlers
    // Note: new Uint8Array(oscData) creates a view (no copy), which is required to access ArrayBuffer bytes
    // Open the client boundary over the engine's own heap.
    //
    // A browser client is a client like any other; it simply happens to share
    // an address space with the engine, so it opens by address rather than by
    // segment. Everything after this — sending, draining, reading a region —
    // is the same code a GUI in another process runs.
    openClientBoundary() {
      this.wasmExports = this.wasmInstance.exports;
      if (!this.wasmExports.clockwork_client_open_memory) return;
      const base = this.wasmExports.get_ring_buffer_base();
      const bytes = this.bufferConstants.TOTAL_BUFFER_SIZE;
      const stPtr = this.wasmExports.malloc(4);
      this.clientHandle = this.wasmExports.clockwork_client_open_memory(base, bytes, stPtr);
      if (!this.clientHandle) {
        const status = new Int32Array(this.wasmMemory.buffer, stPtr, 1)[0];
        console.error("[AudioWorklet] client boundary unavailable, status", status);
        this.wasmExports.free(stPtr);
        return;
      }
      const C = PM_POOL_CONFIG;
      this.pollMax = Math.max(C.MAX_REPLY_MESSAGES, C.MAX_LOG_ENTRIES);
      this.pollMessages = this.wasmExports.malloc(this.pollMax * CLIENT_MESSAGE_BYTES);
      const tapBytes = this.wasmExports.clockwork_client_tap_sizeof();
      this.logTap = this.wasmExports.clockwork_client_tap_open_in(
        this.wasmExports.malloc(tapBytes),
        tapBytes,
        this.clientHandle,
        REGION_INGRESS,
        stPtr
      );
      if (!this.logTap) {
        const status = new Int32Array(this.wasmMemory.buffer, stPtr, 1)[0];
        console.error("[AudioWorklet] could not watch the ingress ring, status", status);
      }
      this.wasmExports.free(stPtr);
    }
    // Read one ClockworkClientMessage out of the array a drain just filled.
    #readPolled(view, index) {
      const at = this.pollMessages + index * CLIENT_MESSAGE_BYTES;
      return {
        ptr: view.getUint32(at, true),
        length: view.getUint32(at + 4, true),
        origin: view.getUint32(at + 8, true),
        sequence: view.getUint32(at + 16, true)
      };
    }
    writeOscToRingBuffer(oscData, sourceId = 0) {
      if (!this.clientHandle) return false;
      const len = oscData.byteLength;
      if (len === 0) return false;
      if (!this.sendScratch || this.sendScratchBytes < len) {
        if (this.sendScratch) this.wasmExports.free(this.sendScratch);
        this.sendScratchBytes = Math.max(len, 4096);
        this.sendScratch = this.wasmExports.malloc(this.sendScratchBytes);
      }
      new Uint8Array(this.wasmMemory.buffer, this.sendScratch, len).set(new Uint8Array(oscData));
      const status = this.wasmExports.clockwork_client_send(
        this.clientHandle,
        this.sendScratch,
        len,
        sourceId
      );
      if (status !== 0) {
        console.error("[AudioWorklet] send refused, status", status);
        return false;
      }
      return true;
    }
    // Note: SAB mode OSC logging is now handled by osc_out_log_sab_worker
    // The worker uses Atomics.wait() on IN_HEAD for instant wake when messages arrive
    // Read OSC replies from OUT ring buffer and send via postMessage
    // Uses pre-allocated pools for allocation-free operation
    readOscReplies() {
      if (!this.pmPools || !this.clientHandle) return;
      const pool = this.pmPools.replies;
      const C = PM_POOL_CONFIG;
      const got = this.wasmExports.clockwork_client_poll(
        this.clientHandle,
        this.pollMessages,
        Math.min(C.MAX_REPLY_MESSAGES, this.pollMax)
      );
      if (!got) return;
      const view = new DataView(this.wasmMemory.buffer);
      const heap = new Uint8Array(this.wasmMemory.buffer);
      let count = 0;
      let bufferOffset = 0;
      for (let i = 0; i < got; i++) {
        const m = this.#readPolled(view, i);
        if (!m.length) continue;
        if (bufferOffset + m.length > C.REPLY_BUFFER_SIZE) break;
        pool.bufferView.set(heap.subarray(m.ptr, m.ptr + m.length), bufferOffset);
        const entry = pool.entries[count];
        entry.offset = bufferOffset;
        entry.length = m.length;
        entry.sequence = m.sequence;
        bufferOffset += m.length;
        count++;
      }
      if (count > 0) {
        pool.message.count = count;
        pool.message.buffer = pool.buffer;
        this.port.postMessage(pool.message);
      }
    }
    // Read metrics from WASM memory as raw Uint32Array
    // Returns null if not ready, otherwise a copy of the metrics buffer
    // Same layout as SAB - can be used directly with MetricsOffsets
    readMetrics() {
      if (!this.metricsView) {
        return null;
      }
      return new Uint32Array(this.metricsView);
    }
    // Record OSC message received (for postMessage mode metrics).
    // In PM mode, we track what the worklet receives since there's no shared memory.
    recordOscReceived(byteLength) {
      if (!this.metricsView) return;
      if (this.mode === "sab") {
        Atomics.add(this.metricsView, OSC_OUT_MESSAGES_SENT, 1);
        Atomics.add(this.metricsView, OSC_OUT_BYTES_SENT, byteLength);
      } else {
        this.metricsView[OSC_OUT_MESSAGES_SENT]++;
        this.metricsView[OSC_OUT_BYTES_SENT] += byteLength;
      }
    }
    // Record an inbound OSC message dropped at the IN ring (ring full),
    // into the same counter the native engine's ingest uses for ingress
    // drops (messages_dropped), so the loss appears in metrics snapshots.
    recordOscDropped() {
      if (!this.metricsView) return;
      this.metricsView[ENGINE_MESSAGES_DROPPED]++;
    }
    // Read metrics + the guest's window from WASM memory and send via
    // postMessage: immediately when the window's version word moves, otherwise
    // on interval. Two copies into one pre-allocated pool, metrics then
    // window. Nothing here reads INSIDE the window — the version stamp is the
    // whole of the contract (dsp_api.h shm_window).
    // Returns true if a snapshot was sent, so log entries batch on the same tick.
    checkAndSendSnapshot(audioTime) {
      const bc = this.bufferConstants;
      if (!bc || !this.wasmMemory || this.ringBufferBase === null || !this.pmPools) return false;
      const windowBase = this.ringBufferBase + bc.SHM_WINDOW_START;
      const versionOffset = windowBase / 4;
      const currentVersion = this.atomicView[versionOffset];
      const versionChanged = currentVersion !== this.lastTreeVersion;
      if (versionChanged) {
        this.lastTreeVersion = currentVersion;
        this.lastTreeSendTime = audioTime;
      } else {
        if (this.lastTreeSendTime >= 0 && audioTime - this.lastTreeSendTime < this.treeSnapshotMinInterval) {
          return false;
        }
        this.lastTreeSendTime = audioTime;
      }
      const pool = this.pmPools.snapshot;
      if (!pool.buffer || !pool.metricsView) return false;
      pool.bufferView.set(pool.metricsView, 0);
      pool.bufferView.set(pool.windowView, pool.metricsView.length);
      this.treeSnapshotsSent++;
      pool.message.snapshotsSent = this.treeSnapshotsSent;
      this.port.postMessage(pool.message);
      return true;
    }
    // Read metrics + the guest's window as one snapshot: metrics first, then
    // the window at offset METRICS_SIZE, which is where readWindow() on the
    // client side reads it back. Returns a raw ArrayBuffer (transferable) or
    // null if not ready. Used only for the initial snapshot.
    readMetricsAndTreeBuffer() {
      if (!this.bufferConstants || !this.wasmMemory || this.ringBufferBase === null) {
        return null;
      }
      const bc = this.bufferConstants;
      const buffer = new ArrayBuffer(bc.METRICS_SIZE + bc.SHM_WINDOW_SIZE);
      const out = new Uint8Array(buffer);
      out.set(new Uint8Array(this.wasmMemory.buffer, this.ringBufferBase + bc.METRICS_START, bc.METRICS_SIZE), 0);
      out.set(new Uint8Array(this.wasmMemory.buffer, this.ringBufferBase + bc.SHM_WINDOW_START, bc.SHM_WINDOW_SIZE), bc.METRICS_SIZE);
      return buffer;
    }
    // Read and send OSC log entries from the IN ring (postMessage mode). Called
    // on the snapshot heartbeat (~150ms) to batch entries; pre-allocated pools,
    // with truncation for large messages.
    sendLogEntries() {
      if (!this.pmPools || !this.logTap) return;
      const pool = this.pmPools.log;
      const C = PM_POOL_CONFIG;
      const got = this.wasmExports.clockwork_client_tap_poll(
        this.logTap,
        this.pollMessages,
        Math.min(C.MAX_LOG_ENTRIES, this.pollMax)
      );
      if (!got) return;
      const view = new DataView(this.wasmMemory.buffer);
      const heap = new Uint8Array(this.wasmMemory.buffer);
      let count = 0;
      let bufferOffset = 0;
      for (let i = 0; i < got; i++) {
        const m = this.#readPolled(view, i);
        if (!m.length) continue;
        const actualLength = Math.min(m.length, C.LOG_MAX_MESSAGE_SIZE);
        if (bufferOffset + actualLength > C.LOG_BUFFER_SIZE) break;
        pool.bufferView.set(heap.subarray(m.ptr, m.ptr + actualLength), bufferOffset);
        const entry = pool.entries[count];
        entry.offset = bufferOffset;
        entry.length = actualLength;
        entry.originalLength = m.length;
        entry.sourceId = m.origin;
        entry.sequence = m.sequence;
        bufferOffset += actualLength;
        count++;
      }
      if (count > 0) {
        pool.message.count = count;
        pool.message.buffer = pool.buffer;
        this.port.postMessage(pool.message);
      }
    }
    async handleMessage(event) {
      const { data } = event;
      try {
        if (data.type === "listening") {
          this.egressListening = true;
          return;
        }
        if (data.type === "osc") {
          if (this.mode === "postMessage") {
            if (data.oscData) {
              if (this.writeOscToRingBuffer(data.oscData, data.sourceId ?? 0)) {
                this.recordOscReceived(data.oscData.byteLength);
              } else {
                this.recordOscDropped();
              }
            }
          }
          return;
        }
        if (data.type === "addOscPort") {
          const port = event.ports[0];
          if (port) {
            const portSourceId = data.sourceId ?? 0;
            this.portSourceIds.set(port, portSourceId);
            port.onmessage = (e) => {
              if (e.data.type === "osc" && e.data.oscData) {
                const msgSourceId = e.data.sourceId ?? this.portSourceIds.get(port) ?? 0;
                if (this.writeOscToRingBuffer(e.data.oscData, msgSourceId)) {
                  this.recordOscReceived(e.data.oscData.byteLength);
                } else {
                  this.recordOscDropped();
                }
              }
            };
            this.oscPorts.push(port);
          }
          return;
        }
        if (data.type === "clearSched") {
          if (this.CONTROL_INDICES) {
            const head = this.atomicLoad(this.CONTROL_INDICES.IN_HEAD);
            this.atomicStore(this.CONTROL_INDICES.IN_TAIL, head);
          }
          this.pendingClearSched = true;
          if (data.ack) {
            this.port.postMessage({ type: "clearSchedAck" });
          }
          return;
        }
        if (data.type === "nodeIdRange") {
          if (data.from !== void 0 && data.to !== void 0) {
            this.pushNodeIdRange(data.from, data.to);
          }
          const port = event.ports[0];
          if (port) {
            this.nodeIdPort = port;
            this.nodeIdPort.onmessage = (e) => {
              if (e.data.type === "nodeIdRange") {
                this.pushNodeIdRange(e.data.from, e.data.to);
              }
            };
          }
          return;
        }
        if (data.type === "init") {
          this.mode = data.mode || "sab";
          if (data.snapshotIntervalMs) {
            this.treeSnapshotMinInterval = data.snapshotIntervalMs / 1e3;
          }
          if (this.mode === "sab" && data.sharedBuffer) {
            this.sharedBuffer = data.sharedBuffer;
            this.atomicView = new Int32Array(this.sharedBuffer);
            this.uint8View = new Uint8Array(this.sharedBuffer);
            this.dataView = new DataView(this.sharedBuffer);
          }
        }
        if (data.type === "loadWasm") {
          if (data.wasmBytes) {
            let memory;
            if (this.mode === "sab") {
              memory = data.wasmMemory;
              if (!memory) {
                this.port.postMessage({
                  type: "error",
                  error: "No WASM memory provided!"
                });
                return;
              }
            } else {
              const memoryPages = data.memoryPages || 1280;
              const maxMemoryPages = data.maxMemoryPages || memoryPages;
              memory = new WebAssembly.Memory({
                initial: memoryPages,
                maximum: maxMemoryPages,
                shared: true
              });
            }
            this.wasmMemory = memory;
            this.guestConfigBytes = data.guestConfigBytes || null;
            this.inputChannels = data.inputChannels ?? 0;
            this.outputChannels = data.outputChannels ?? 2;
            this.sampleRate = data.sampleRate || 48e3;
            this.guestMemoryOffset = data.guestMemoryOffset ?? 0;
            this.guestMemorySize = data.guestMemorySize ?? 0;
            this.inboxOffset = data.inboxOffset ?? 0;
            this.inboxSize = data.inboxSize ?? 0;
            this.outboxOffset = data.outboxOffset ?? 0;
            this.outboxSize = data.outboxSize ?? 0;
            this.memArenaSize = data.memArenaSize ?? 0;
            const imports = {
              env: {
                memory,
                /*
                 * SAFE_HEAP's two reporters.
                 *
                 * A -sSAFE_HEAP build instruments every load and
                 * store and calls these when one is out of bounds
                 * or misaligned. Emscripten's own JS glue supplies
                 * them; this worklet instantiates the module
                 * itself, so without these the build will not
                 * INSTANTIATE at all — which is how the strongest
                 * memory diagnostic came to be unusable exactly
                 * when it was needed. They cost nothing in a
                 * normal build, where nothing imports them.
                 */
                segfault: (...a) => {
                  throw new Error("SAFE_HEAP OOB args=" + JSON.stringify(a) + " STACK " + (new Error().stack || "").replace(/\n/g, " | "));
                },
                alignfault: (...a) => {
                  throw new Error("SAFE_HEAP MISALIGNED args=" + JSON.stringify(a) + " STACK " + (new Error().stack || "").replace(/\n/g, " | "));
                },
                emscripten_asm_const_double: () => Date.now() * 1e3,
                // Filesystem syscalls. The build has no filesystem,
                // but the standard libraries carry references to
                // these; an unresolved import fails instantiation
                // of the whole module, with an error that names the
                // symbol and nothing about where it came from.
                __syscall_getdents64: () => 0,
                __syscall_unlinkat: () => 0,
                __syscall_getcwd: () => -52,
                // -ENOSYS
                // pthread stubs (no-ops - AudioWorklet doesn't support threading)
                _emscripten_init_main_thread_js: () => {
                },
                _emscripten_thread_mailbox_await: () => {
                },
                _emscripten_thread_set_strongref: () => {
                },
                emscripten_exit_with_live_runtime: () => {
                },
                _emscripten_receive_on_main_thread_js: () => {
                },
                emscripten_check_blocking_allowed: () => {
                },
                _emscripten_thread_cleanup: () => {
                },
                emscripten_num_logical_cores: () => 1,
                // Report 1 core
                _emscripten_notify_mailbox_postmessage: () => {
                },
                emscripten_notify_memory_growth: () => {
                }
                // Called on memory.grow() — no-op (we manage views ourselves)
              },
              wasi_snapshot_preview1: {
                clock_time_get: (clockid, precision, timestamp_ptr) => {
                  const view = new DataView(memory.buffer);
                  const nanos = BigInt(Math.floor(Date.now() * 1e6));
                  view.setBigUint64(timestamp_ptr, nanos, true);
                  return 0;
                },
                // Rust's standard library seeds its hash maps from
                // here. AudioWorkletGlobalScope does not reliably
                // expose crypto, so this falls back to a cheap
                // generator — which is sound for the only use the
                // engine has: hash seeding affects iteration order
                // and nothing that reaches the audio.
                random_get: (buf, len) => {
                  const bytes = new Uint8Array(memory.buffer, buf, len);
                  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
                    crypto.getRandomValues(bytes);
                  } else {
                    let x = (Date.now() ^ 2654435769) >>> 0;
                    for (let i = 0; i < len; i++) {
                      x ^= x << 13;
                      x >>>= 0;
                      x ^= x >> 17;
                      x ^= x << 5;
                      x >>>= 0;
                      bytes[i] = x & 255;
                    }
                  }
                  return 0;
                },
                environ_sizes_get: () => 0,
                environ_get: () => 0,
                fd_close: () => 0,
                /*
                 * THE MODULE'S ONLY WAY TO SPEAK BEFORE THE ENGINE
                 * EXISTS, and it used to return 0 and discard the
                 * bytes.
                 *
                 * clockwork_log writes an OSC message into the debug ring
                 * for a worker to drain, which is worth nothing
                 * during boot — nothing drains that ring until the
                 * engine is running. Everything else the module
                 * prints (scprintf, an abort, a failed placement)
                 * arrives here as a write to fd 2, and a stub
                 * returning 0 told it the bytes were written.
                 *
                 * Measured 2026-09-01: a boot that ended in
                 * init_memory surfaced to the client as
                 * "AudioWorklet initialization timeout" with the
                 * reason discarded at this line.
                 */
                fd_write: (fd, iov, iovcnt, pnum) => {
                  const view = new DataView(memory.buffer);
                  const u8 = new Uint8Array(memory.buffer);
                  let written = 0, text = "";
                  for (let i = 0; i < iovcnt; i++) {
                    const ptr = view.getUint32(iov + i * 8, true);
                    const len = view.getUint32(iov + i * 8 + 4, true);
                    for (let j = 0; j < len; j++)
                      text += String.fromCharCode(u8[ptr + j]);
                    written += len;
                  }
                  if (pnum) view.setUint32(pnum, written, true);
                  const line = text.replace(/\n+$/, "");
                  if (line)
                    (fd === 2 ? console.error : console.log)(
                      "[wasm] " + line
                    );
                  return 0;
                },
                fd_seek: () => 0,
                fd_read: () => 0,
                proc_exit: (code) => {
                  console.error("[AudioWorklet] WASM tried to exit with code:", code);
                }
              }
            };
            const module = await WebAssembly.compile(data.wasmBytes);
            this.wasmInstance = await WebAssembly.instantiate(module, imports);
            if (this.wasmInstance.exports.get_ring_buffer_base) {
              this.ringBufferBase = this.wasmInstance.exports.get_ring_buffer_base();
              this.loadBufferConstants();
              this.calculateBufferIndices(this.ringBufferBase);
              this.initPMPools();
              this.writeGuestConfigToMemory();
              if (this.wasmInstance.exports.clockwork_init) {
                console.log(`[clockwork] transport: ${this.mode === "sab" ? "SAB" : "PM"}`);
                this.wasmInstance.exports.clockwork_init(
                  this.sampleRate,
                  0,
                  this.inputChannels,
                  this.outputChannels,
                  0,
                  this.guestMemoryOffset,
                  this.guestMemorySize,
                  0,
                  0,
                  this.memArenaSize,
                  this.inboxOffset,
                  this.inboxSize,
                  this.outboxOffset,
                  this.outboxSize
                );
                this.initNodeIdCounter();
                this.openClientBoundary();
                this.isInitialized = true;
                const initialSnapshot = this.mode === "postMessage" ? this.readMetricsAndTreeBuffer() : void 0;
                const msg = {
                  type: "initialized",
                  success: true,
                  ringBufferBase: this.ringBufferBase,
                  bufferConstants: this.bufferConstants,
                  exports: Object.keys(this.wasmInstance.exports),
                  initialSnapshot
                };
                this.port.postMessage(msg, initialSnapshot ? [initialSnapshot] : []);
              } else {
                const why = "clockwork_init is not exported by the module - the engine cannot be booted. Add _clockwork_init to EXPORTED_FUNCTIONS in scripts/build-web.sh.";
                console.error("[AudioWorklet] " + why);
                this.port.postMessage({ type: "error", error: why });
              }
            }
          } else if (data.wasmInstance) {
            this.wasmInstance = data.wasmInstance;
            if (this.wasmInstance.exports.get_ring_buffer_base) {
              this.ringBufferBase = this.wasmInstance.exports.get_ring_buffer_base();
              this.loadBufferConstants();
              this.calculateBufferIndices(this.ringBufferBase);
              this.initPMPools();
              this.writeGuestConfigToMemory();
              if (this.wasmInstance.exports.clockwork_init) {
                console.log(`[clockwork] transport: ${this.mode === "sab" ? "SAB" : "PM"}`);
                this.wasmInstance.exports.clockwork_init(
                  this.sampleRate,
                  0,
                  this.inputChannels,
                  this.outputChannels,
                  0,
                  this.guestMemoryOffset,
                  this.guestMemorySize,
                  0,
                  0,
                  this.memArenaSize,
                  this.inboxOffset,
                  this.inboxSize,
                  this.outboxOffset,
                  this.outboxSize
                );
                this.initNodeIdCounter();
                this.openClientBoundary();
                this.isInitialized = true;
                const initialSnapshot = this.mode === "postMessage" ? this.readMetricsAndTreeBuffer() : void 0;
                const msg = {
                  type: "initialized",
                  success: true,
                  ringBufferBase: this.ringBufferBase,
                  bufferConstants: this.bufferConstants,
                  exports: Object.keys(this.wasmInstance.exports),
                  initialSnapshot
                };
                this.port.postMessage(msg, initialSnapshot ? [initialSnapshot] : []);
              }
            }
          }
        }
        if (data.type === "callExport") {
          let result;
          try {
            const fn = this.wasmExports && this.wasmExports[data.name];
            result = fn ? fn(...data.args || []) : void 0;
          } catch (e) {
            if (true) console.error("[AudioWorklet] callExport", data.name, e);
            result = void 0;
          }
          this.port.postMessage({ type: "exportCalled", callId: data.callId, result });
          return;
        }
        if (data.type === "getTimeOffset") {
          if (this.wasmInstance && this.wasmInstance.exports.get_time_offset) {
            const offset = this.wasmInstance.exports.get_time_offset();
            this.port.postMessage({
              type: "timeOffset",
              offset
            });
          } else {
            console.error("[AudioWorklet] get_time_offset not available! wasmInstance:", !!this.wasmInstance);
            this.port.postMessage({
              type: "error",
              error: "get_time_offset function not available in WASM exports"
            });
          }
        }
        if (data.type === "setNTPStartTime") {
          if (this.wasmMemory && this.ringBufferBase !== null && this.bufferConstants) {
            const offset = this.ringBufferBase + this.bufferConstants.NTP_START_TIME_START;
            const view = new Float64Array(this.wasmMemory.buffer, offset, 1);
            view[0] = data.ntpStartTime;
          }
        }
        if (data.type === "setDriftOffset") {
          if (this.wasmMemory && this.ringBufferBase !== null && this.bufferConstants) {
            const offset = this.ringBufferBase + this.bufferConstants.DRIFT_OFFSET_START;
            const view = new Int32Array(this.wasmMemory.buffer, offset, 1);
            view[0] = data.driftOffsetUs;
          }
        }
        if (data.type === "setClockOffset") {
          if (this.wasmMemory && this.ringBufferBase !== null && this.bufferConstants) {
            const offset = this.ringBufferBase + this.bufferConstants.GLOBAL_OFFSET_START;
            const view = new Int32Array(this.wasmMemory.buffer, offset, 1);
            view[0] = data.clockOffsetMs;
          }
        }
        if (this.clockworkClockStateBigInt) {
          const views = { bigInt: this.clockworkClockStateBigInt, int32: this.clockworkClockStateInt32 };
          if (data.type === ClockworkClockMessageType.SET_SESSION_BPM) {
            retempoClock(views, data.bpm, data.nowNtp);
          } else if (data.type === ClockworkClockMessageType.SET_SESSION_IS_PLAYING) {
            writeClockTransport(views, data.isPlaying, data.atNtpSeconds);
          } else if (data.type === ClockworkClockMessageType.SET_SESSION_BEAT_ORIGIN_NTP) {
            writeClockOrigin(views, data.beatOriginNtp);
          } else if (data.type === ClockworkClockMessageType.SET_SESSION_METER) {
            if (isValidMeter(data.num, data.den)) writeClockMeter(views, data.num, data.den);
          }
        }
        if (data.type === "getMetrics") {
          const metrics = this.metricsView ? new Uint32Array(this.metricsView) : null;
          this.port.postMessage({
            type: "metricsSnapshot",
            requestId: data.requestId,
            metrics
          });
        }
        if (data.type === "copyBufferData") {
          try {
            const { copyId, ptr, data: bufferData } = data;
            if (!this.wasmMemory || !this.wasmMemory.buffer) {
              throw new Error("WASM memory not initialized");
            }
            const src = new Uint8Array(bufferData);
            new Uint8Array(this.wasmMemory.buffer, ptr, src.byteLength).set(src);
            if (true) {
              console.log(`[AudioWorklet] Copied ${src.byteLength} bytes to WASM memory at offset ${ptr}`);
            }
            this.port.postMessage({
              type: "bufferCopied",
              copyId,
              success: true
            });
          } catch (copyError) {
            console.error("[AudioWorklet] Buffer copy failed:", copyError);
            this.port.postMessage({
              type: "bufferCopied",
              copyId: data.copyId,
              success: false,
              error: copyError.message
            });
          }
        }
        if (data.type === "readBufferData") {
          try {
            const { readId, ptr, len } = data;
            if (!this.wasmMemory || !this.wasmMemory.buffer) {
              throw new Error("WASM memory not initialized");
            }
            const heap = this.wasmMemory.buffer.byteLength;
            if (!Number.isInteger(ptr) || !Number.isInteger(len) || ptr < 0 || len < 0 || ptr > heap || len > heap - ptr) {
              throw new Error(`read [${ptr}, ${ptr + len}) is outside the heap (${heap})`);
            }
            const out = new Uint8Array(len);
            out.set(new Uint8Array(this.wasmMemory.buffer, ptr, len));
            this.port.postMessage({
              type: "bufferRead",
              readId,
              success: true,
              data: out.buffer
            }, [out.buffer]);
          } catch (readError) {
            console.error("[AudioWorklet] Buffer read failed:", readError);
            this.port.postMessage({
              type: "bufferRead",
              readId: data.readId,
              success: false,
              error: readError.message
            });
          }
        }
        if (data.type === "growMemory") {
          try {
            const { growId, pages } = data;
            if (!this.wasmMemory) {
              throw new Error("WASM memory not initialized");
            }
            const result = this.wasmMemory.grow(pages);
            const success = result !== -1;
            if (success) {
              const newSize = this.wasmMemory.buffer.byteLength;
              console.log(`[AudioWorklet] Memory grown by ${pages} pages, new size: ${(newSize / (1024 * 1024)).toFixed(0)}MB`);
            }
            this.port.postMessage({
              type: "memoryGrown",
              growId,
              success,
              newBufferSize: this.wasmMemory.buffer.byteLength
            });
          } catch (growError) {
            console.error("[AudioWorklet] Memory grow failed:", growError);
            this.port.postMessage({
              type: "memoryGrown",
              growId: data.growId,
              success: false,
              error: growError.message
            });
          }
        }
      } catch (error) {
        console.error("[AudioWorklet] Error handling message:", error);
        this.port.postMessage({
          type: "error",
          error: error.message,
          stack: error.stack
        });
      }
    }
    process(inputs, outputs, parameters) {
      this.processCallCount++;
      if (!this.isInitialized) {
        return true;
      }
      try {
        if (this.wasmInstance && this.wasmInstance.exports.clockwork_tick) {
          if (this.pendingClearSched) {
            this.pendingClearSched = false;
            if (this.wasmInstance.exports.clear_scheduler) {
              this.wasmInstance.exports.clear_scheduler();
            }
          }
          const audioContextTime = currentTime;
          const inputChannels = inputs[0]?.length || 0;
          const outputChannels = outputs[0]?.length || 0;
          if (inputChannels > 0 && this.wasmInstance?.exports?.get_audio_input_bus) {
            try {
              const inputBusPtr = this.wasmInstance.exports.get_audio_input_bus();
              const numSamples = this.wasmInstance.exports.get_audio_buffer_samples();
              if (inputBusPtr && inputBusPtr > 0) {
                const memBuffer = this.sharedBuffer || this.wasmMemory?.buffer;
                if (memBuffer) {
                  const configuredChannels = this.inputChannels || 2;
                  const effectiveChannels = Math.min(inputChannels, configuredChannels);
                  if (!this.inputView || this.lastInputBusPtr !== inputBusPtr || this.lastInputChannels !== configuredChannels) {
                    this.inputView = new Float32Array(memBuffer, inputBusPtr, numSamples * configuredChannels);
                    this.lastInputBusPtr = inputBusPtr;
                    this.lastInputChannels = configuredChannels;
                  }
                  for (let ch = 0; ch < effectiveChannels; ch++) {
                    if (inputs[0]?.[ch]) {
                      this.inputView.set(inputs[0][ch], ch * numSamples);
                    }
                  }
                }
              }
            } catch (err) {
            }
          }
          const keepAlive = this.wasmInstance.exports.clockwork_tick(
            audioContextTime,
            outputChannels,
            inputChannels
          );
          if (this.nodeIdCounterView && this.nodeIdRangeCount > 0) {
            const current = Atomics.load(this.nodeIdCounterView, 0);
            if (current >= this.nodeIdRanges[0].to) {
              if (this.nodeIdRangeCount > 1) {
                const next = this.nodeIdRanges[1];
                this.nodeIdRanges[0].from = next.from;
                this.nodeIdRanges[0].to = next.to;
                next.from = 0;
                next.to = 0;
                this.nodeIdRangeCount = 1;
                Atomics.store(this.nodeIdCounterView, 0, this.nodeIdRanges[0].from);
              }
              if (!this.nodeIdRefillRequested && this.nodeIdPort) {
                this.nodeIdRefillRequested = true;
                this.nodeIdPort.postMessage({ type: "requestNodeIdRange" });
              }
            } else if (!this.nodeIdRefillRequested && this.nodeIdRangeCount < 2 && this.nodeIdPort) {
              const remaining = this.nodeIdRanges[0].to - current;
              const rangeSize = this.nodeIdRanges[0].to - this.nodeIdRanges[0].from;
              if (remaining <= rangeSize >>> 1) {
                this.nodeIdRefillRequested = true;
                this.nodeIdPort.postMessage({ type: "requestNodeIdRange" });
              }
            }
          }
          if (this.wasmInstance.exports.get_audio_output_bus && outputs[0] && outputs[0].length >= 1) {
            try {
              const audioBufferPtr = this.wasmInstance.exports.get_audio_output_bus();
              const numSamples = this.wasmInstance.exports.get_audio_buffer_samples();
              if (audioBufferPtr && audioBufferPtr > 0) {
                const wasmMemory = this.wasmInstance.exports.memory || this.wasmMemory;
                if (!wasmMemory || !wasmMemory.buffer) {
                  return true;
                }
                const currentBuffer = wasmMemory.buffer;
                const bufferSize = currentBuffer.byteLength;
                const configuredOutputChannels = this.outputChannels || 2;
                const effectiveOutputChannels = Math.min(outputs[0].length, configuredOutputChannels);
                const requiredBytes = audioBufferPtr + numSamples * effectiveOutputChannels * 4;
                if (audioBufferPtr < 0 || audioBufferPtr > bufferSize || requiredBytes > bufferSize) {
                  return true;
                }
                if (!this.audioView || this.lastAudioBufferPtr !== audioBufferPtr || this.lastWasmBufferSize !== bufferSize || this.lastNumChannels !== effectiveOutputChannels || currentBuffer !== this.audioView.buffer) {
                  this.audioView = new Float32Array(currentBuffer, audioBufferPtr, numSamples * effectiveOutputChannels);
                  this.lastAudioBufferPtr = audioBufferPtr;
                  this.lastWasmBufferSize = bufferSize;
                }
                if (!this.channelViews || this.lastNumSamples !== numSamples || this.lastNumChannels !== effectiveOutputChannels || this.channelViews[0].buffer !== this.audioView.buffer) {
                  this.channelViews = new Array(effectiveOutputChannels);
                  for (let ch = 0; ch < effectiveOutputChannels; ch++) {
                    this.channelViews[ch] = this.audioView.subarray(ch * numSamples, (ch + 1) * numSamples);
                  }
                  this.lastNumSamples = numSamples;
                  this.lastNumChannels = effectiveOutputChannels;
                }
                for (let ch = 0; ch < effectiveOutputChannels; ch++) {
                  outputs[0][ch].set(this.channelViews[ch]);
                }
              }
            } catch (err) {
            }
          }
          if (this.mode === "postMessage") {
            if (this.egressListening) this.readOscReplies();
            if (this.checkAndSendSnapshot(audioContextTime)) {
              this.sendLogEntries();
            }
          } else {
            if (this.atomicView) {
              const outHead = this.atomicLoad(this.CONTROL_INDICES.OUT_HEAD);
              const outTail = this.atomicLoad(this.CONTROL_INDICES.OUT_TAIL);
              if (outHead !== outTail) {
                Atomics.notify(this.atomicView, this.CONTROL_INDICES.OUT_HEAD, 1);
              }
              const inTail = this.atomicLoad(this.CONTROL_INDICES.IN_TAIL);
              if (inTail !== this.lastInTail) {
                Atomics.notify(this.atomicView, this.CONTROL_INDICES.IN_TAIL, 1);
                this.lastInTail = inTail;
              }
            }
          }
          if (this.processCallCount % 3750 === 0) {
            this.checkStatus();
          }
          return keepAlive !== 0;
        }
      } catch (error) {
        console.error("[AudioWorklet] process() error:", error);
        console.error("[AudioWorklet] Stack:", error.stack);
        if (this.atomicView && this.mode === "sab") {
          Atomics.or(this.atomicView, this.CONTROL_INDICES.STATUS_FLAGS, this.STATUS_FLAGS.WASM_ERROR);
        }
        if (this.metricsView) {
          if (this.mode === "sab") {
            Atomics.add(this.metricsView, ENGINE_WASM_ERRORS, 1);
          } else {
            this.metricsView[ENGINE_WASM_ERRORS]++;
          }
        }
      }
      return true;
    }
    checkStatus() {
      if (!this.atomicView) return;
      const statusFlags = this.atomicLoad(this.CONTROL_INDICES.STATUS_FLAGS);
      if (statusFlags !== this.STATUS_FLAGS.OK) {
        this._statusObj.bufferFull = !!(statusFlags & this.STATUS_FLAGS.BUFFER_FULL);
        this._statusObj.overrun = !!(statusFlags & this.STATUS_FLAGS.OVERRUN);
        this._statusObj.wasmError = !!(statusFlags & this.STATUS_FLAGS.WASM_ERROR);
        this._statusObj.fragmented = !!(statusFlags & this.STATUS_FLAGS.FRAGMENTED_MSG);
        this._metricsObj.processCount = this.metricsView[ENGINE_PROCESS_COUNT];
        this._metricsObj.messagesProcessed = this.metricsView[ENGINE_MESSAGES_PROCESSED];
        this._metricsObj.messagesDropped = this.metricsView[ENGINE_MESSAGES_DROPPED];
        this._metricsObj.schedulerQueueDepth = this.metricsView[ENGINE_SCHEDULER_DEPTH];
        this._metricsObj.schedulerQueueMax = this.metricsView[ENGINE_SCHEDULER_PEAK_DEPTH];
        this._metricsObj.schedulerQueueDropped = this.metricsView[ENGINE_SCHEDULER_DROPPED];
        this._statusMessage.flags = statusFlags;
        this.port.postMessage(this._statusMessage);
        const persistentFlags = statusFlags & this.STATUS_FLAGS.BUFFER_FULL;
        this.atomicStore(this.CONTROL_INDICES.STATUS_FLAGS, persistentFlags);
      }
    }
  };
  registerProcessor("clockwork-processor", ClockworkProcessor);
})();
