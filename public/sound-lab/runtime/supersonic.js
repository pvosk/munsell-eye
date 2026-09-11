// clockwork/js/lib/transport/transport.js
var Transport = class _Transport {
  /**
   * @param {TransportConfig} config
   */
  constructor(config) {
    if (new.target === _Transport) {
      throw new Error("Transport is abstract - use SABTransport or PostMessageTransport");
    }
    this._config = config;
    this._disposed = false;
  }
  /**
   * Get the transport mode
   * @returns {'sab' | 'postMessage'}
   */
  get mode() {
    return this._config.mode;
  }
  /**
   * Send an OSC message to the audio engine
   * @param {Uint8Array} message - OSC message bytes
   * @param {number} [timestamp] - NTP timestamp for scheduling (optional)
   * @returns {boolean} True if sent successfully
   */
  send(message, timestamp) {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Register callback for OSC replies from engine
   * @param {function(Uint8Array, number, number): void} callback - Receives (oscData, sequence, timestamp)
   */
  onReply(callback) {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Register callback for debug messages from engine
   * @param {function(string): void} callback
   */
  onDebug(callback) {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Register callback for transport errors
   * @param {function(string, string): void} callback - Receives (error, workerName)
   */
  onError(callback) {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Get current transport metrics
   * @returns {TransportMetrics}
   */
  getMetrics() {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Initialize the transport (called after worklet is ready)
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Create an OscChannel for direct worker-to-worklet communication
   *
   * Returns an OscChannel that can be transferred to a Web Worker,
   * allowing that worker to send OSC messages directly to the AudioWorklet.
   *
   * @returns {OscChannel}
   */
  createOscChannel() {
    throw new Error("Abstract method - implement in subclass");
  }
  /**
   * Clean up resources
   */
  dispose() {
    this._disposed = true;
  }
  /**
   * Check if transport is ready to send
   * @returns {boolean}
   */
  get ready() {
    throw new Error("Abstract method - implement in subclass");
  }
};

// clockwork/js/lib/worker_loader.js
var blobUrlCache = /* @__PURE__ */ new Map();
function isCrossOrigin(url) {
  try {
    const scriptUrl = new URL(url, window.location.href);
    return scriptUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}
async function fetchAsBlobUrl(url) {
  if (blobUrlCache.has(url)) {
    return blobUrlCache.get(url);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const scriptText = await response.text();
  const blob = new Blob([scriptText], { type: "application/javascript" });
  const blobUrl = URL.createObjectURL(blob);
  blobUrlCache.set(url, blobUrl);
  return blobUrl;
}
async function createWorker(url, options = {}) {
  let workerUrl = url;
  if (isCrossOrigin(url)) {
    workerUrl = await fetchAsBlobUrl(url);
  }
  return new Worker(workerUrl, options);
}
async function addWorkletModule(audioWorklet, url) {
  let moduleUrl = url;
  if (isCrossOrigin(url)) {
    moduleUrl = await fetchAsBlobUrl(url);
  }
  await audioWorklet.addModule(moduleUrl);
}

// clockwork/js/lib/wasm_client.js
var CLOCKWORK_OK = 0;
var CLIENT_MESSAGE_BYTES = 20;
var MESSAGE_BYTES = CLIENT_MESSAGE_BYTES;
var HANDLE_OFFSET = 0;
var HANDLE_BYTES = 256;
var TAP_OFFSET = 256;
var TAP_BYTES = 256;
var OUTPARAM_OFFSET = 512;
var MESSAGES_OFFSET = 1024;
function claimClientSlot(atomicView, ringBufferBase, constants) {
  const word = ringBufferBase + constants.CLIENT_SLOTS_START >> 2;
  const count = constants.CLIENT_SLOT_COUNT;
  for (; ; ) {
    const seen = Atomics.load(atomicView, word);
    let index = -1;
    for (let i = 0; i < count; i++) {
      if ((seen & 1 << i) === 0) {
        index = i;
        break;
      }
    }
    if (index < 0) return -1;
    const bit = 1 << index;
    if (Atomics.compareExchange(atomicView, word, seen, seen | bit) === seen)
      return index;
  }
}
function releaseClientSlot(atomicView, ringBufferBase, constants, index) {
  if (index < 0) return;
  const word = ringBufferBase + constants.CLIENT_SLOTS_START >> 2;
  const bit = 1 << index;
  for (; ; ) {
    const seen = Atomics.load(atomicView, word);
    if (Atomics.compareExchange(atomicView, word, seen, seen & ~bit) === seen)
      return;
  }
}
function moduleImports(memory, label) {
  const noop = () => 0;
  return {
    env: {
      memory,
      emscripten_notify_memory_growth: noop,
      _emscripten_thread_set_strongref: noop,
      emscripten_exit_with_live_runtime: noop,
      __syscall_getcwd: noop,
      _emscripten_init_main_thread_js: noop,
      _emscripten_thread_mailbox_await: noop,
      _emscripten_receive_on_main_thread_js: noop,
      emscripten_check_blocking_allowed: noop,
      _emscripten_thread_cleanup: noop,
      _emscripten_notify_mailbox_postmessage: noop
    },
    wasi_snapshot_preview1: {
      clock_time_get: noop,
      // Rust's std seeds its hash maps here, and a guest may use
      // randomness of its own. Present in every context that instantiates
      // the module, not only the worklet, or the instantiation fails when
      // the guest imports it.
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
      fd_close: noop,
      environ_sizes_get: noop,
      environ_get: noop,
      fd_seek: noop,
      fd_read: noop,
      proc_exit: (code) => {
        console.error(`[${label}] wasm tried to exit with code`, code);
      },
      fd_write: (fd, iov, count, pnum) => {
        const view = new DataView(memory.buffer);
        const u8 = new Uint8Array(memory.buffer);
        let written = 0;
        let text = "";
        for (let i = 0; i < count; i++) {
          const ptr = view.getUint32(iov + i * 8, true);
          const len = view.getUint32(iov + i * 8 + 4, true);
          for (let j = 0; j < len; j++) text += String.fromCharCode(u8[ptr + j]);
          written += len;
        }
        if (pnum) view.setUint32(pnum, written, true);
        const line = text.replace(/\n+$/, "");
        if (line) (fd === 2 ? console.error : console.log)(`[${label}] ${line}`);
        return 0;
      }
    }
  };
}
var WasmClient = class _WasmClient {
  #exports;
  #memory;
  #handle = 0;
  #tap = 0;
  #slotIndex = -1;
  #atomicView;
  #ringBufferBase;
  #constants;
  #messagesPtr = 0;
  #maxMessages = 0;
  #outParamPtr = 0;
  #label;
  /**
   * @param {object}             opts
   * @param {WebAssembly.Module} opts.wasmModule      compiled once, shared by every context
   * @param {WebAssembly.Memory} opts.wasmMemory      the engine's, shared
   * @param {number}             opts.ringBufferBase  what get_ring_buffer_base() returned
   * @param {object}             opts.bufferConstants the BufferLayout, as JS reads it
   * @param {string}             [opts.label]         for diagnostics
   * @returns {Promise<WasmClient>}
   * @throws when no slot is free, or the engine will not open. Both are
   *         wiring faults rather than conditions to handle: a context that
   *         carried on without a client would look like a working transport
   *         that silently delivers nothing.
   */
  static async open({ wasmModule: wasmModule3, wasmMemory, ringBufferBase, bufferConstants, label = "WasmClient" }) {
    const c = new _WasmClient();
    c.#memory = wasmMemory;
    c.#ringBufferBase = ringBufferBase;
    c.#constants = bufferConstants;
    c.#label = label;
    c.#atomicView = new Int32Array(wasmMemory.buffer);
    c.#slotIndex = claimClientSlot(c.#atomicView, ringBufferBase, bufferConstants);
    if (c.#slotIndex < 0) {
      throw new Error(`[${label}] no client slot free \u2014 all ${bufferConstants.CLIENT_SLOT_COUNT} are taken. Raise CLIENT_SLOT_COUNT in shared_memory.h, or close a client.`);
    }
    const instance = await WebAssembly.instantiate(wasmModule3, moduleImports(wasmMemory, label));
    c.#exports = instance.exports;
    const slotBase = ringBufferBase + bufferConstants.CLIENT_SLOTS_START + bufferConstants.CLIENT_SLOTS_HEADER_SIZE + c.#slotIndex * bufferConstants.CLIENT_SLOT_SIZE;
    const stackLow = slotBase + bufferConstants.CLIENT_SLOT_STACK_OFFSET;
    const stackHigh = stackLow + bufferConstants.CLIENT_SLOT_STACK_SIZE;
    c.#exports.emscripten_stack_set_limits(stackHigh, stackLow);
    c.#exports._emscripten_stack_restore(stackHigh);
    const structs = slotBase + bufferConstants.CLIENT_SLOT_STRUCTS_OFFSET;
    c.#outParamPtr = structs + OUTPARAM_OFFSET;
    c.#messagesPtr = structs + MESSAGES_OFFSET;
    c.#maxMessages = Math.floor(
      (bufferConstants.CLIENT_SLOT_STRUCTS_SIZE - MESSAGES_OFFSET) / MESSAGE_BYTES
    );
    const handleBytes = c.#exports.clockwork_client_sizeof();
    const tapBytes = c.#exports.clockwork_client_tap_sizeof();
    if (handleBytes > HANDLE_BYTES || tapBytes > TAP_BYTES) {
      c.close();
      throw new Error(`[${label}] client structs outgrew their slot: handle ${handleBytes}/${HANDLE_BYTES}, tap ${tapBytes}/${TAP_BYTES}`);
    }
    c.#handle = c.#exports.clockwork_client_open_memory_in(
      structs + HANDLE_OFFSET,
      HANDLE_BYTES,
      ringBufferBase,
      bufferConstants.TOTAL_BUFFER_SIZE,
      c.#outParamPtr
    );
    if (!c.#handle) {
      const status = new Int32Array(wasmMemory.buffer, c.#outParamPtr, 1)[0];
      c.close();
      throw new Error(`[${label}] client boundary unavailable, status ${status}`);
    }
    return c;
  }
  get slotIndex() {
    return this.#slotIndex;
  }
  /**
   * Where this instance's stack pointer currently is.
   *
   * Diagnostic, and the one thing worth checking after open: it must be
   * inside this client's own slot. An instance that skipped the hand-off
   * still works right up until the audio thread is mid-call, so "it ran" is
   * no evidence at all — the address is.
   */
  stackPointer() {
    return this.#exports.emscripten_stack_get_current();
  }
  /** The half-open range this client's stack may occupy. */
  stackRange() {
    const base = this.#ringBufferBase + this.#constants.CLIENT_SLOTS_START + this.#constants.CLIENT_SLOTS_HEADER_SIZE + this.#slotIndex * this.#constants.CLIENT_SLOT_SIZE + this.#constants.CLIENT_SLOT_STACK_OFFSET;
    return { low: base, high: base + this.#constants.CLIENT_SLOT_STACK_SIZE };
  }
  /**
   * Frame an OSC message onto the ingress ring.
   *
   * The bytes go straight into the ring: begin reserves the frame's own
   * position, this copies into it once, commit publishes. The reservation
   * holds the ring's write lock, so the finally is not tidiness — a return
   * or a throw between the two would stop the ring for every producer.
   *
   * @returns {boolean} false when it was refused; the ring being momentarily
   *                    full is the ordinary reason.
   */
  send(oscData, sourceId = 0) {
    if (!this.#handle) return false;
    const bytes = oscData.byteLength ?? oscData.length;
    if (!bytes) return false;
    const ptr = this.#exports.clockwork_client_send_begin(
      this.#handle,
      bytes,
      this.#outParamPtr
    );
    if (!ptr) return false;
    let committed = false;
    try {
      const src = oscData instanceof Uint8Array ? oscData : new Uint8Array(oscData);
      new Uint8Array(this.#memory.buffer, ptr, bytes).set(src);
      committed = this.#exports.clockwork_client_send_commit(
        this.#handle,
        bytes,
        sourceId
      ) === CLOCKWORK_OK;
      return committed;
    } finally {
      if (!committed) this.#exports.clockwork_client_send_abort(this.#handle);
    }
  }
  /** Watch a ring rather than take from it. One tap per client. */
  openTap(ring) {
    if (!this.#handle || this.#tap) return false;
    const structs = this.#slotStructsBase();
    this.#tap = this.#exports.clockwork_client_tap_open_in(
      structs + TAP_OFFSET,
      TAP_BYTES,
      this.#handle,
      ring,
      this.#outParamPtr
    );
    if (!this.#tap) {
      const status = new Int32Array(this.#memory.buffer, this.#outParamPtr, 1)[0];
      console.error(`[${this.#label}] tap unavailable, status`, status);
      return false;
    }
    return true;
  }
  /** Frames written past this tap before it read them, since it opened. */
  tapMissed() {
    return this.#tap ? this.#exports.clockwork_client_tap_missed(this.#tap) : 0;
  }
  /**
   * Take replies from the egress ring. `onMessage(bytes, origin, route, seq)`
   * is called for each; `bytes` is a view into the ring, so a caller that
   * keeps it copies it.
   * @returns {number} how many were delivered
   */
  poll(onMessage, max = this.#maxMessages) {
    if (!this.#handle) return 0;
    return this.#deliver(
      this.#exports.clockwork_client_poll(
        this.#handle,
        this.#messagesPtr,
        Math.min(max, this.#maxMessages)
      ),
      onMessage
    );
  }
  /** As poll, for the tap: reads without taking. */
  tapPoll(onMessage, max = this.#maxMessages) {
    if (!this.#tap) return 0;
    return this.#deliver(
      this.#exports.clockwork_client_tap_poll(
        this.#tap,
        this.#messagesPtr,
        Math.min(max, this.#maxMessages)
      ),
      onMessage
    );
  }
  close() {
    if (this.#tap) {
      this.#exports.clockwork_client_tap_close(this.#tap);
      this.#tap = 0;
    }
    if (this.#handle) {
      this.#exports.clockwork_client_close(this.#handle);
      this.#handle = 0;
    }
    if (this.#slotIndex >= 0) {
      releaseClientSlot(
        this.#atomicView,
        this.#ringBufferBase,
        this.#constants,
        this.#slotIndex
      );
      this.#slotIndex = -1;
    }
  }
  #slotStructsBase() {
    return this.#ringBufferBase + this.#constants.CLIENT_SLOTS_START + this.#constants.CLIENT_SLOTS_HEADER_SIZE + this.#slotIndex * this.#constants.CLIENT_SLOT_SIZE + this.#constants.CLIENT_SLOT_STRUCTS_OFFSET;
  }
  // One view per call over the message array the C just filled. The buffer
  // is re-read each time because a growable memory detaches its old one.
  #deliver(count, onMessage) {
    if (!count) return 0;
    const view = new DataView(this.#memory.buffer);
    for (let i = 0; i < count; i++) {
      const at = this.#messagesPtr + i * MESSAGE_BYTES;
      const ptr = view.getUint32(at, true);
      const len = view.getUint32(at + 4, true);
      const origin = view.getUint32(at + 8, true);
      const route = view.getUint32(at + 12, true);
      const sequence = view.getUint32(at + 16, true);
      if (!ptr || !len) continue;
      onMessage(new Uint8Array(this.#memory.buffer, ptr, len), origin, route, sequence);
    }
    return count;
  }
};

// clockwork/js/lib/metrics_offsets.js
var ENGINE_PROCESS_COUNT = 0;
var ENGINE_MESSAGES_PROCESSED = 1;
var ENGINE_MESSAGES_DROPPED = 2;
var ENGINE_SCHEDULER_DEPTH = 3;
var ENGINE_SCHEDULER_PEAK_DEPTH = 4;
var ENGINE_SCHEDULER_DROPPED = 5;
var ENGINE_SEQUENCE_GAPS = 6;
var ENGINE_WASM_ERRORS = 7;
var ENGINE_SCHEDULER_LATES = 8;
var OSC_OUT_MESSAGES_SENT = 9;
var OSC_OUT_BYTES_SENT = 10;
var OSC_IN_MESSAGES_RECEIVED = 11;
var OSC_IN_BYTES_RECEIVED = 12;
var OSC_IN_DROPPED_MESSAGES = 13;
var OSC_IN_CORRUPTED = 14;
var DEBUG_MESSAGES_RECEIVED = 15;
var DEBUG_BYTES_RECEIVED = 16;
var IN_BUFFER_USED_BYTES = 17;
var OUT_BUFFER_USED_BYTES = 18;
var NRT_OUT_BUFFER_USED_BYTES = 19;
var IN_BUFFER_PEAK_BYTES = 20;
var OUT_BUFFER_PEAK_BYTES = 21;
var NRT_OUT_BUFFER_PEAK_BYTES = 22;
var ENGINE_SCHEDULER_MAX_LATE_MS = 23;
var ENGINE_SCHEDULER_LAST_LATE_MS = 24;
var ENGINE_SCHEDULER_LAST_LATE_TICK = 25;
var RING_BUFFER_DIRECT_WRITE_FAILS = 26;
var LINK_PEERS = 27;
var LINK_TEMPO_MBPM = 28;
var LINK_BEAT_CENTI = 29;
var LINK_PHASE_CENTI = 30;
var LINK_PLAYING = 31;
var LINK_AUDIO_IN_CHANNELS = 32;
var LINK_AUDIO_STREAM_RATE = 33;
var LINK_AUDIO_UNDERRUNS = 34;
var LINK_AUDIO_BUFFERED_MS = 35;
var LINK_AUDIO_DRIFT_PPM = 36;
var LINK_AUDIO_PUBLISH = 37;
var LINK_AUDIO_SINKS = 38;
var CLOCKWORK_VERSION_MAJOR = 39;
var CLOCKWORK_VERSION_MINOR = 40;
var CLOCKWORK_VERSION_PATCH = 41;
var AUDIO_SAMPLE_RATE = 42;
var AUDIO_BLOCK_SIZE = 43;
var AUDIO_OUTPUT_CHANNELS = 44;
var AUDIO_INPUT_CHANNELS = 45;
var CLOCK_TEMPO_MBPM = 46;
var CLOCK_BEAT_CENTI = 47;
var CLOCK_PHASE_CENTI = 48;
var CLOCK_PLAYING = 49;
var METRICS_RESERVED = 50;
var SAB_METRICS_COUNT = METRICS_RESERVED + 1;
var CTX_DRIFT_OFFSET_MS = 50;
var CTX_CLOCK_OFFSET_MS = 51;
var CTX_AUDIO_CONTEXT_STATE = 52;
var CTX_ENGINE_SCHEDULER_CAPACITY = 57;
var CTX_IN_BUFFER_CAPACITY = 58;
var CTX_OUT_BUFFER_CAPACITY = 59;
var CTX_NRT_OUT_BUFFER_CAPACITY = 60;
var CTX_MODE = 61;
var CTX_GLITCH_COUNT = 62;
var CTX_GLITCH_DURATION_MS = 63;
var CTX_AVERAGE_LATENCY_US = 64;
var CTX_MAX_LATENCY_US = 65;
var CTX_AUDIO_HEALTH_PCT = 66;
var CTX_TOTAL_FRAMES_DURATION_MS = 67;
var CTX_HAS_PLAYBACK_STATS = 68;
var GUEST_METRICS_BASE = 69;
var GUEST_METRICS_COUNT = 32;
var MERGED_ARRAY_SIZE = GUEST_METRICS_BASE + GUEST_METRICS_COUNT;

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
function calculateInControlIndices(ringBufferBase, CONTROL_START) {
  const base = ringBufferBase + CONTROL_START;
  return {
    IN_HEAD: (base + IN_HEAD) / 4,
    IN_TAIL: (base + IN_TAIL) / 4,
    IN_SEQUENCE: (base + IN_SEQUENCE) / 4,
    IN_WRITE_LOCK: (base + IN_WRITE_LOCK) / 4
  };
}
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

// clockwork/js/lib/osc_channel.js
var OscChannel = class _OscChannel {
  #mode;
  #directPort;
  // postMessage mode: MessagePort to worklet
  #sabConfig;
  // SAB mode: { sharedBuffer, ringBufferBase, bufferConstants, controlIndices }
  #wasmClient;
  // SAB mode: this thread's way into the ingress ring
  #metricsView;
  // SAB mode: Int32Array view into metrics region
  #sourceId;
  // Numeric source ID (0 = main thread, 1+ = workers)
  // Node ID allocation (range-based)
  #nodeIdView;
  // SAB mode: Int32Array view for atomic counter
  #nodeIdFrom;
  // Start of current range (inclusive)
  #nodeIdTo;
  // End of current range (exclusive)
  #nextNodeId;
  // Next ID to return within range
  #nodeIdRangeSize;
  // Number of IDs per range allocation
  #nodeIdSource;
  // PM mode (main thread): function to claim a range directly
  #nodeIdPort;
  // PM mode (worker): MessagePort for requesting ranges from main thread
  #pendingNodeIdRange;
  // PM mode (worker): pre-fetched next range
  #transferNodeIdPort;
  // PM mode: port to include in transferList (created by transferable getter)
  // Local metrics counters
  // SAB mode: used for tracking, then written atomically to shared memory
  // PM mode: accumulated locally, reported via getMetrics()
  #localMetrics = {
    messagesSent: 0,
    bytesSent: 0
  };
  /**
   * Private constructor - use static factory methods
   */
  constructor(mode, config) {
    this.#mode = mode;
    this.#sourceId = config.sourceId ?? 0;
    this.#nodeIdRangeSize = 1e3;
    if (mode === "postMessage") {
      this.#directPort = config.port;
    } else {
      this.#sabConfig = {
        sharedBuffer: config.sharedBuffer,
        ringBufferBase: config.ringBufferBase,
        bufferConstants: config.bufferConstants,
        controlIndices: config.controlIndices,
        // Carried so this channel can be handed to a worker, which
        // opens a client of its own from them.
        wasmMemory: config.wasmMemory,
        wasmModule: config.wasmModule
      };
      this.#wasmClient = config.wasmClient ?? null;
      if (config.sharedBuffer && config.bufferConstants) {
        const metricsBase = config.ringBufferBase + config.bufferConstants.METRICS_START;
        this.#metricsView = new Int32Array(
          config.sharedBuffer,
          metricsBase,
          config.bufferConstants.METRICS_SIZE / 4
        );
      }
      if (config.sharedBuffer && config.bufferConstants?.NODE_ID_COUNTER_START !== void 0) {
        const counterBase = config.ringBufferBase + config.bufferConstants.NODE_ID_COUNTER_START;
        this.#nodeIdView = new Int32Array(config.sharedBuffer, counterBase, 1);
        this.#claimNodeIdRange();
      }
    }
    if (config.nodeIdSource) {
      this.#nodeIdSource = config.nodeIdSource;
      this.#claimNodeIdRange();
    }
    if (config.nodeIdRange) {
      this.#nodeIdFrom = config.nodeIdRange.from;
      this.#nodeIdTo = config.nodeIdRange.to;
      this.#nextNodeId = config.nodeIdRange.from;
    }
    if (config.nodeIdPort) {
      this.#nodeIdPort = config.nodeIdPort;
      this.#nodeIdPort.onmessage = (e) => {
        if (e.data.type === "nodeIdRange") {
          this.#pendingNodeIdRange = { from: e.data.from, to: e.data.to };
        }
      };
      this.#requestNodeIdRange();
    }
  }
  // =========================================================================
  // Metrics
  // =========================================================================
  /**
   * Record a successful send — message + byte counts.
   * @param {number} byteCount - Size of the message in bytes
   */
  #recordSend(byteCount) {
    if (this.#mode === "sab" && this.#metricsView) {
      Atomics.add(this.#metricsView, OSC_OUT_MESSAGES_SENT, 1);
      Atomics.add(this.#metricsView, OSC_OUT_BYTES_SENT, byteCount);
    } else {
      this.#localMetrics.messagesSent++;
      this.#localMetrics.bytesSent += byteCount;
    }
  }
  /**
   * Get and reset local metrics (for periodic reporting)
   * @returns {Object} Metrics snapshot
   */
  getAndResetMetrics() {
    const snapshot = { ...this.#localMetrics };
    this.#localMetrics = { messagesSent: 0, bytesSent: 0 };
    return snapshot;
  }
  /**
   * Get current metrics snapshot.
   * SAB mode: reads aggregated metrics from shared memory
   * PM mode: returns local metrics (aggregated via heartbeat)
   */
  getMetrics() {
    if (this.#mode === "sab" && this.#metricsView) {
      return {
        messagesSent: Atomics.load(this.#metricsView, OSC_OUT_MESSAGES_SENT),
        bytesSent: Atomics.load(this.#metricsView, OSC_OUT_BYTES_SENT)
      };
    }
    return { ...this.#localMetrics };
  }
  // =========================================================================
  // Sending
  // =========================================================================
  /**
   * Send an OSC message: frame it onto the IN ring (SAB) or postMessage it to
   * the worklet (PM). Classification and scheduling happen on the audio thread
   * (the engine's OscIngress + BundleScheduler) — the producer never classifies.
   *
   * In SAB mode a send fails only when the ring is FULL. Producers serialise
   * on the writer's own spinlock, which waits rather than giving up, so
   * contention between a worker and the main thread costs a moment instead
   * of a dropped message — the critical section is a header and a memcpy.
   *
   * @param {Uint8Array} oscData - OSC message bytes
   * @returns {boolean} true if sent
   */
  send(oscData) {
    if (this.#mode === "postMessage") {
      if (!this.#directPort) return false;
      this.#directPort.postMessage({ type: "osc", oscData, sourceId: this.#sourceId });
      this.#recordSend(oscData.length);
      return true;
    }
    if (!this.#wasmClient) return false;
    const success = this.#wasmClient.send(oscData, this.#sourceId);
    if (success) {
      this.#recordSend(oscData.length);
    } else if (this.#metricsView) {
      Atomics.add(this.#metricsView, RING_BUFFER_DIRECT_WRITE_FAILS, 1);
    }
    return success;
  }
  /**
   * Alias of {@link send} — kept for callers that used the explicit direct path.
   * @param {Uint8Array} oscData
   * @returns {boolean}
   */
  sendDirect(oscData) {
    return this.send(oscData);
  }
  // =========================================================================
  // Node ID Allocation
  // =========================================================================
  /**
   * Get the next unique node ID.
   *
   * SAB mode: single atomic increment — always correct, no batching needed.
   * PM mode: range-based allocation with async pre-fetching from main thread.
   *
   * @returns {number} A unique node ID (>= 1000)
   */
  nextNodeId() {
    if (this.#nodeIdView) {
      return Atomics.add(this.#nodeIdView, 0, 1);
    }
    if (this.#nextNodeId >= this.#nodeIdTo) {
      this.#claimNodeIdRange();
    }
    const id = this.#nextNodeId++;
    if (this.#nodeIdPort && !this.#pendingNodeIdRange && this.#nodeIdTo - this.#nextNodeId <= this.#nodeIdRangeSize >>> 1) {
      this.#requestNodeIdRange();
    }
    return id;
  }
  /**
   * Claim a new range of node IDs (PM mode only).
   * Main thread: use the direct source function.
   * Worker: use pre-fetched range from main thread.
   */
  #claimNodeIdRange() {
    if (this.#nodeIdSource) {
      const range = this.#nodeIdSource(this.#nodeIdRangeSize);
      this.#nodeIdFrom = range.from;
      this.#nodeIdTo = range.to;
      this.#nextNodeId = range.from;
    } else if (this.#pendingNodeIdRange) {
      this.#nodeIdFrom = this.#pendingNodeIdRange.from;
      this.#nodeIdTo = this.#pendingNodeIdRange.to;
      this.#nextNodeId = this.#pendingNodeIdRange.from;
      this.#pendingNodeIdRange = null;
      this.#requestNodeIdRange();
    } else if (this.#nodeIdPort) {
      throw new Error(
        "[OscChannel] Node ID range exhausted before async refill arrived. Yield to the event loop between large batches of nextNodeId() calls."
      );
    }
  }
  /**
   * Request a new node ID range from the main thread via MessagePort.
   * Used by PM mode worker channels.
   */
  #requestNodeIdRange() {
    if (this.#nodeIdPort) {
      this.#nodeIdPort.postMessage({ type: "requestNodeIdRange" });
    }
  }
  // =========================================================================
  // Properties
  // =========================================================================
  /**
   * Get the transport mode
   * @returns {'sab' | 'postMessage'}
   */
  get mode() {
    return this.#mode;
  }
  /**
   * Get data needed to transfer this channel to a worker
   * Use with: worker.postMessage({ channel: oscChannel.transferable }, oscChannel.transferList)
   * @returns {Object} Serializable config object
   */
  get transferable() {
    const base = {
      mode: this.#mode,
      sourceId: this.#sourceId
    };
    if (this.#mode === "postMessage") {
      const workerRangeSize = this.#nodeIdRangeSize * 10;
      let nodeIdRange;
      let nodeIdPort;
      if (this.#nodeIdSource) {
        const range = this.#nodeIdSource(workerRangeSize);
        nodeIdRange = { from: range.from, to: range.to };
        const nodeIdChannel = new MessageChannel();
        const source = this.#nodeIdSource;
        const rangeSize = this.#nodeIdRangeSize;
        nodeIdChannel.port1.onmessage = (e) => {
          if (e.data.type === "requestNodeIdRange") {
            const r = source(rangeSize);
            nodeIdChannel.port1.postMessage({ type: "nodeIdRange", from: r.from, to: r.to });
          }
        };
        nodeIdPort = nodeIdChannel.port2;
        this.#transferNodeIdPort = nodeIdPort;
      }
      return {
        ...base,
        port: this.#directPort,
        nodeIdRange,
        nodeIdPort
      };
    } else {
      return {
        ...base,
        sharedBuffer: this.#sabConfig.sharedBuffer,
        ringBufferBase: this.#sabConfig.ringBufferBase,
        bufferConstants: this.#sabConfig.bufferConstants,
        controlIndices: this.#sabConfig.controlIndices,
        // The receiving worker opens its own client from these: a
        // client carries a stack, and a stack belongs to one thread.
        wasmMemory: this.#sabConfig.wasmMemory,
        wasmModule: this.#sabConfig.wasmModule
      };
    }
  }
  /**
   * Get the list of transferable objects for postMessage
   * @returns {Array} Array of transferable objects
   */
  get transferList() {
    const list = [];
    if (this.#mode === "postMessage" && this.#directPort) {
      list.push(this.#directPort);
    }
    if (this.#transferNodeIdPort) {
      list.push(this.#transferNodeIdPort);
      this.#transferNodeIdPort = null;
    }
    return list;
  }
  /**
   * Close the channel
   */
  close() {
    if (this.#mode === "postMessage" && this.#directPort) {
      this.#directPort.close();
      this.#directPort = null;
    }
  }
  // =========================================================================
  // Static Factory Methods
  // =========================================================================
  /**
   * Create a postMessage-backed OscChannel
   * @private
   * @param {Object} config
   * @param {MessagePort} config.port - MessagePort connected to the worklet
   * @param {number} [config.sourceId=0] - Source ID (0 = main, 1+ = workers)
   * @returns {OscChannel}
   */
  static createPostMessage(config) {
    if (config instanceof MessagePort) {
      return new _OscChannel("postMessage", { port: config });
    }
    return new _OscChannel("postMessage", config);
  }
  /**
   * Create a SAB-backed OscChannel
   * @private
   * @param {Object} config
   * @param {SharedArrayBuffer} config.sharedBuffer
   * @param {number} config.ringBufferBase
   * @param {Object} config.bufferConstants
   * @param {Object} [config.controlIndices] - If not provided, will be calculated
   * @param {number} [config.sourceId=0] - Source ID (0 = main, 1+ = workers)
   * @returns {OscChannel}
   */
  static createSAB(config) {
    let controlIndices = config.controlIndices;
    if (!controlIndices) {
      controlIndices = calculateInControlIndices(
        config.ringBufferBase,
        config.bufferConstants.CONTROL_START
      );
    }
    return new _OscChannel("sab", {
      sharedBuffer: config.sharedBuffer,
      ringBufferBase: config.ringBufferBase,
      bufferConstants: config.bufferConstants,
      controlIndices,
      wasmClient: config.wasmClient,
      wasmMemory: config.wasmMemory,
      wasmModule: config.wasmModule,
      sourceId: config.sourceId
    });
  }
  /**
   * Reconstruct an OscChannel from transferred data.
   * Use in worker: const channel = await OscChannel.fromTransferable(event.data.channel)
   *
   * AWAITED, because a SAB channel in a worker opens a module instance of
   * its own over the engine's memory, and instantiating one is asynchronous.
   * The worker gets its own stack that way, which is the only safe way for a
   * second context to run the ring code at all.
   *
   * @param {Object} data - Data from transferable getter
   * @returns {Promise<OscChannel>}
   */
  static async fromTransferable(data) {
    if (data.mode === "postMessage") {
      return new _OscChannel("postMessage", {
        port: data.port,
        sourceId: data.sourceId,
        nodeIdRange: data.nodeIdRange,
        nodeIdPort: data.nodeIdPort
      });
    } else {
      const wasmClient = await WasmClient.open({
        wasmModule: data.wasmModule,
        wasmMemory: data.wasmMemory,
        ringBufferBase: data.ringBufferBase,
        bufferConstants: data.bufferConstants,
        label: `OscChannel(source ${data.sourceId})`
      });
      return new _OscChannel("sab", {
        sharedBuffer: data.sharedBuffer,
        ringBufferBase: data.ringBufferBase,
        bufferConstants: data.bufferConstants,
        controlIndices: data.controlIndices,
        wasmClient,
        wasmMemory: data.wasmMemory,
        wasmModule: data.wasmModule,
        sourceId: data.sourceId
      });
    }
  }
};

// clockwork/js/lib/transport/sab_transport.js
var SABTransport = class extends Transport {
  #sharedBuffer;
  #ringBufferBase;
  #bufferConstants;
  // The engine's module and memory, so this thread can run the client
  // boundary rather than reimplement the ring. One client serves every
  // main-thread channel: the source id travels with each send, so they do
  // not need one each, and slots are few.
  #wasmMemory;
  #wasmModule;
  #wasmClient = null;
  // Cached views for ring buffer access
  #atomicView;
  #dataView;
  #uint8View;
  #controlIndices;
  // Workers
  #oscInWorker;
  #oscOutLogWorker;
  #workerBaseURL;
  // Lazily-created main-thread channel for the transport's own send()
  #mainChannel = null;
  // Callbacks
  #onReplyCallback;
  #onDebugCallback;
  #onErrorCallback;
  #onOscLogCallback;
  // Source ID tracking (0 = main thread, 1+ = workers)
  #nextSourceId = 1;
  // State
  #initialized = false;
  // Metrics (using canonical names matching metrics_offsets.js)
  #oscOutMessagesSent = 0;
  #oscOutMessagesDropped = 0;
  #oscOutBytesSent = 0;
  /**
   * @param {Object} config
   * @param {SharedArrayBuffer} config.sharedBuffer
   * @param {number} config.ringBufferBase
   * @param {Object} config.bufferConstants
   * @param {string} config.workerBaseURL
   * @param {Function} config.getAudioContextTime
   * @param {Function} config.getNTPStartTime
   */
  constructor(config) {
    super({ ...config, mode: "sab" });
    this.#sharedBuffer = config.sharedBuffer;
    this.#ringBufferBase = config.ringBufferBase;
    this.#bufferConstants = config.bufferConstants;
    this.#workerBaseURL = config.workerBaseURL;
    this.#wasmMemory = config.wasmMemory;
    this.#wasmModule = config.wasmModule;
    if (!(this.#sharedBuffer instanceof SharedArrayBuffer)) {
      throw new Error("SABTransport requires a SharedArrayBuffer");
    }
    this.#initializeViews();
  }
  /**
   * Initialize the transport - spawns workers
   */
  async initialize() {
    if (this.#initialized) {
      if (true) console.warn("[SABTransport] Already initialized");
      return;
    }
    this.#wasmClient = await WasmClient.open({
      wasmModule: this.#wasmModule,
      wasmMemory: this.#wasmMemory,
      ringBufferBase: this.#ringBufferBase,
      bufferConstants: this.#bufferConstants,
      label: "SABTransport"
    });
    const [oscInWorker, oscOutLogWorker] = await Promise.all([
      createWorker(this.#workerBaseURL + "osc_in_worker.js", { type: "module" }),
      createWorker(this.#workerBaseURL + "osc_out_log_sab_worker.js", { type: "module" })
    ]);
    this.#oscInWorker = oscInWorker;
    this.#oscOutLogWorker = oscOutLogWorker;
    this.#setupWorkerHandlers();
    await Promise.all([
      this.#initWorker(this.#oscInWorker, "OSC IN"),
      this.#initWorker(this.#oscOutLogWorker, "OSC OUT LOG")
    ]);
    this.#oscInWorker.postMessage({ type: "start" });
    this.#oscOutLogWorker.postMessage({ type: "start" });
    this.#initialized = true;
  }
  /**
   * Send an OSC message by framing it onto the IN ring (via an internal
   * main-thread channel). The audio thread classifies + schedules.
   */
  send(message) {
    if (!this.#initialized || this._disposed) {
      return false;
    }
    if (!this.#mainChannel) this.#mainChannel = this.createOscChannel({ sourceId: 0 });
    const ok = this.#mainChannel.send(message);
    if (ok) {
      this.#oscOutMessagesSent++;
      this.#oscOutBytesSent += message.length;
    }
    return ok;
  }
  /**
   * Create an OscChannel for direct worker-to-worklet communication
   *
   * Returns an OscChannel backed by the SharedArrayBuffer that can be
   * transferred to a Web Worker, allowing that worker to send OSC messages
   * directly to the AudioWorklet's ring buffer.
   *
   * Usage:
   *   const channel = transport.createOscChannel();
   *   myWorker.postMessage({ channel: channel.transferable }, channel.transferList);
   *
   * In worker:
   *   const channel = OscChannel.fromTransferable(event.data.channel);
   *   channel.send(oscBytes);
   *
   * @param {Object} [options]
   * @param {number} [options.sourceId] - Override sourceId (default: auto-assign)
   * @returns {OscChannel}
   */
  createOscChannel(options = {}) {
    if (!this.#initialized) {
      throw new Error("Transport not initialized");
    }
    const sourceId = options.sourceId ?? this.#nextSourceId++;
    return OscChannel.createSAB({
      sharedBuffer: this.#sharedBuffer,
      ringBufferBase: this.#ringBufferBase,
      bufferConstants: this.#bufferConstants,
      controlIndices: this.#controlIndices,
      wasmClient: this.#wasmClient,
      wasmMemory: this.#wasmMemory,
      wasmModule: this.#wasmModule,
      sourceId
    });
  }
  onReply(callback) {
    this.#onReplyCallback = callback;
  }
  onDebug(callback) {
    this.#onDebugCallback = callback;
  }
  onError(callback) {
    this.#onErrorCallback = callback;
  }
  onOscLog(callback) {
    this.#onOscLogCallback = callback;
  }
  /**
   * Handle OSC log entries from worklet
   * In SAB mode, Clockwork forwards these from the worklet port
   * @param {Array} entries - Array of {sourceId, oscData, timestamp}
   */
  handleOscLog(entries) {
    if (this.#onOscLogCallback) {
      this.#onOscLogCallback(entries);
    }
  }
  getMetrics() {
    return {
      oscOutMessagesSent: this.#oscOutMessagesSent,
      oscOutMessagesDropped: this.#oscOutMessagesDropped,
      oscOutBytesSent: this.#oscOutBytesSent
    };
  }
  get ready() {
    return this.#initialized && !this._disposed;
  }
  dispose() {
    if (this._disposed) return;
    if (this.#oscInWorker) {
      this.#oscInWorker.postMessage({ type: "stop" });
      this.#oscInWorker.terminate();
      this.#oscInWorker = null;
    }
    if (this.#oscOutLogWorker) {
      this.#oscOutLogWorker.postMessage({ type: "stop" });
      this.#oscOutLogWorker.terminate();
      this.#oscOutLogWorker = null;
    }
    this.#initialized = false;
    super.dispose();
  }
  // =========================================================================
  // Private Methods
  // =========================================================================
  #initializeViews() {
    this.#atomicView = new Int32Array(this.#sharedBuffer);
    this.#dataView = new DataView(this.#sharedBuffer);
    this.#uint8View = new Uint8Array(this.#sharedBuffer);
    this.#controlIndices = calculateInControlIndices(
      this.#ringBufferBase,
      this.#bufferConstants.CONTROL_START
    );
  }
  #initWorker(worker, name, extraConfig = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${name} worker initialization timeout`));
      }, 5e3);
      const handler = (event) => {
        if (event.data.type === "initialized") {
          clearTimeout(timeout);
          worker.removeEventListener("message", handler);
          resolve();
        }
      };
      worker.addEventListener("message", handler);
      worker.postMessage({
        type: "init",
        sharedBuffer: this.#sharedBuffer,
        ringBufferBase: this.#ringBufferBase,
        bufferConstants: this.#bufferConstants,
        // Both are structured-cloneable, so a worker gets the engine's
        // own memory and the module already compiled for it.
        wasmMemory: this.#wasmMemory,
        wasmModule: this.#wasmModule,
        ...extraConfig
      });
    });
  }
  #setupWorkerHandlers() {
    this.#oscInWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "messages") {
        if (this.#onReplyCallback) {
          data.messages.forEach((msg) => {
            if (msg.oscData) {
              this.#onReplyCallback(msg.oscData, msg.sequence, msg.timestamp);
            }
          });
        }
      } else if (data.type === "error") {
        console.error("[SABTransport] OSC IN error:", data.error);
        if (this.#onErrorCallback) {
          this.#onErrorCallback(data.error, "oscIn");
        }
      }
    };
    this.#oscOutLogWorker.onmessage = (event) => {
      const data = event.data;
      if (data.type === "oscLog" && this.#onOscLogCallback) {
        this.#onOscLogCallback(data.entries);
      } else if (data.type === "error") {
        console.error("[SABTransport] OSC OUT LOG error:", data.error);
        if (this.#onErrorCallback) {
          this.#onErrorCallback(data.error, "oscOutLog");
        }
      }
    };
  }
};

// clockwork/js/lib/osc_classifier.js
var NTP_EPOCH_OFFSET = 2208988800;
function readTimetag(oscData) {
  if (oscData.length < 16) return null;
  const view = new DataView(oscData.buffer, oscData.byteOffset, oscData.byteLength);
  return {
    ntpSeconds: view.getUint32(8, false),
    ntpFraction: view.getUint32(12, false)
  };
}
function getCurrentNTPFromPerformance() {
  return (performance.timeOrigin + performance.now()) / 1e3 + NTP_EPOCH_OFFSET;
}

// clockwork/js/lib/transport/postmessage_transport.js
var PostMessageTransport = class extends Transport {
  #workletPort;
  #workerBaseURL;
  // Callbacks
  #onReplyCallback;
  #onDebugCallback;
  #onErrorCallback;
  #onOscLogCallback;
  // Source ID tracking (0 = main thread, 1+ = workers)
  #nextSourceId = 1;
  // Lazily-created main-thread channel for the transport's own send()
  #mainChannel = null;
  // State
  #initialized = false;
  #snapshotIntervalMs;
  #bufferConstants = null;
  // Metrics (using canonical names matching metrics_offsets.js)
  #oscOutMessagesSent = 0;
  #oscInMessagesDropped = 0;
  #oscOutBytesSent = 0;
  #oscInMessagesReceived = 0;
  #oscInBytesReceived = 0;
  #lastSequenceReceived = -1;
  #debugMessagesReceived = 0;
  #debugBytesReceived = 0;
  // Timing functions
  #getAudioContextTime;
  #getNTPStartTime;
  /**
   * @param {Object} config
   * @param {string} config.workerBaseURL - Base URL for worker scripts
   * @param {Function} config.getAudioContextTime - Returns AudioContext.currentTime
   * @param {Function} config.getNTPStartTime - Returns NTP start time
   * @param {number} [config.snapshotIntervalMs] - Interval for metrics/tree snapshots
   */
  constructor(config) {
    super({ ...config, mode: "postMessage" });
    this.#workerBaseURL = config.workerBaseURL;
    this.#snapshotIntervalMs = config.snapshotIntervalMs;
    this.#getAudioContextTime = config.getAudioContextTime;
    this.#getNTPStartTime = config.getNTPStartTime;
  }
  /**
   * Initialize the transport
   * @param {MessagePort} workletPort - Port connected to the audio worklet
   */
  async initialize(workletPort) {
    if (this.#initialized) {
      if (true) console.warn("[PostMessageTransport] Already initialized");
      return;
    }
    if (!workletPort) {
      throw new Error("PostMessageTransport requires workletPort");
    }
    this.#workletPort = workletPort;
    this.#workletPort.onmessage = (event) => {
      this.#handleWorkletMessage(event.data);
    };
    this.#workletPort.postMessage({ type: "listening" });
    this.#initialized = true;
  }
  /**
   * Set buffer constants
   * Called by Clockwork after receiving bufferConstants from worklet
   * @param {Object} bufferConstants
   */
  setBufferConstants(bufferConstants) {
    this.#bufferConstants = bufferConstants;
  }
  /**
   * Send an OSC message by postMessaging it to the worklet (via an internal
   * main-thread channel). The audio thread classifies + schedules.
   */
  send(message) {
    if (!this.#initialized || this._disposed) {
      return false;
    }
    if (!this.#mainChannel) this.#mainChannel = this.createOscChannel({ sourceId: 0 });
    const ok = this.#mainChannel.send(message);
    if (ok) {
      this.#oscOutMessagesSent++;
      this.#oscOutBytesSent += message.length;
    }
    return ok;
  }
  /**
   * Create an OscChannel for direct worker-to-worklet communication
   *
   * Returns an OscChannel that can be transferred to a Web Worker,
   * allowing that worker to send OSC messages directly to the AudioWorklet
   * without going through the main thread.
   *
   * Usage:
   *   const channel = transport.createOscChannel();
   *   myWorker.postMessage({ channel: channel.transferable }, channel.transferList);
   *
   * In worker:
   *   const channel = OscChannel.fromTransferable(event.data.channel);
   *   channel.send(oscBytes);
   *
   * @param {Object} [options]
   * @param {number} [options.sourceId] - Override sourceId (default: auto-assign)
   * @returns {OscChannel}
   */
  createOscChannel(options = {}) {
    if (!this.#initialized) {
      throw new Error("Transport not initialized");
    }
    const sourceId = options.sourceId ?? this.#nextSourceId++;
    const directChannel = new MessageChannel();
    this.#workletPort.postMessage(
      { type: "addOscPort", sourceId },
      [directChannel.port1]
    );
    return OscChannel.createPostMessage({
      port: directChannel.port2,
      sourceId,
      nodeIdSource: this._config.nodeIdSource
    });
  }
  onReply(callback) {
    this.#onReplyCallback = callback;
  }
  onDebug(callback) {
    this.#onDebugCallback = callback;
  }
  onError(callback) {
    this.#onErrorCallback = callback;
  }
  onOscLog(callback) {
    this.#onOscLogCallback = callback;
  }
  /**
   * Handle raw debug bytes from worklet (postMessage mode)
   * Decodes UTF-8 text and forwards to callback
   * Supports packed buffer format: { messages: [...], count: N, buffer: ArrayBuffer }
   * @param {Object} data - Debug message batch
   */
  handleDebugRaw(data) {
    if (data.messages && data.count > 0 && data.buffer) {
      const textDecoder2 = new TextDecoder("utf-8");
      const debugBuffer = new Uint8Array(data.buffer);
      for (let i = 0; i < data.count; i++) {
        const entry = data.messages[i];
        try {
          const bytes = debugBuffer.subarray(entry.offset, entry.offset + entry.length);
          let text = textDecoder2.decode(bytes);
          if (text.endsWith("\n")) {
            text = text.slice(0, -1);
          }
          this.#debugMessagesReceived++;
          this.#debugBytesReceived += entry.length;
          if (this.#onDebugCallback) {
            this.#onDebugCallback({
              text,
              timestamp: performance.now(),
              sequence: entry.sequence
            });
          }
        } catch (err) {
          console.error("[PostMessageTransport] Failed to decode debug message:", err);
        }
      }
    }
  }
  getMetrics() {
    return {
      oscInMessagesReceived: this.#oscInMessagesReceived,
      oscInBytesReceived: this.#oscInBytesReceived,
      oscInMessagesDropped: this.#oscInMessagesDropped,
      debugMessagesReceived: this.#debugMessagesReceived,
      debugBytesReceived: this.#debugBytesReceived
    };
  }
  get ready() {
    return this.#initialized && !this._disposed;
  }
  dispose() {
    if (this._disposed) return;
    this.#workletPort = null;
    this.#initialized = false;
    super.dispose();
  }
  // =========================================================================
  // Private Methods
  // =========================================================================
  #handleWorkletMessage(data) {
    switch (data.type) {
      case "oscReplies":
        if (data.messages && data.count > 0 && data.buffer) {
          const replyBuffer = new Uint8Array(data.buffer);
          for (let i = 0; i < data.count; i++) {
            const entry = data.messages[i];
            const oscData = replyBuffer.subarray(entry.offset, entry.offset + entry.length);
            if (entry.sequence !== void 0 && this.#lastSequenceReceived >= 0) {
              const expectedSeq = this.#lastSequenceReceived + 1 & 4294967295;
              if (entry.sequence !== expectedSeq) {
                const dropped = entry.sequence - expectedSeq + 4294967296 & 4294967295;
                if (dropped < 1e3) {
                  this.#oscInMessagesDropped += dropped;
                }
              }
            }
            if (entry.sequence !== void 0) {
              this.#lastSequenceReceived = entry.sequence;
            }
            this.#oscInMessagesReceived++;
            this.#oscInBytesReceived += entry.length;
            if (this.#onReplyCallback) {
              this.#onReplyCallback(oscData, entry.sequence, getCurrentNTPFromPerformance());
            }
          }
        }
        break;
      case "metrics":
        break;
      case "bufferLoaded":
        break;
      case "debugRawBatch":
        this.handleDebugRaw(data);
        break;
      case "oscLog":
        if (true) {
          console.log("[PostMessageTransport] oscLog received:", {
            hasCallback: !!this.#onOscLogCallback,
            count: data.count,
            hasBuffer: !!data.buffer,
            hasEntries: !!data.entries,
            entriesLength: data.entries?.length
          });
        }
        if (this.#onOscLogCallback) {
          if (data.count > 0 && data.buffer && data.entries) {
            const logBuffer = new Uint8Array(data.buffer);
            const entries = [];
            for (let i = 0; i < data.count; i++) {
              const entry = data.entries[i];
              const oscData = logBuffer.subarray(entry.offset, entry.offset + entry.length);
              entries.push({
                oscData,
                sourceId: entry.sourceId,
                sequence: entry.sequence,
                timestamp: getCurrentNTPFromPerformance(),
                truncated: entry.length < entry.originalLength,
                originalLength: entry.originalLength
              });
            }
            this.#onOscLogCallback(entries);
          }
        }
        break;
      case "error":
        console.error("[PostMessageTransport] Worklet error:", data.error);
        this.#oscInMessagesDropped++;
        if (this.#onErrorCallback) {
          this.#onErrorCallback(data.error, "worklet");
        }
        break;
      case "debug":
        if (true) console.log("[PostMessageTransport] Worklet debug:", data.message);
        break;
    }
  }
};

// clockwork/js/lib/transport/index.js
function createTransport(mode, config) {
  if (mode === "sab") {
    return new SABTransport(config);
  } else if (mode === "postMessage") {
    return new PostMessageTransport(config);
  } else {
    throw new Error(`Unknown transport mode: ${mode}. Use 'sab' or 'postMessage'`);
  }
}

// clockwork/js/lib/clockwork_sys.js
var CLOCKWORK_SYS_PREFIX = "/clockwork/";
function clockworkSys(suffix) {
  return CLOCKWORK_SYS_PREFIX + suffix;
}
function isClockworkSys(address) {
  return typeof address === "string" && address.startsWith(CLOCKWORK_SYS_PREFIX);
}

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
var NTP_EPOCH_OFFSET2 = 2208988800;
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
  if (time > 1 && time < NTP_EPOCH_OFFSET2) {
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

// clockwork/js/lib/timetag.js
var NTP_EPOCH_OFFSET3 = 2208988800;
function timetagToPerfMs(when, timeOrigin = performance.timeOrigin) {
  if (when <= 1n) return void 0;
  const secs = Number(when >> 32n) - NTP_EPOCH_OFFSET3;
  const frac = Number(when & 0xFFFFFFFFn) / 4294967296;
  return (secs + frac) * 1e3 - timeOrigin;
}
function perfMsToTimetag(perfMs, timeOrigin = performance.timeOrigin) {
  return unixMsToTimetag(perfMs + timeOrigin);
}
function unixMsToTimetag(ms) {
  const total = ms / 1e3 + NTP_EPOCH_OFFSET3;
  const secs = Math.floor(total);
  const frac = Math.round((total - secs) * 4294967296);
  return BigInt(secs) << 32n | BigInt(frac);
}

// clockwork/dist/midi/clockwork_midi.js
var WasmClockEstimator = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    WasmClockEstimatorFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm.__wbg_wasmclockestimator_free(ptr, 0);
  }
  constructor() {
    const ret = wasm.wasmclockestimator_new();
    this.__wbg_ptr = ret;
    WasmClockEstimatorFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  reset() {
    wasm.wasmclockestimator_reset(this.__wbg_ptr);
  }
  /**
   * Feed a pulse timestamp (µs); returns the BPM estimate once available.
   * @param {number} ts_us
   * @returns {number | undefined}
   */
  update(ts_us) {
    const ret = wasm.wasmclockestimator_update(this.__wbg_ptr, ts_us);
    return ret[0] === 0 ? void 0 : ret[1];
  }
};
if (Symbol.dispose) WasmClockEstimator.prototype[Symbol.dispose] = WasmClockEstimator.prototype.free;
function midi_in_fields(port, bytes) {
  const ptr0 = passStringToWasm0(port, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.midi_in_fields(ptr0, len0, ptr1, len1);
  let v3;
  if (ret[0] !== 0) {
    v3 = getArrayJsValueFromWasm0(ret[0], ret[1]);
    wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
  }
  return v3;
}
function midi_in_osc_at(port, bytes, when) {
  const ptr0 = passStringToWasm0(port, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ret = wasm.midi_in_osc_at(ptr0, len0, ptr1, len1, when);
  let v3;
  if (ret[0] !== 0) {
    v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  }
  return v3;
}
function midi_out_decode(osc3) {
  const ptr0 = passArray8ToWasm0(osc3, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ret = wasm.midi_out_decode(ptr0, len0);
  let v2;
  if (ret[0] !== 0) {
    v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  }
  return v2;
}
function midi_ports_osc(ins, ins_enabled, outs, outs_enabled) {
  const ptr0 = passArrayJsValueToWasm0(ins, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(ins_enabled, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArrayJsValueToWasm0(outs, wasm.__wbindgen_malloc);
  const len2 = WASM_VECTOR_LEN;
  const ptr3 = passArray8ToWasm0(outs_enabled, wasm.__wbindgen_malloc);
  const len3 = WASM_VECTOR_LEN;
  const ret = wasm.midi_ports_osc(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
  var v5 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v5;
}
function midi_ports_reply_osc(ins, ins_enabled, outs, outs_enabled) {
  const ptr0 = passArrayJsValueToWasm0(ins, wasm.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN;
  const ptr1 = passArray8ToWasm0(ins_enabled, wasm.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN;
  const ptr2 = passArrayJsValueToWasm0(outs, wasm.__wbindgen_malloc);
  const len2 = WASM_VECTOR_LEN;
  const ptr3 = passArray8ToWasm0(outs_enabled, wasm.__wbindgen_malloc);
  const len3 = WASM_VECTOR_LEN;
  const ret = wasm.midi_ports_reply_osc(ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
  var v5 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
  wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v5;
}
function normalize_name(raw) {
  let deferred2_0;
  let deferred2_1;
  try {
    const ptr0 = passStringToWasm0(raw, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.normalize_name(ptr0, len0);
    deferred2_0 = ret[0];
    deferred2_1 = ret[1];
    return getStringFromWasm0(ret[0], ret[1]);
  } finally {
    wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
  }
}
function __wbg_get_imports() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_string_get_d154f1e671052120: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "string" ? obj : void 0;
      var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
      var len1 = WASM_VECTOR_LEN;
      getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
      throw new Error(getStringFromWasm0(arg0, arg1));
    },
    __wbindgen_cast_0000000000000001: function(arg0) {
      const ret = arg0;
      return ret;
    },
    __wbindgen_cast_0000000000000002: function(arg0, arg1) {
      const ret = getStringFromWasm0(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, void 0);
      table.set(offset + 0, void 0);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    }
  };
  return {
    __proto__: null,
    "./clockwork_midi_bg.js": import0
  };
}
var WasmClockEstimatorFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm.__wbg_wasmclockestimator_free(ptr, 1));
function addToExternrefTable0(obj) {
  const idx = wasm.__externref_table_alloc();
  wasm.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
function getArrayJsValueFromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  const mem = getDataViewMemory0();
  const result = [];
  for (let i = ptr; i < ptr + 4 * len; i += 4) {
    result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
  }
  wasm.__externref_drop_slice(ptr, len);
  return result;
}
function getArrayU8FromWasm0(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}
var cachedDataViewMemory0 = null;
function getDataViewMemory0() {
  if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || cachedDataViewMemory0.buffer.detached === void 0 && cachedDataViewMemory0.buffer !== wasm.memory.buffer) {
    cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
  }
  return cachedDataViewMemory0;
}
function getStringFromWasm0(ptr, len) {
  return decodeText(ptr >>> 0, len);
}
var cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
  if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
    cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
  }
  return cachedUint8ArrayMemory0;
}
function isLikeNone(x) {
  return x === void 0 || x === null;
}
function passArray8ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory0().set(arg, ptr / 1);
  WASM_VECTOR_LEN = arg.length;
  return ptr;
}
function passArrayJsValueToWasm0(array, malloc) {
  const ptr = malloc(array.length * 4, 4) >>> 0;
  for (let i = 0; i < array.length; i++) {
    const add = addToExternrefTable0(array[i]);
    getDataViewMemory0().setUint32(ptr + 4 * i, add, true);
  }
  WASM_VECTOR_LEN = array.length;
  return ptr;
}
function passStringToWasm0(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory0().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory0();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN = offset;
  return ptr;
}
var cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
var MAX_SAFARI_DECODE_BYTES = 2146435072;
var numBytesDecoded = 0;
function decodeText(ptr, len) {
  numBytesDecoded += len;
  if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
    cachedTextDecoder = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder.decode();
    numBytesDecoded = len;
  }
  return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}
var cachedTextEncoder = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder)) {
  cachedTextEncoder.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN = 0;
var wasmModule;
var wasmInstance;
var wasm;
function __wbg_finalize_init(instance, module) {
  wasmInstance = instance;
  wasm = instance.exports;
  wasmModule = module;
  cachedDataViewMemory0 = null;
  cachedUint8ArrayMemory0 = null;
  wasm.__wbindgen_start();
  return wasm;
}
async function __wbg_load(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (!module.ok) {
      throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
    }
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function __wbg_init(module_or_path) {
  if (wasm !== void 0) return wasm;
  if (module_or_path !== void 0) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === void 0) {
    module_or_path = new URL("clockwork_midi_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load(await module_or_path, imports);
  return __wbg_finalize_init(instance, module);
}

// clockwork/js/lib/midi_manager.js
var MidiManager = class {
  /**
   * @param {object} [options]
   * @param {() => Promise<MIDIAccess>} [options.requestAccess] how to get Web
   *   MIDI access; defaults to navigator.requestMIDIAccess({ sysex: true }).
   * @param {string|URL|Uint8Array} [options.wasm] where the core's wasm is,
   *   or its bytes; defaults to beside the glue module.
   * @param {(perfMs: number) => number} [options.now] performance.now, injectable.
   */
  constructor(options = {}) {
    this._requestAccess = options.requestAccess ?? (() => {
      if (typeof navigator === "undefined" || !navigator.requestMIDIAccess)
        throw new Error("Web MIDI API unavailable");
      return navigator.requestMIDIAccess({ sysex: true });
    });
    this._wasm = options.wasm;
    this._now = options.now ?? (() => performance.now());
    this._access = null;
    this._inputs = /* @__PURE__ */ new Map();
    this._outputs = /* @__PURE__ */ new Map();
    this._inEnabled = /* @__PURE__ */ new Set();
    this._outEnabled = /* @__PURE__ */ new Set();
    this._clockMuted = /* @__PURE__ */ new Set();
    this._estimators = /* @__PURE__ */ new Map();
    this._onEvent = null;
    this._onMessage = null;
    this._onPorts = null;
    this._onTempo = null;
    this._lastPortsKey = null;
    this._onStateChange = () => this._refresh(true);
  }
  // Load the wasm core and acquire Web MIDI. Resolves once ports are enumerated.
  async init() {
    await __wbg_init(this._wasm !== void 0 ? { module_or_path: this._wasm } : void 0);
    this._access = await this._requestAccess();
    this._access.onstatechange = this._onStateChange;
    this._refresh(false);
    return this;
  }
  dispose() {
    if (this._access) this._access.onstatechange = null;
    for (const input of this._inputs.values()) input.onmidimessage = null;
    this._inputs.clear();
    this._outputs.clear();
    this._inEnabled.clear();
    this._outEnabled.clear();
    this._estimators.clear();
    this._access = null;
  }
  onEvent(cb) {
    this._onEvent = cb;
  }
  // Structured inbound events: cb receives a flat [kind, port, ...ints] array
  // (e.g. ["note_on", "kbd", 1, 60, 100]) with no OSC encode/decode round-trip.
  // Takes precedence over onEvent when both are set.
  onMessage(cb) {
    this._onMessage = cb;
  }
  // A /clockwork/midi/ports push, as bytes: on a hotplug or an enable change.
  onPorts(cb) {
    this._onPorts = cb;
  }
  onTempo(cb) {
    this._onTempo = cb;
  }
  // ── Ports ────────────────────────────────────────────────────────────────
  // [[name, enabled], ...] for inputs and outputs, in enumeration order.
  portLists() {
    const ins = [...this._inputs.keys()].map((n) => [n, this._inEnabled.has(n)]);
    const outs = [...this._outputs.keys()].map((n) => [n, this._outEnabled.has(n)]);
    return { ins, outs };
  }
  // The /clockwork/midi/ports.reply packet for the current state.
  portsReply() {
    const { ins, outs } = this.portLists();
    return midi_ports_reply_osc(
      ins.map((r) => r[0]),
      Uint8Array.from(ins, (r) => r[1] ? 1 : 0),
      outs.map((r) => r[0]),
      Uint8Array.from(outs, (r) => r[1] ? 1 : 0)
    );
  }
  _portsPush() {
    const { ins, outs } = this.portLists();
    return midi_ports_osc(
      ins.map((r) => r[0]),
      Uint8Array.from(ins, (r) => r[1] ? 1 : 0),
      outs.map((r) => r[0]),
      Uint8Array.from(outs, (r) => r[1] ? 1 : 0)
    );
  }
  // Open (or close) a port for input or output — "*" for every port. A name
  // nobody has is remembered: enabling a port before it is plugged in is a
  // normal thing to do, and it opens when it appears. Pushes /clockwork/midi/ports.
  enable(port, input, enabled) {
    const set = input ? this._inEnabled : this._outEnabled;
    const known = input ? this._inputs : this._outputs;
    const names = port === "*" ? [...known.keys()] : [normalize_name(port)];
    for (const name of names) {
      if (enabled) set.add(name);
      else set.delete(name);
    }
    this._push(true);
  }
  // Re-enumerate and push /clockwork/midi/ports whether or not anything changed —
  // a refresh is a request for the list.
  refresh() {
    this._refresh(false);
    this._push(true);
  }
  // Ignore (or heed) the MIDI clock arriving on an input: /clockwork/midi/clock/sync.
  clockSync(port, enabled) {
    const names = port === "*" ? [...this._inputs.keys()] : [normalize_name(port)];
    for (const name of names) {
      if (enabled) this._clockMuted.delete(name);
      else this._clockMuted.add(name);
      this._estimators.get(name)?.reset();
    }
  }
  // One immediate 0xF8 on a port ("*" = every enabled output): /clockwork/midi/clock/tick.
  tick(port) {
    this._sendRaw(port, new Uint8Array([248]), void 0);
  }
  _refresh(fromStateChange) {
    for (const input of this._inputs.values()) input.onmidimessage = null;
    this._inputs.clear();
    this._outputs.clear();
    for (const input of this._access.inputs.values()) {
      const name = normalize_name(input.name || input.id);
      this._inputs.set(name, input);
      input.onmidimessage = (e) => this._onInput(name, e);
    }
    for (const output of this._access.outputs.values()) {
      const name = normalize_name(output.name || output.id);
      this._outputs.set(name, output);
    }
    if (fromStateChange) this._push(false);
  }
  _push(force) {
    const key = JSON.stringify(this.portLists());
    if (!force && key === this._lastPortsKey) return;
    this._lastPortsKey = key;
    if (this._onPorts) this._onPorts(this._portsPush());
  }
  _onInput(port, event) {
    if (!this._inEnabled.has(port)) return;
    const bytes = event.data;
    if (bytes.length === 1 && bytes[0] === 248) {
      if (this._clockMuted.has(port)) return;
      let est = this._estimators.get(port);
      if (!est) {
        est = new WasmClockEstimator();
        this._estimators.set(port, est);
      }
      const bpm = est.update(event.timeStamp * 1e3);
      if (bpm != null && this._onTempo) this._onTempo(port, bpm);
      return;
    }
    if (this._onMessage) {
      const fields = midi_in_fields(port, bytes);
      if (fields) this._onMessage(fields);
      return;
    }
    const when = perfMsToTimetag(event.timeStamp ?? this._now());
    const osc3 = midi_in_osc_at(port, bytes, when);
    if (osc3 && this._onEvent) this._onEvent(osc3);
  }
  // ── Sends ────────────────────────────────────────────────────────────────
  // Send a /clockwork/midi/out/* OSC packet to hardware.
  //
  // The time comes from the verb itself — the packed form is
  // [when: 8 LE][portLen][port][bytes] — and is converted here from an OSC
  // timetag to the DOMHighResTimeStamp the Web MIDI API wants. `timestampMs`
  // remains an explicit override for a caller that has already decided —
  // the host front, which carries the time of a verb the scheduler fired.
  //
  // This is where a timestamp is worth the most: the browser schedules the
  // send itself, so handing it a future time is tighter than racing to deliver
  // on time across the worklet/main boundary.
  //
  // Returns false for a packet that is not a send verb.
  sendOut(oscBytes, timestampMs) {
    const packed = midi_out_decode(oscBytes);
    if (!packed) return false;
    const when = new DataView(packed.buffer, packed.byteOffset, 8).getBigUint64(0, true);
    const at = timestampMs !== void 0 ? timestampMs : timetagToPerfMs(when);
    const portLen = packed[8];
    const port = new TextDecoder().decode(packed.subarray(9, 9 + portLen));
    const raw = packed.subarray(9 + portLen);
    this._sendRaw(port, raw, at);
    return true;
  }
  // A guest's send, from a sink the engine opened onto `port` (the host is
  // the sink's endpoint on the web: clockwork_event_sink.h). Opening a sink
  // onto a port opens the port, as it does natively, so an output the client
  // never enabled is enabled here on first use — and the ports push says so.
  // `timestampMs` is the send's time as the front converted it; undefined is
  // now. "*" is every output.
  sendFromSink(port, raw, timestampMs) {
    const names = port === "*" ? [...this._outputs.keys()] : [normalize_name(port)];
    let opened = false;
    for (const name of names) {
      if (!this._outEnabled.has(name) && (port === "*" || this._outputs.has(name))) {
        this._outEnabled.add(name);
        opened = true;
      }
    }
    if (opened) this._push(true);
    this._sendRaw(port, raw, timestampMs);
  }
  // Bytes to one enabled output, or every enabled output for "*". A port that
  // is not open is not sent to, as natively.
  _sendRaw(port, raw, at) {
    if (port === "*") {
      for (const [name2, out2] of this._outputs) {
        if (this._outEnabled.has(name2)) out2.send(raw, at);
      }
      return;
    }
    const name = normalize_name(port);
    if (!this._outEnabled.has(name)) return;
    const out = this._outputs.get(name);
    if (out) out.send(raw, at);
  }
};

// clockwork/dist/gamepad/clockwork_gamepad.js
var WasmPadState = class {
  __destroy_into_raw() {
    const ptr = this.__wbg_ptr;
    this.__wbg_ptr = 0;
    WasmPadStateFinalization.unregister(this);
    return ptr;
  }
  free() {
    const ptr = this.__destroy_into_raw();
    wasm2.__wbg_wasmpadstate_free(ptr, 0);
  }
  /**
   * `standard` is `Gamepad.mapping === "standard"`: canonical W3C-indexed
   * names with the browser's down-positive stick Y flipped to the shared
   * up-positive convention. Non-standard pads pass through raw with
   * generic `button_<i>` / `axis_<i>` names.
   * @param {boolean} standard
   */
  constructor(standard) {
    const ret = wasm2.wasmpadstate_new(standard);
    this.__wbg_ptr = ret;
    WasmPadStateFinalization.register(this, this.__wbg_ptr, this);
    return this;
  }
  /**
   * One poll snapshot: `pressed`/`values` per button index (from
   * `Gamepad.buttons[i].pressed/.value`), `axes` from `Gamepad.axes`.
   * Returns the changes as a flat array, four slots per event:
   * `["button", name, pressed01, value]` / `["axis", name, value, 0]` —
   * or `None` (no JS array materialised) on the common no-change tick.
   * @param {Uint8Array} pressed
   * @param {Float64Array} values
   * @param {Float64Array} axes
   * @returns {any[] | undefined}
   */
  update(pressed, values, axes) {
    const ptr0 = passArray8ToWasm02(pressed, wasm2.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayF64ToWasm0(values, wasm2.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN2;
    const ptr2 = passArrayF64ToWasm0(axes, wasm2.__wbindgen_malloc);
    const len2 = WASM_VECTOR_LEN2;
    const ret = wasm2.wasmpadstate_update(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
    let v4;
    if (ret[0] !== 0) {
      v4 = getArrayJsValueFromWasm02(ret[0], ret[1]);
      wasm2.__wbindgen_free(ret[0], ret[1] * 4, 4);
    }
    return v4;
  }
};
if (Symbol.dispose) WasmPadState.prototype[Symbol.dispose] = WasmPadState.prototype.free;
function assign_handle(raw, taken) {
  let deferred3_0;
  let deferred3_1;
  try {
    const ptr0 = passStringToWasm02(raw, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN2;
    const ptr1 = passArrayJsValueToWasm02(taken, wasm2.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN2;
    const ret = wasm2.assign_handle(ptr0, len0, ptr1, len1);
    deferred3_0 = ret[0];
    deferred3_1 = ret[1];
    return getStringFromWasm02(ret[0], ret[1]);
  } finally {
    wasm2.__wbindgen_free(deferred3_0, deferred3_1, 1);
  }
}
function gamepad_axis_osc_at(pad, name, value, when) {
  const ptr0 = passStringToWasm02(pad, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN2;
  const ptr1 = passStringToWasm02(name, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  const ret = wasm2.gamepad_axis_osc_at(ptr0, len0, ptr1, len1, value, when);
  var v3 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
  wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function gamepad_button_osc_at(pad, name, pressed, value, when) {
  const ptr0 = passStringToWasm02(pad, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len0 = WASM_VECTOR_LEN2;
  const ptr1 = passStringToWasm02(name, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
  const len1 = WASM_VECTOR_LEN2;
  const ret = wasm2.gamepad_button_osc_at(ptr0, len0, ptr1, len1, pressed, value, when);
  var v3 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
  wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function gamepad_devices_osc(names, enabled) {
  const ptr0 = passArrayJsValueToWasm02(names, wasm2.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN2;
  const ptr1 = passArray8ToWasm02(enabled, wasm2.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN2;
  const ret = wasm2.gamepad_devices_osc(ptr0, len0, ptr1, len1);
  var v3 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
  wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function gamepad_devices_reply_osc(names, enabled) {
  const ptr0 = passArrayJsValueToWasm02(names, wasm2.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN2;
  const ptr1 = passArray8ToWasm02(enabled, wasm2.__wbindgen_malloc);
  const len1 = WASM_VECTOR_LEN2;
  const ret = wasm2.gamepad_devices_reply_osc(ptr0, len0, ptr1, len1);
  var v3 = getArrayU8FromWasm02(ret[0], ret[1]).slice();
  wasm2.__wbindgen_free(ret[0], ret[1] * 1, 1);
  return v3;
}
function gamepad_out_decode(osc3) {
  const ptr0 = passArray8ToWasm02(osc3, wasm2.__wbindgen_malloc);
  const len0 = WASM_VECTOR_LEN2;
  const ret = wasm2.gamepad_out_decode(ptr0, len0);
  let v2;
  if (ret[0] !== 0) {
    v2 = getArrayJsValueFromWasm02(ret[0], ret[1]);
    wasm2.__wbindgen_free(ret[0], ret[1] * 4, 4);
  }
  return v2;
}
function __wbg_get_imports2() {
  const import0 = {
    __proto__: null,
    __wbg___wbindgen_string_get_d154f1e671052120: function(arg0, arg1) {
      const obj = arg1;
      const ret = typeof obj === "string" ? obj : void 0;
      var ptr1 = isLikeNone2(ret) ? 0 : passStringToWasm02(ret, wasm2.__wbindgen_malloc, wasm2.__wbindgen_realloc);
      var len1 = WASM_VECTOR_LEN2;
      getDataViewMemory02().setInt32(arg0 + 4 * 1, len1, true);
      getDataViewMemory02().setInt32(arg0 + 4 * 0, ptr1, true);
    },
    __wbg___wbindgen_throw_bb96b2010945f0bc: function(arg0, arg1) {
      throw new Error(getStringFromWasm02(arg0, arg1));
    },
    __wbindgen_cast_0000000000000001: function(arg0) {
      const ret = arg0;
      return ret;
    },
    __wbindgen_cast_0000000000000002: function(arg0, arg1) {
      const ret = getStringFromWasm02(arg0, arg1);
      return ret;
    },
    __wbindgen_init_externref_table: function() {
      const table = wasm2.__wbindgen_externrefs;
      const offset = table.grow(4);
      table.set(0, void 0);
      table.set(offset + 0, void 0);
      table.set(offset + 1, null);
      table.set(offset + 2, true);
      table.set(offset + 3, false);
    }
  };
  return {
    __proto__: null,
    "./clockwork_gamepad_bg.js": import0
  };
}
var WasmPadStateFinalization = typeof FinalizationRegistry === "undefined" ? { register: () => {
}, unregister: () => {
} } : new FinalizationRegistry((ptr) => wasm2.__wbg_wasmpadstate_free(ptr, 1));
function addToExternrefTable02(obj) {
  const idx = wasm2.__externref_table_alloc();
  wasm2.__wbindgen_externrefs.set(idx, obj);
  return idx;
}
function getArrayJsValueFromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  const mem = getDataViewMemory02();
  const result = [];
  for (let i = ptr; i < ptr + 4 * len; i += 4) {
    result.push(wasm2.__wbindgen_externrefs.get(mem.getUint32(i, true)));
  }
  wasm2.__externref_drop_slice(ptr, len);
  return result;
}
function getArrayU8FromWasm02(ptr, len) {
  ptr = ptr >>> 0;
  return getUint8ArrayMemory02().subarray(ptr / 1, ptr / 1 + len);
}
var cachedDataViewMemory02 = null;
function getDataViewMemory02() {
  if (cachedDataViewMemory02 === null || cachedDataViewMemory02.buffer.detached === true || cachedDataViewMemory02.buffer.detached === void 0 && cachedDataViewMemory02.buffer !== wasm2.memory.buffer) {
    cachedDataViewMemory02 = new DataView(wasm2.memory.buffer);
  }
  return cachedDataViewMemory02;
}
var cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
  if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
    cachedFloat64ArrayMemory0 = new Float64Array(wasm2.memory.buffer);
  }
  return cachedFloat64ArrayMemory0;
}
function getStringFromWasm02(ptr, len) {
  return decodeText2(ptr >>> 0, len);
}
var cachedUint8ArrayMemory02 = null;
function getUint8ArrayMemory02() {
  if (cachedUint8ArrayMemory02 === null || cachedUint8ArrayMemory02.byteLength === 0) {
    cachedUint8ArrayMemory02 = new Uint8Array(wasm2.memory.buffer);
  }
  return cachedUint8ArrayMemory02;
}
function isLikeNone2(x) {
  return x === void 0 || x === null;
}
function passArray8ToWasm02(arg, malloc) {
  const ptr = malloc(arg.length * 1, 1) >>> 0;
  getUint8ArrayMemory02().set(arg, ptr / 1);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passArrayF64ToWasm0(arg, malloc) {
  const ptr = malloc(arg.length * 8, 8) >>> 0;
  getFloat64ArrayMemory0().set(arg, ptr / 8);
  WASM_VECTOR_LEN2 = arg.length;
  return ptr;
}
function passArrayJsValueToWasm02(array, malloc) {
  const ptr = malloc(array.length * 4, 4) >>> 0;
  for (let i = 0; i < array.length; i++) {
    const add = addToExternrefTable02(array[i]);
    getDataViewMemory02().setUint32(ptr + 4 * i, add, true);
  }
  WASM_VECTOR_LEN2 = array.length;
  return ptr;
}
function passStringToWasm02(arg, malloc, realloc) {
  if (realloc === void 0) {
    const buf = cachedTextEncoder2.encode(arg);
    const ptr2 = malloc(buf.length, 1) >>> 0;
    getUint8ArrayMemory02().subarray(ptr2, ptr2 + buf.length).set(buf);
    WASM_VECTOR_LEN2 = buf.length;
    return ptr2;
  }
  let len = arg.length;
  let ptr = malloc(len, 1) >>> 0;
  const mem = getUint8ArrayMemory02();
  let offset = 0;
  for (; offset < len; offset++) {
    const code = arg.charCodeAt(offset);
    if (code > 127) break;
    mem[ptr + offset] = code;
  }
  if (offset !== len) {
    if (offset !== 0) {
      arg = arg.slice(offset);
    }
    ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
    const view = getUint8ArrayMemory02().subarray(ptr + offset, ptr + len);
    const ret = cachedTextEncoder2.encodeInto(arg, view);
    offset += ret.written;
    ptr = realloc(ptr, len, offset, 1) >>> 0;
  }
  WASM_VECTOR_LEN2 = offset;
  return ptr;
}
var cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
cachedTextDecoder2.decode();
var MAX_SAFARI_DECODE_BYTES2 = 2146435072;
var numBytesDecoded2 = 0;
function decodeText2(ptr, len) {
  numBytesDecoded2 += len;
  if (numBytesDecoded2 >= MAX_SAFARI_DECODE_BYTES2) {
    cachedTextDecoder2 = new TextDecoder("utf-8", { ignoreBOM: true, fatal: true });
    cachedTextDecoder2.decode();
    numBytesDecoded2 = len;
  }
  return cachedTextDecoder2.decode(getUint8ArrayMemory02().subarray(ptr, ptr + len));
}
var cachedTextEncoder2 = new TextEncoder();
if (!("encodeInto" in cachedTextEncoder2)) {
  cachedTextEncoder2.encodeInto = function(arg, view) {
    const buf = cachedTextEncoder2.encode(arg);
    view.set(buf);
    return {
      read: arg.length,
      written: buf.length
    };
  };
}
var WASM_VECTOR_LEN2 = 0;
var wasmModule2;
var wasmInstance2;
var wasm2;
function __wbg_finalize_init2(instance, module) {
  wasmInstance2 = instance;
  wasm2 = instance.exports;
  wasmModule2 = module;
  cachedDataViewMemory02 = null;
  cachedFloat64ArrayMemory0 = null;
  cachedUint8ArrayMemory02 = null;
  wasm2.__wbindgen_start();
  return wasm2;
}
async function __wbg_load2(module, imports) {
  if (typeof Response === "function" && module instanceof Response) {
    if (!module.ok) {
      throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
    }
    if (typeof WebAssembly.instantiateStreaming === "function") {
      try {
        return await WebAssembly.instantiateStreaming(module, imports);
      } catch (e) {
        const validResponse = expectedResponseType(module.type);
        if (validResponse && module.headers.get("Content-Type") !== "application/wasm") {
          console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);
        } else {
          throw e;
        }
      }
    }
    const bytes = await module.arrayBuffer();
    return await WebAssembly.instantiate(bytes, imports);
  } else {
    const instance = await WebAssembly.instantiate(module, imports);
    if (instance instanceof WebAssembly.Instance) {
      return { instance, module };
    } else {
      return instance;
    }
  }
  function expectedResponseType(type) {
    switch (type) {
      case "basic":
      case "cors":
      case "default":
        return true;
    }
    return false;
  }
}
async function __wbg_init2(module_or_path) {
  if (wasm2 !== void 0) return wasm2;
  if (module_or_path !== void 0) {
    if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
      ({ module_or_path } = module_or_path);
    } else {
      console.warn("using deprecated parameters for the initialization function; pass a single object instead");
    }
  }
  if (module_or_path === void 0) {
    module_or_path = new URL("clockwork_gamepad_bg.wasm", import.meta.url);
  }
  const imports = __wbg_get_imports2();
  if (typeof module_or_path === "string" || typeof Request === "function" && module_or_path instanceof Request || typeof URL === "function" && module_or_path instanceof URL) {
    module_or_path = fetch(module_or_path);
  }
  const { instance, module } = await __wbg_load2(await module_or_path, imports);
  return __wbg_finalize_init2(instance, module);
}

// clockwork/js/lib/gamepad_manager.js
var GamepadManager = class {
  /**
   * @param {object} [options]
   * @param {number} [options.pollIntervalMs=8]
   * @param {number} [options.rumbleRefreshMs=4500] how often an active "until
   *   stopped" (or > 5 s) rumble is re-issued — the Gamepad API caps a single
   *   effect at 5 s, so the poll loop renews it just before expiry to match
   *   the native until-stop semantics.
   * @param {() => (Gamepad|null)[]} [options.getGamepads] defaults to
   *   navigator.getGamepads().
   * @param {EventTarget} [options.events] where gamepadconnected /
   *   gamepaddisconnected fire; defaults to window.
   * @param {string|URL|Uint8Array} [options.wasm] where the core's wasm is,
   *   or its bytes; defaults to beside the glue module.
   * @param {() => number} [options.now] performance.now, injectable.
   */
  constructor(options = {}) {
    this._pollIntervalMs = options.pollIntervalMs ?? 8;
    this._rumbleRefreshMs = options.rumbleRefreshMs ?? 4500;
    this._getGamepads = options.getGamepads ?? (() => {
      if (typeof navigator === "undefined" || !navigator.getGamepads)
        throw new Error("Gamepad API unavailable");
      return navigator.getGamepads();
    });
    this._events = options.events ?? (typeof window !== "undefined" ? window : null);
    this._wasm = options.wasm;
    this._now = options.now ?? (() => performance.now());
    this._timer = null;
    this._pads = /* @__PURE__ */ new Map();
    this._defaultEnabled = true;
    this._onEvent = null;
    this._onMessage = null;
    this._onDevices = null;
    this._lastDevicesKey = null;
    this._onChange = () => this._refresh(false);
  }
  // Load the wasm core and start polling. Browsers only surface a pad after a
  // user gesture (typically the first button press), so an empty initial list
  // is normal; connect/disconnect events + polling pick pads up as they appear.
  async init() {
    await __wbg_init2(this._wasm !== void 0 ? { module_or_path: this._wasm } : void 0);
    this._events?.addEventListener("gamepadconnected", this._onChange);
    this._events?.addEventListener("gamepaddisconnected", this._onChange);
    this._refresh(false);
    this._timer = setInterval(() => this.poll(), this._pollIntervalMs);
    return this;
  }
  dispose() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
    this._events?.removeEventListener("gamepadconnected", this._onChange);
    this._events?.removeEventListener("gamepaddisconnected", this._onChange);
    this._pads.clear();
  }
  onEvent(cb) {
    this._onEvent = cb;
  }
  // Structured inbound events: cb receives ["button", pad, name, pressed01,
  // value] or ["axis", pad, name, value] with no OSC encode/decode round-trip.
  // Takes precedence over onEvent when both are set.
  onMessage(cb) {
    this._onMessage = cb;
  }
  // A /clockwork/gamepad/devices push, as bytes: on a connect, disconnect or
  // enable change.
  onDevices(cb) {
    this._onDevices = cb;
  }
  // ── Devices ──────────────────────────────────────────────────────────────
  // [[handle, enabled], ...] in registry order.
  deviceRows() {
    return [...this._pads.values()].map((e) => [e.handle, e.enabled]);
  }
  // The /clockwork/gamepad/devices.reply packet for the current state.
  devicesReply() {
    const rows = this.deviceRows();
    return gamepad_devices_reply_osc(rows.map((r) => r[0]), Uint8Array.from(rows, (r) => r[1] ? 1 : 0));
  }
  _devicesPush() {
    const rows = this.deviceRows();
    return gamepad_devices_osc(rows.map((r) => r[0]), Uint8Array.from(rows, (r) => r[1] ? 1 : 0));
  }
  // Mute (or unmute) a pad's events — "*" for every pad, and then also the
  // default for pads that connect later. Pushes /clockwork/gamepad/devices.
  enable(pad, enabled) {
    if (pad === "*") {
      this._defaultEnabled = enabled;
      for (const entry of this._pads.values()) entry.enabled = enabled;
    } else {
      for (const entry of this._pads.values()) {
        if (entry.handle === pad) entry.enabled = enabled;
      }
    }
    this._push(true);
  }
  // Re-enumerate and push /clockwork/gamepad/devices whether or not anything
  // changed — a refresh is a request for the list.
  refresh() {
    this._refresh(true);
  }
  _refresh(force) {
    const pads = this._getGamepads();
    for (const [index, entry] of [...this._pads]) {
      const pad = pads[index];
      if (!pad || pad.id !== entry.id) this._pads.delete(index);
    }
    const taken = [...this._pads.values()].map((e) => e.handle);
    for (const pad of pads) {
      if (!pad || this._pads.has(pad.index)) continue;
      const handle = assign_handle(pad.id, taken);
      taken.push(handle);
      this._pads.set(pad.index, {
        id: pad.id,
        handle,
        enabled: this._defaultEnabled,
        state: new WasmPadState(pad.mapping === "standard"),
        // Poll-snapshot buffers, reused every tick (element counts are fixed
        // for the life of a pad) so polling doesn't churn the GC.
        pressed: new Uint8Array(pad.buttons.length),
        values: new Float64Array(pad.buttons.length),
        axes: new Float64Array(pad.axes.length)
      });
    }
    this._push(force);
  }
  // Browsers can fire connect/disconnect for transient transitions; only
  // push when the pad list actually changed, mirroring the native
  // "broadcast only on change" behaviour — unless asked outright.
  _push(force) {
    const key = JSON.stringify(this.deviceRows());
    if (!force && key === this._lastDevicesKey) return;
    this._lastDevicesKey = key;
    if (this._onDevices) this._onDevices(this._devicesPush());
  }
  // One poll: what changed since the last one, as events. Runs on the
  // interval; callable by hand, which is how a test drives it.
  poll() {
    const pads = this._getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      let entry = this._pads.get(pad.index);
      const buttons = pad.buttons;
      const axes = pad.axes;
      if (!entry || entry.id !== pad.id || // Element counts are fixed for a connection, so a mismatch means the
      // entry is stale; re-register rather than silently truncating (which
      // would leave the extra inputs permanently dead).
      buttons.length !== entry.pressed.length || axes.length !== entry.axes.length) {
        this._pads.delete(pad.index);
        this._refresh(false);
        entry = this._pads.get(pad.index);
        if (!entry) continue;
      }
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        entry.pressed[i] = b.pressed ? 1 : 0;
        entry.values[i] = b.value;
      }
      for (let i = 0; i < axes.length; i++) entry.axes[i] = axes[i];
      const events = entry.state.update(entry.pressed, entry.values, entry.axes);
      if (events && entry.enabled) {
        for (let i = 0; i < events.length; i += 4) {
          this._emit(entry.handle, events[i], events[i + 1], events[i + 2], events[i + 3]);
        }
      }
      this._refreshRumble(entry, pad);
    }
    for (const index of this._pads.keys()) {
      if (!pads[index]) {
        this._refresh(false);
        break;
      }
    }
  }
  _emit(pad, kind, name, a, b) {
    if (this._onMessage) {
      this._onMessage(kind === "button" ? [kind, pad, name, a, b] : [kind, pad, name, a]);
      return;
    }
    if (!this._onEvent) return;
    const when = perfMsToTimetag(this._now());
    const osc3 = kind === "button" ? gamepad_button_osc_at(pad, name, a, b, when) : gamepad_axis_osc_at(pad, name, a, when);
    this._onEvent(osc3);
  }
  // Drive rumble from a /clockwork/gamepad/out/* OSC packet (rumble / rumble_stop).
  // Best-effort: pads without a vibrationActuator are skipped. The spec caps a
  // single effect at 5 s, so a rumble outliving the cap (durationMs <= 0 =
  // "until stop", or any longer duration) is renewed from the poll loop —
  // matching the native until-stop semantics. Returns false for a packet
  // that is not an out verb.
  sendOut(oscBytes) {
    const cmd = gamepad_out_decode(oscBytes);
    if (!cmd) return false;
    const [verb, target] = cmd;
    const pads = this._getGamepads();
    for (const [index, entry] of this._pads) {
      if (target !== "*" && entry.handle !== target) continue;
      const pad = pads[index];
      if (!pad || pad.id !== entry.id) continue;
      const actuator = pad.vibrationActuator;
      if (!actuator) continue;
      if (verb === "rumble") {
        const [, , strong, weak, durationMs] = cmd;
        const now = this._now();
        actuator.playEffect("dual-rumble", {
          strongMagnitude: strong,
          weakMagnitude: weak,
          duration: durationMs > 0 ? Math.min(durationMs, 5e3) : 5e3
        });
        entry.rumble = {
          strong,
          weak,
          until: durationMs > 0 ? now + durationMs : Infinity,
          nextPlay: now + this._rumbleRefreshMs
        };
      } else if (verb === "rumble_stop") {
        if (actuator.reset) actuator.reset();
        delete entry.rumble;
      }
    }
    return true;
  }
  // Renew an active long-running rumble before the API's 5 s effect ceiling
  // cuts it off. Called every poll tick for each live pad.
  _refreshRumble(entry, pad) {
    const r = entry.rumble;
    if (!r) return;
    const now = this._now();
    if (now >= r.until) {
      delete entry.rumble;
      return;
    }
    if (now < r.nextPlay) return;
    pad.vibrationActuator?.playEffect("dual-rumble", {
      strongMagnitude: r.strong,
      weakMagnitude: r.weak,
      duration: Math.min(r.until - now, 5e3)
    });
    r.nextPlay = now + this._rumbleRefreshMs;
  }
};

// clockwork/js/lib/host_front.js
var MIDI_PREFIX = clockworkSys("midi/");
var GAMEPAD_PREFIX = clockworkSys("gamepad/");
var REASON_NO_MIDI = "MIDI is not enabled on this host: new Clockwork({ midi: true })";
var REASON_NO_GAMEPAD = "gamepad is not enabled on this host: new Clockwork({ gamepad: true })";
var REASON_NOT_ON_WEB = "not available on the web host";
var REASON_UNKNOWN = "unknown clockwork verb";
var REASON_MALFORMED = "malformed";
var HostFront = class {
  /**
   * @param {object} options
   * @param {boolean|object} [options.midi=false] enable Web MIDI; an object
   *   is passed to MidiManager (requestAccess, wasm — for tests and
   *   non-standard hosts).
   * @param {boolean|object} [options.gamepad=false] enable the Gamepad API;
   *   an object is passed to GamepadManager.
   * @param {string} [options.wasmBaseURL] where clockwork_midi_bg.wasm and
   *   clockwork_gamepad_bg.wasm are, unless the manager options say.
   * @param {(bytes: Uint8Array) => void} options.deliver an inbound frame
   *   for the client, as if from the engine.
   * @param {(bytes: Uint8Array) => void} options.ingest an event for the
   *   engine, into ingress, as a subsystem's callback would write it.
   */
  constructor({ midi = false, gamepad = false, wasmBaseURL = null, deliver, ingest } = {}) {
    this._midiOptions = midi;
    this._gamepadOptions = gamepad;
    this._wasmBaseURL = wasmBaseURL;
    this._deliver = deliver;
    this._ingest = ingest ?? deliver;
    this._midi = null;
    this._gamepad = null;
    this._midiSubscribed = false;
    this._gamepadSubscribed = false;
  }
  get midi() {
    return this._midi;
  }
  get gamepad() {
    return this._gamepad;
  }
  async init() {
    if (this._midiOptions) {
      const opts = typeof this._midiOptions === "object" ? { ...this._midiOptions } : {};
      if (opts.wasm === void 0 && this._wasmBaseURL)
        opts.wasm = this._wasmBaseURL + "clockwork_midi_bg.wasm";
      this._midi = new MidiManager(opts);
      this._midi.onEvent((osc3) => this._ingest(osc3));
      this._midi.onPorts((osc3) => this._ingest(osc3));
      this._midi.onTempo((port, bpm) => {
        this._ingest(copyEncoded(
          encodeMessage(clockworkSys("midi/in/clock_bpm"), [port, { type: "float", value: bpm }])
        ));
      });
      await this._midi.init();
    }
    if (this._gamepadOptions) {
      const opts = typeof this._gamepadOptions === "object" ? { ...this._gamepadOptions } : {};
      if (opts.wasm === void 0 && this._wasmBaseURL)
        opts.wasm = this._wasmBaseURL + "clockwork_gamepad_bg.wasm";
      this._gamepad = new GamepadManager(opts);
      this._gamepad.onEvent((osc3) => this._ingest(osc3));
      this._gamepad.onDevices((osc3) => this._ingest(osc3));
      await this._gamepad.init();
    }
    return this;
  }
  dispose() {
    this._midi?.dispose();
    this._gamepad?.dispose();
    this._midi = null;
    this._gamepad = null;
    this._midiSubscribed = false;
    this._gamepadSubscribed = false;
  }
  /**
   * One frame off the egress. True iff it was a forwarded verb and the front
   * took it — answered, acted on, or refused. Everything else (a reply, a
   * push, the guest's traffic) is left for the client: false.
   *
   * A forwarded verb is a bundle with one element under the prefix. Nothing
   * else on the egress has that shape.
   */
  take(oscData) {
    if (!isBundle(oscData)) return this._takeEvent(oscData);
    if (oscData.length < 20) return false;
    const view = new DataView(oscData.buffer, oscData.byteOffset, oscData.byteLength);
    const size = view.getUint32(16, false);
    if (20 + size > oscData.length) return false;
    const element = oscData.subarray(20, 20 + size);
    if (element[0] !== 47) return false;
    let msg;
    try {
      msg = decodeMessage(element);
    } catch {
      return false;
    }
    const address = msg[0];
    if (!isClockworkSys(address)) return false;
    const when = view.getBigUint64(8, false);
    const whenMs = timetagToPerfMs(when);
    this._handle(address, msg.slice(1), element, whenMs);
    return true;
  }
  // An event coming back off the egress (clockwork_event_route): the
  // client's to hear if it subscribed to that subsystem, dropped if not.
  // Cheap: only the address is read, and only under the two prefixes.
  _takeEvent(oscData) {
    if (oscData[0] !== 47) return false;
    let end = 0;
    while (end < oscData.length && oscData[end] !== 0) end++;
    if (end > 48) return false;
    const address = String.fromCharCode.apply(null, oscData.subarray(0, end));
    const isMidi = address.startsWith(MIDI_PREFIX + "in/") || address === clockworkSys("midi/ports");
    const isPad = address.startsWith(GAMEPAD_PREFIX + "in/") || address === clockworkSys("gamepad/devices");
    if (isMidi) return !this._midiSubscribed;
    if (isPad) return !this._gamepadSubscribed;
    return false;
  }
  _handle(address, args, element, whenMs) {
    if (address.startsWith(MIDI_PREFIX)) return this._midiVerb(address, args, element, whenMs);
    if (address.startsWith(GAMEPAD_PREFIX)) return this._gamepadVerb(address, args, element);
    this._refuse(address, REASON_UNKNOWN);
  }
  _refuse(address, reason) {
    this._deliver(copyEncoded(encodeMessage(clockworkSys("error"), [address, reason])));
  }
  // The subscribe verbs ack with the trailing int32 the request carried, and
  // only then (SubscribeAck.h): a token-less subscribe stays silent.
  _ack(replyAddress, args) {
    const last = args[args.length - 1];
    if (typeof last === "number" && Number.isInteger(last))
      this._deliver(copyEncoded(encodeMessage(replyAddress, [{ type: "int", value: last }])));
  }
  _midiVerb(address, args, element, whenMs) {
    const m = this._midi;
    if (!m) return this._refuse(address, REASON_NO_MIDI);
    const verb = address.slice(MIDI_PREFIX.length);
    const port = typeof args[0] === "string" ? args[0] : "*";
    const flag = (i) => typeof args[i] === "number" && args[i] !== 0;
    switch (verb) {
      case "ports/list":
      case "ports/get":
        return this._deliver(m.portsReply());
      case "in/enable":
        return m.enable(port, true, flag(1));
      case "out/enable":
        return m.enable(port, false, flag(1));
      case "refresh":
        return m.refresh();
      case "notify/subscribe":
        this._midiSubscribed = true;
        this._deliver(m.portsReply());
        return this._ack(clockworkSys("midi/notify/subscribe.reply"), args);
      case "notify/unsubscribe":
        this._midiSubscribed = false;
        return;
      case "sink/send": {
        const raw = args[1];
        if (!(raw instanceof Uint8Array) || raw.length === 0)
          return this._refuse(address, REASON_MALFORMED);
        return m.sendFromSink(port, raw, whenMs);
      }
      case "clock/tick":
        return m.tick(port);
      case "clock/sync":
        return m.clockSync(port, flag(1));
      case "clock/beat":
      case "clock/follow":
      case "clock/unfollow":
      case "clock/followers":
        return this._refuse(address, REASON_NOT_ON_WEB);
      default:
        if (verb.startsWith("out/")) {
          if (!m.sendOut(element, whenMs)) this._refuse(address, REASON_MALFORMED);
          return;
        }
        return this._refuse(address, REASON_UNKNOWN);
    }
  }
  _gamepadVerb(address, args, element) {
    const g = this._gamepad;
    if (!g) return this._refuse(address, REASON_NO_GAMEPAD);
    const verb = address.slice(GAMEPAD_PREFIX.length);
    const pad = typeof args[0] === "string" ? args[0] : "*";
    switch (verb) {
      case "devices/list":
      case "devices/get":
        return this._deliver(g.devicesReply());
      case "enable":
        return g.enable(pad, typeof args[1] === "number" && args[1] !== 0);
      case "refresh":
        return g.refresh();
      case "notify/subscribe":
        this._gamepadSubscribed = true;
        this._deliver(g.devicesReply());
        return this._ack(clockworkSys("gamepad/notify/subscribe.reply"), args);
      case "notify/unsubscribe":
        this._gamepadSubscribed = false;
        return;
      default:
        if (verb.startsWith("out/")) {
          if (!g.sendOut(element)) this._refuse(address, REASON_MALFORMED);
          return;
        }
        return this._refuse(address, REASON_UNKNOWN);
    }
  }
};

// clockwork/js/lib/asset_loader.js
var DEFAULT_MAX_RETRIES = 3;
var DEFAULT_BASE_DELAY = 1e3;
var AssetLoader = class {
  #onLoadingEvent;
  #maxRetries;
  #baseDelay;
  #skipHeadRequests;
  constructor(options = {}) {
    const {
      onLoadingEvent = null,
      maxRetries = DEFAULT_MAX_RETRIES,
      baseDelay = DEFAULT_BASE_DELAY,
      skipHeadRequests = false
    } = options;
    this.#onLoadingEvent = onLoadingEvent;
    this.#maxRetries = maxRetries;
    this.#baseDelay = baseDelay;
    this.#skipHeadRequests = skipHeadRequests;
  }
  /**
   * Fetch an asset with retry logic and loading events
   * @param {string} url - URL to fetch
   * @param {Object} options - Options
   * @param {string} options.type - Asset type for events (e.g., 'sample', 'synthdef', 'wasm')
   * @param {string} options.name - Asset name for events
   * @returns {Promise<ArrayBuffer>} The fetched data
   */
  async fetch(url, { type, name }) {
    const getPromise = this.#fetchWithRetry(url);
    if (this.#skipHeadRequests) {
      this.#onLoadingEvent?.("loading:start", { type, name });
    } else {
      const downloadSize = await this.#fetchHead(url);
      this.#onLoadingEvent?.("loading:start", {
        type,
        name,
        ...downloadSize != null && { size: downloadSize }
      });
    }
    const response = await getPromise;
    const arrayBuffer = await response.arrayBuffer();
    this.#onLoadingEvent?.("loading:complete", {
      type,
      name,
      size: arrayBuffer.byteLength
    });
    return arrayBuffer;
  }
  /**
   * Fetch HEAD to get Content-Length
   * @private
   */
  async #fetchHead(url) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        const contentLength = response.headers.get("Content-Length");
        return contentLength ? parseInt(contentLength, 10) : null;
      }
      return null;
    } catch {
      return null;
    }
  }
  /**
   * Fetch with retry logic
   * @private
   */
  async #fetchWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt <= this.#maxRetries; attempt++) {
      try {
        const response = await fetch(url);
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        }
        if (!response.ok) {
          throw new Error(`Server error fetching ${url}: ${response.status} ${response.statusText}`);
        }
        return response;
      } catch (error) {
        lastError = error;
        if (error.message.match(/Failed to fetch .+: 4\d{2} /)) {
          throw error;
        }
        if (attempt < this.#maxRetries) {
          const delay = this.#baseDelay * Math.pow(2, attempt);
          if (true) {
            console.log(`[AssetLoader] Retry ${attempt + 1}/${this.#maxRetries} for ${url} after ${delay}ms`);
          }
          await this.#sleep(delay);
        }
      }
    }
    throw lastError;
  }
  /**
   * Sleep helper
   * @private
   */
  #sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// clockwork/js/lib/dsp_profile.js
var NO_DSP = Object.freeze({
  syncVerb: null,
  syncedVerb: null,
  blockedVerbs: Object.freeze({}),
  metrics: Object.freeze({}),
  metricsPanels: Object.freeze([])
});
function dspProfile(p) {
  if (!p) return NO_DSP;
  const str = (k) => {
    const v = p[k];
    if (v == null) return null;
    if (typeof v !== "string" || !v.startsWith("/")) {
      throw new TypeError(`dsp profile: ${k} must be an OSC address, got ${JSON.stringify(v)}`);
    }
    return v;
  };
  const syncVerb = str("syncVerb");
  const syncedVerb = str("syncedVerb");
  if (Boolean(syncVerb) !== Boolean(syncedVerb)) {
    throw new TypeError("dsp profile: syncVerb and syncedVerb come as a pair");
  }
  const metrics = {};
  const takenSlots = /* @__PURE__ */ new Map();
  for (const [name, def] of Object.entries(p.metrics ?? {})) {
    if (!def || !Number.isInteger(def.slot)) {
      throw new TypeError(`dsp profile: metric ${name} needs an integer slot`);
    }
    if (def.slot < 0 || def.slot >= GUEST_METRICS_COUNT) {
      throw new RangeError(
        `dsp profile: metric ${name} slot ${def.slot} is outside the guest range (0..${GUEST_METRICS_COUNT - 1})`
      );
    }
    if (takenSlots.has(def.slot)) {
      throw new TypeError(
        `dsp profile: metrics ${takenSlots.get(def.slot)} and ${name} both claim slot ${def.slot}`
      );
    }
    takenSlots.set(def.slot, name);
    metrics[name] = Object.freeze({ ...def });
  }
  return Object.freeze({
    syncVerb,
    syncedVerb,
    blockedVerbs: Object.freeze({ ...p.blockedVerbs ?? {} }),
    metrics: Object.freeze(metrics),
    metricsPanels: Object.freeze([...p.metricsPanels ?? []])
  });
}

// clockwork/js/lib/event_emitter.js
var EventEmitter = class {
  #listeners = /* @__PURE__ */ new Map();
  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Function to call when event fires
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    }
    if (!this.#listeners.has(event)) {
      this.#listeners.set(event, /* @__PURE__ */ new Set());
    }
    this.#listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }
  /**
   * Unsubscribe from an event
   * @param {string} event - Event name
   * @param {Function} callback - Function to remove
   * @returns {this} For chaining
   */
  off(event, callback) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
    return this;
  }
  /**
   * Subscribe to an event once (auto-unsubscribes after first call)
   * @param {string} event - Event name
   * @param {Function} callback - Function to call once
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      callback(...args);
    };
    return this.on(event, wrapper);
  }
  /**
   * Remove all listeners for an event, or all listeners entirely
   * @param {string} [event] - Event name. If omitted, removes ALL listeners.
   * @returns {this} For chaining
   */
  removeAllListeners(event) {
    if (event === void 0) {
      this.#listeners.clear();
    } else {
      this.#listeners.delete(event);
    }
    return this;
  }
  /**
   * Check if there are listeners for an event
   * @param {string} event - Event name
   * @returns {boolean}
   */
  hasListeners(event) {
    const listeners = this.#listeners.get(event);
    return listeners ? listeners.size > 0 : false;
  }
  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   */
  emit(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} listener:`, error);
        }
      }
    }
  }
  /**
   * Emit an event and await all listeners (for async handlers)
   * @param {string} event - Event name
   * @param {...*} args - Arguments to pass to listeners
   */
  async emitAsync(event, ...args) {
    const listeners = this.#listeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          await callback(...args);
        } catch (error) {
          console.error(`[EventEmitter] Error in ${event} listener:`, error);
        }
      }
    }
  }
};

// clockwork/js/lib/metrics_reader.js
var ADD_METRIC_OFFSETS = {
  oscOutMessagesSent: OSC_OUT_MESSAGES_SENT,
  oscOutBytesSent: OSC_OUT_BYTES_SENT
};
var MetricsReader = class {
  #guestMetrics = {};
  #sharedBuffer;
  #ringBufferBase;
  #bufferConstants;
  #mode;
  // Cached views (SAB mode only)
  #atomicView;
  #metricsView;
  #controlIndices;
  // Cached snapshot buffer (postMessage mode)
  #cachedSnapshotBuffer = null;
  // Merged array: slots 0-(SAB_METRICS_COUNT-1) from SAB/snapshot, SAB_METRICS_COUNT+ from context
  #mergedArray = new Uint32Array(MERGED_ARRAY_SIZE);
  #mergedDV = new DataView(this.#mergedArray.buffer);
  /**
   * @param {Object} options
   * @param {string} options.mode - 'sab' or 'postMessage'
   * @param {SharedArrayBuffer} [options.sharedBuffer] - Required for SAB mode
   * @param {number} [options.ringBufferBase] - Required for SAB mode
   * @param {Object} [options.bufferConstants] - Buffer layout constants
   */
  /*
   * `guestMetrics` is the guest's declaration: name -> {slot, type, ...}.
   * Empty means the guest exposes none, which is a normal state, not a
   * degraded one.
   */
  constructor(options = {}) {
    this.#guestMetrics = options.guestMetrics || {};
    this.#mode = options.mode || "sab";
    this.#sharedBuffer = options.sharedBuffer || null;
    this.#ringBufferBase = options.ringBufferBase || 0;
    this.#bufferConstants = options.bufferConstants || null;
  }
  /**
   * Initialize shared views (SAB mode only)
   * Call after receiving bufferConstants from worklet
   */
  initSharedViews(sharedBuffer, ringBufferBase, bufferConstants) {
    this.#sharedBuffer = sharedBuffer;
    this.#ringBufferBase = ringBufferBase;
    this.#bufferConstants = bufferConstants;
    if (this.#mode === "sab" && sharedBuffer && bufferConstants) {
      this.#atomicView = new Int32Array(sharedBuffer);
      this.#controlIndices = calculateAllControlIndices(ringBufferBase, bufferConstants.CONTROL_START);
      const metricsBase = ringBufferBase + bufferConstants.METRICS_START;
      this.#metricsView = new Uint32Array(
        sharedBuffer,
        metricsBase,
        bufferConstants.METRICS_SIZE / 4
      );
    }
  }
  /**
   * Update cached snapshot buffer (postMessage mode)
   * @param {ArrayBuffer} buffer - Snapshot from worklet
   */
  updateSnapshot(buffer) {
    this.#cachedSnapshotBuffer = buffer;
  }
  /**
   * Get the cached snapshot buffer
   * @returns {ArrayBuffer|null}
   */
  getSnapshotBuffer() {
    return this.#cachedSnapshotBuffer;
  }
  /**
   * Get the metrics view (for direct access)
   * @returns {Uint32Array|null}
   */
  getMetricsView() {
    return this.#metricsView;
  }
  /**
   * Add to a metric in SharedArrayBuffer
   * @param {string} metric - Metric name
   * @param {number} [amount=1] - Amount to add
   */
  addMetric(metric, amount = 1) {
    if (!this.#metricsView) {
      return;
    }
    const offset = ADD_METRIC_OFFSETS[metric];
    if (offset !== void 0) {
      Atomics.add(this.#metricsView, offset, amount);
    }
  }
  /**
   * Gather all metrics as a named object.
   * Uses updateMergedArray() as the single read path, then builds named properties.
   * @param {Object} context - Context with additional metric sources
   * @returns {Object} Combined metrics
   */
  gatherMetrics(context = {}) {
    this.updateMergedArray(context);
    const m = this.#mergedArray;
    const metrics = {
      // engine metrics
      engineProcessCount: m[ENGINE_PROCESS_COUNT],
      engineMessagesProcessed: m[ENGINE_MESSAGES_PROCESSED],
      engineMessagesDropped: m[ENGINE_MESSAGES_DROPPED],
      engineSchedulerDepth: m[ENGINE_SCHEDULER_DEPTH],
      engineSchedulerPeakDepth: m[ENGINE_SCHEDULER_PEAK_DEPTH],
      engineSchedulerDropped: m[ENGINE_SCHEDULER_DROPPED],
      engineSequenceGaps: m[ENGINE_SEQUENCE_GAPS],
      engineSchedulerLates: m[ENGINE_SCHEDULER_LATES],
      engineSchedulerMaxLateMs: m[ENGINE_SCHEDULER_MAX_LATE_MS],
      engineSchedulerLastLateMs: m[ENGINE_SCHEDULER_LAST_LATE_MS],
      engineSchedulerLastLateTick: m[ENGINE_SCHEDULER_LAST_LATE_TICK],
      // OSC In/Out metrics
      oscInMessagesReceived: m[OSC_IN_MESSAGES_RECEIVED],
      oscInMessagesDropped: m[OSC_IN_DROPPED_MESSAGES],
      oscInBytesReceived: m[OSC_IN_BYTES_RECEIVED],
      debugMessagesReceived: m[DEBUG_MESSAGES_RECEIVED],
      debugBytesReceived: m[DEBUG_BYTES_RECEIVED],
      oscOutMessagesSent: m[OSC_OUT_MESSAGES_SENT],
      oscOutBytesSent: m[OSC_OUT_BYTES_SENT],
      // Error metrics
      engineWasmErrors: m[ENGINE_WASM_ERRORS],
      oscInCorrupted: m[OSC_IN_CORRUPTED],
      ringBufferDirectWriteFails: m[RING_BUFFER_DIRECT_WRITE_FAILS],
      // System info (cross-platform; written by shared C++ at init)
      clockworkVersionMajor: m[CLOCKWORK_VERSION_MAJOR],
      clockworkVersionMinor: m[CLOCKWORK_VERSION_MINOR],
      clockworkVersionPatch: m[CLOCKWORK_VERSION_PATCH],
      audioSampleRate: m[AUDIO_SAMPLE_RATE],
      audioBlockSize: m[AUDIO_BLOCK_SIZE],
      audioOutputChannels: m[AUDIO_OUTPUT_CHANNELS],
      audioInputChannels: m[AUDIO_INPUT_CHANNELS],
      // ClockworkClock readouts (cross-platform; written per block). Fixed-point:
      // tempo is milli-BPM (÷1000), beat/phase are ×100.
      clockTempoMbpm: m[CLOCK_TEMPO_MBPM],
      clockBeatCenti: m[CLOCK_BEAT_CENTI],
      clockPhaseCenti: m[CLOCK_PHASE_CENTI],
      clockPlaying: m[CLOCK_PLAYING],
      // Link + Link Audio (native-only; no web writer, so always 0 on WASM —
      // present here so getMetrics() keys are mode-independent).
      linkPeers: m[LINK_PEERS],
      linkTempoMbpm: m[LINK_TEMPO_MBPM],
      linkBeatCenti: m[LINK_BEAT_CENTI],
      linkPhaseCenti: m[LINK_PHASE_CENTI],
      linkPlaying: m[LINK_PLAYING],
      linkAudioInChannels: m[LINK_AUDIO_IN_CHANNELS],
      linkAudioStreamRate: m[LINK_AUDIO_STREAM_RATE],
      linkAudioUnderruns: m[LINK_AUDIO_UNDERRUNS],
      linkAudioBufferedMs: m[LINK_AUDIO_BUFFERED_MS],
      linkAudioDriftPpm: m[LINK_AUDIO_DRIFT_PPM],
      linkAudioPublish: m[LINK_AUDIO_PUBLISH],
      linkAudioSinks: m[LINK_AUDIO_SINKS],
      // Mode
      mode: this.#mode
    };
    const bc = this.#bufferConstants;
    if (m[IN_BUFFER_USED_BYTES] !== void 0 && bc) {
      metrics.inBufferUsed = {
        bytes: m[IN_BUFFER_USED_BYTES],
        percentage: m[IN_BUFFER_USED_BYTES] / bc.IN_BUFFER_SIZE * 100,
        peakBytes: m[IN_BUFFER_PEAK_BYTES],
        peakPercentage: m[IN_BUFFER_PEAK_BYTES] / bc.IN_BUFFER_SIZE * 100,
        capacity: bc.IN_BUFFER_SIZE
      };
      metrics.outBufferUsed = {
        bytes: m[OUT_BUFFER_USED_BYTES],
        percentage: m[OUT_BUFFER_USED_BYTES] / bc.OUT_BUFFER_SIZE * 100,
        peakBytes: m[OUT_BUFFER_PEAK_BYTES],
        peakPercentage: m[OUT_BUFFER_PEAK_BYTES] / bc.OUT_BUFFER_SIZE * 100,
        capacity: bc.OUT_BUFFER_SIZE
      };
      metrics.nrtOutBufferUsed = {
        bytes: m[NRT_OUT_BUFFER_USED_BYTES],
        percentage: m[NRT_OUT_BUFFER_USED_BYTES] / bc.NRT_OUT_BUFFER_SIZE * 100,
        peakBytes: m[NRT_OUT_BUFFER_PEAK_BYTES],
        peakPercentage: m[NRT_OUT_BUFFER_PEAK_BYTES] / bc.NRT_OUT_BUFFER_SIZE * 100,
        capacity: bc.NRT_OUT_BUFFER_SIZE
      };
    }
    if (bc?.scheduler_slot_count !== void 0) {
      metrics.engineSchedulerCapacity = bc.scheduler_slot_count;
    }
    if (context.driftOffsetMs !== void 0) metrics.driftOffsetMs = context.driftOffsetMs;
    if (context.ntpStartTime !== void 0) metrics.ntpStartTime = context.ntpStartTime;
    if (context.clockOffsetMs !== void 0) metrics.clockOffsetMs = context.clockOffsetMs;
    if (context.audioContextState) metrics.audioContextState = context.audioContextState;
    for (const [name, def] of Object.entries(this.#guestMetrics)) {
      metrics[name] = m[GUEST_METRICS_BASE + def.slot];
    }
    metrics.audioHealthPct = context.audioHealthPct ?? 100;
    metrics.hasPlaybackStats = !!context.playbackStats;
    if (context.playbackStats) {
      metrics.glitchCount = context.playbackStats.fallbackFramesEvents ?? 0;
      metrics.glitchDurationMs = Math.round((context.playbackStats.fallbackFramesDuration ?? 0) * 1e3);
      metrics.averageLatencyUs = Math.round((context.playbackStats.averageLatency ?? 0) * 1e6);
      metrics.maxLatencyUs = Math.round((context.playbackStats.maximumLatency ?? 0) * 1e6);
      metrics.totalFramesDurationMs = Math.round((context.playbackStats.totalFramesDuration ?? 0) * 1e3);
    } else {
      metrics.glitchCount = 0;
      metrics.glitchDurationMs = 0;
      metrics.averageLatencyUs = 0;
      metrics.maxLatencyUs = 0;
      metrics.totalFramesDurationMs = 0;
    }
    if (this.#mode === "postMessage" && context.transportMetrics) {
      Object.assign(metrics, context.transportMetrics);
    }
    return metrics;
  }
  /**
   * Update the merged array with current metrics from SAB/snapshot + context.
   * Zero-allocation: writes into the pre-allocated Uint32Array.
   * @param {Object} context - Context with additional metric sources
   */
  updateMergedArray(context = {}) {
    const arr = this.#mergedArray;
    if (this.#mode === "postMessage") {
      if (this.#cachedSnapshotBuffer) {
        const view = new Uint32Array(this.#cachedSnapshotBuffer, 0, SAB_METRICS_COUNT);
        arr.set(view);
      }
      if (context.transportMetrics) {
        if (context.transportMetrics.oscOutMessagesSent !== void 0) {
          arr[OSC_OUT_MESSAGES_SENT] = context.transportMetrics.oscOutMessagesSent;
        }
        if (context.transportMetrics.oscOutBytesSent !== void 0) {
          arr[OSC_OUT_BYTES_SENT] = context.transportMetrics.oscOutBytesSent;
        }
      }
    } else if (this.#metricsView) {
      arr.set(this.#metricsView);
    }
    const dv = this.#mergedDV;
    dv.setInt32(CTX_DRIFT_OFFSET_MS * 4, context.driftOffsetMs ?? 0, true);
    dv.setInt32(CTX_CLOCK_OFFSET_MS * 4, context.clockOffsetMs ?? 0, true);
    const stateStr = context.audioContextState || "unknown";
    const stateEnum = { unknown: 0, running: 1, suspended: 2, closed: 3, interrupted: 4 };
    arr[CTX_AUDIO_CONTEXT_STATE] = stateEnum[stateStr] ?? 0;
    const guestValues = context.guestMetrics || {};
    for (const [name, def] of Object.entries(this.#guestMetrics)) {
      const v = guestValues[name];
      arr[GUEST_METRICS_BASE + def.slot] = Number.isFinite(v) ? v : 0;
    }
    const bc = this.#bufferConstants;
    arr[CTX_ENGINE_SCHEDULER_CAPACITY] = bc?.scheduler_slot_count ?? 0;
    arr[CTX_IN_BUFFER_CAPACITY] = bc?.IN_BUFFER_SIZE ?? 0;
    arr[CTX_OUT_BUFFER_CAPACITY] = bc?.OUT_BUFFER_SIZE ?? 0;
    arr[CTX_NRT_OUT_BUFFER_CAPACITY] = bc?.NRT_OUT_BUFFER_SIZE ?? 0;
    arr[CTX_MODE] = this.#mode === "sab" ? 0 : 1;
    arr[CTX_HAS_PLAYBACK_STATS] = context.playbackStats ? 1 : 0;
    if (context.playbackStats) {
      arr[CTX_GLITCH_COUNT] = context.playbackStats.fallbackFramesEvents ?? 0;
      arr[CTX_GLITCH_DURATION_MS] = Math.round((context.playbackStats.fallbackFramesDuration ?? 0) * 1e3);
      arr[CTX_AVERAGE_LATENCY_US] = Math.round((context.playbackStats.averageLatency ?? 0) * 1e6);
      arr[CTX_MAX_LATENCY_US] = Math.round((context.playbackStats.maximumLatency ?? 0) * 1e6);
      arr[CTX_TOTAL_FRAMES_DURATION_MS] = Math.round((context.playbackStats.totalFramesDuration ?? 0) * 1e3);
    }
    arr[CTX_AUDIO_HEALTH_PCT] = context.audioHealthPct ?? 100;
  }
  /**
   * Get the merged array reference (same Uint32Array every call — zero allocation).
   * Call updateMergedArray() first to refresh values.
   * @returns {Uint32Array}
   */
  getMergedArray() {
    return this.#mergedArray;
  }
  /**
   * Get buffer constants
   * @returns {Object|null}
   */
  get bufferConstants() {
    return this.#bufferConstants;
  }
  /**
   * Get ring buffer base address
   * @returns {number}
   */
  get ringBufferBase() {
    return this.#ringBufferBase;
  }
  /**
   * Get shared buffer
   * @returns {SharedArrayBuffer|null}
   */
  get sharedBuffer() {
    return this.#sharedBuffer;
  }
};

// clockwork/js/lib/metrics_schema.js
var COMPOSITES = {
  schedulerQueueCurrentPeak: { description: "Current | peak scheduler queue depth" },
  schedulerLateWorstLast: { description: "Worst | most recent late bundle execution (ms)" },
  debugCountBytes: { description: "Debug messages from Clockwork (count and bytes)" },
  oscSentCountBytes: { description: "Messages | bytes sent from host to Clockwork" },
  oscRecvCountBytes: { description: "Messages | bytes received back from Clockwork" },
  inRingUsedPeak: { description: "Used / peak bytes in the IN ring buffer (host to Clockwork)" },
  outRingUsedPeak: { description: "Used / peak bytes in the OUT ring buffer (Clockwork replies to host)" },
  nrtRingUsedPeak: { description: "Used / peak bytes in the NRT-out ring buffer (replies, notifications, debug)" },
  linkAudioChannelsRate: { description: "Received Link Audio channels and their sample rate" },
  linkAudioPublishSinks: { description: "Link Audio publishing state (1 = on) | active output sinks" },
  engineVersion: { description: "Clockwork engine version" },
  busChannelsOutIn: { description: "Output | input audio bus channels" },
  nrtWorstRecentBoot: { description: "Worst control pass in the last minute | since boot (ms)" }
};
var METRICS_SCHEMA = {
  metrics: {
    // engine metrics [0-8]
    engineProcessCount: { offset: 0, type: "counter", unit: "count", description: "Audio process() calls" },
    engineMessagesProcessed: { offset: 1, type: "counter", unit: "count", description: "Messages drained from the IN ring and dispatched" },
    engineMessagesDropped: { offset: 2, type: "counter", unit: "count", description: "Messages dropped (ring buffer full)" },
    engineSchedulerDepth: { offset: 3, type: "gauge", unit: "count", description: "Current scheduler queue depth" },
    engineSchedulerPeakDepth: { offset: 4, type: "gauge", unit: "count", description: "Peak scheduler queue depth (high water mark)" },
    engineSchedulerDropped: { offset: 5, type: "counter", unit: "count", description: "Events dropped because the scheduler queue overflowed" },
    engineSequenceGaps: { offset: 6, type: "counter", unit: "count", description: "Messages lost in transit from host to Clockwork" },
    engineWasmErrors: { offset: 7, type: "counter", unit: "count", description: "WASM execution errors in audio worklet" },
    engineSchedulerLates: { offset: 8, type: "counter", unit: "count", description: "Bundles executed after their scheduled time" },
    // OSC Out metrics [9-10]
    oscOutMessagesSent: { offset: 9, type: "counter", unit: "count", description: "OSC messages sent from host to Clockwork" },
    oscOutBytesSent: { offset: 10, type: "counter", unit: "bytes", description: "Total bytes sent from host to Clockwork" },
    // OSC In metrics [11-14]
    oscInMessagesReceived: { offset: 11, type: "counter", unit: "count", description: "OSC replies received from Clockwork" },
    oscInBytesReceived: { offset: 12, type: "counter", unit: "bytes", description: "Total bytes received from Clockwork" },
    oscInMessagesDropped: { offset: 13, type: "counter", unit: "count", description: "Replies lost in transit from Clockwork to host" },
    oscInCorrupted: { offset: 14, type: "counter", unit: "count", description: "Corrupted messages detected in the ring buffer" },
    // Debug metrics [15-16]
    debugMessagesReceived: { offset: 15, type: "counter", unit: "count", description: "Debug messages from Clockwork" },
    debugBytesReceived: { offset: 16, type: "counter", unit: "bytes", description: "Debug bytes received" },
    // Ring buffer usage [17-22]
    inBufferUsedBytes: { offset: 17, type: "gauge", unit: "bytes", description: "Bytes used in IN ring buffer" },
    outBufferUsedBytes: { offset: 18, type: "gauge", unit: "bytes", description: "Bytes used in OUT ring buffer" },
    nrtOutBufferUsedBytes: { offset: 19, type: "gauge", unit: "bytes", description: "Bytes used in NRT-out ring buffer" },
    inBufferPeakBytes: { offset: 20, type: "gauge", unit: "bytes", description: "Peak bytes used in IN ring buffer" },
    outBufferPeakBytes: { offset: 21, type: "gauge", unit: "bytes", description: "Peak bytes used in OUT ring buffer" },
    nrtOutBufferPeakBytes: { offset: 22, type: "gauge", unit: "bytes", description: "Peak bytes used in NRT-out ring buffer" },
    // engine late timing diagnostics [23-25]
    engineSchedulerMaxLateMs: { offset: 23, type: "gauge", unit: "ms", description: "Maximum lateness observed in the scheduler (ms)" },
    engineSchedulerLastLateMs: { offset: 24, type: "gauge", unit: "ms", description: "Most recent late magnitude in the scheduler (ms)" },
    engineSchedulerLastLateTick: { offset: 25, type: "gauge", unit: "count", description: "Process count when the last scheduler late occurred" },
    // Ring buffer direct write failures [26]
    ringBufferDirectWriteFails: { offset: 26, type: "counter", unit: "count", description: "SAB mode only: direct IN-ring writes that lost the lock race or hit a full ring and were dropped (no fallback)" },
    // Link session [27-31] — native-only (no web writer; always 0 on WASM).
    // ClockworkClock session state lives in its own SAB region (ClockworkClockState),
    // not in PerformanceMetrics. Owned by engine.clock.
    linkPeers: { offset: 27, type: "gauge", unit: "count", nativeOnly: true, description: "Connected Ableton Link peers on the network" },
    linkTempoMbpm: { offset: 28, type: "gauge", unit: "milliBpm", nativeOnly: true, description: "Shared Link session tempo" },
    linkBeatCenti: { offset: 29, type: "gauge", unit: "centi", nativeOnly: true, description: "Current Link beat position" },
    linkPhaseCenti: { offset: 30, type: "gauge", unit: "centi", nativeOnly: true, description: "Phase within the Link quantum" },
    linkPlaying: { offset: 31, type: "gauge", unit: "bool", nativeOnly: true, description: "Link transport playing (0/1)" },
    // Link Audio stream health [32-38] — native-only (no web writer)
    linkAudioInChannels: { offset: 32, type: "gauge", unit: "count", nativeOnly: true, description: "Active received Link Audio channels" },
    linkAudioStreamRate: { offset: 33, type: "gauge", unit: "Hz", nativeOnly: true, description: "Received Link Audio stream sample rate" },
    linkAudioUnderruns: { offset: 34, type: "counter", unit: "count", nativeOnly: true, description: "Receiver queue underruns (stream audio arrived too late to play)" },
    linkAudioBufferedMs: { offset: 35, type: "gauge", unit: "ms", nativeOnly: true, description: "Received Link Audio queued in the receiver (ms)" },
    linkAudioDriftPpm: { offset: 36, type: "gauge", unit: "ppm", signed: true, nativeOnly: true, description: "Read-rate deviation from the sender's clock (parts per million)" },
    linkAudioPublish: { offset: 37, type: "gauge", unit: "bool", nativeOnly: true, description: "Link Audio publishing enabled (0/1)" },
    linkAudioSinks: { offset: 38, type: "gauge", unit: "count", nativeOnly: true, description: "Active Link Audio output sinks" },
    // System info [39-45] — cross-platform; written by shared C++ at init.
    clockworkVersionMajor: { offset: 39, type: "constant", unit: "count", description: "Clockwork major version" },
    clockworkVersionMinor: { offset: 40, type: "constant", unit: "count", description: "Clockwork minor version" },
    clockworkVersionPatch: { offset: 41, type: "constant", unit: "count", description: "Clockwork patch version" },
    audioSampleRate: { offset: 42, type: "constant", unit: "Hz", description: "Output sample rate" },
    audioBlockSize: { offset: 43, type: "constant", unit: "count", description: "Audio block size in frames per callback" },
    audioOutputChannels: { offset: 44, type: "constant", unit: "count", description: "Output bus channels" },
    audioInputChannels: { offset: 45, type: "constant", unit: "count", description: "Input bus channels" },
    // ClockworkClock readouts [46-49] — cross-platform; written per block.
    clockTempoMbpm: { offset: 46, type: "gauge", unit: "milliBpm", description: "Tempo of the engine's internal ClockworkClock" },
    clockBeatCenti: { offset: 47, type: "gauge", unit: "centi", description: "Current ClockworkClock beat position" },
    clockPhaseCenti: { offset: 48, type: "gauge", unit: "centi", description: "Phase within the quantum" },
    clockPlaying: { offset: 49, type: "gauge", unit: "bool", description: "Transport playing (0/1)" },
    // Context metrics [50+] (main thread only)
    driftOffsetMs: { offset: 50, type: "gauge", unit: "ms", signed: true, description: "Clock drift between AudioContext and wall clock" },
    clockOffsetMs: { offset: 51, type: "gauge", unit: "ms", signed: true, description: "Clock offset for multi-system sync" },
    audioContextState: { offset: 52, type: "enum", values: ["unknown", "running", "suspended", "closed", "interrupted"], description: "AudioContext state" },
    engineSchedulerCapacity: { offset: 57, type: "constant", unit: "count", description: "Maximum scheduler queue size" },
    inBufferCapacity: { offset: 58, type: "constant", unit: "bytes", description: "IN ring buffer capacity" },
    outBufferCapacity: { offset: 59, type: "constant", unit: "bytes", description: "OUT ring buffer capacity" },
    nrtOutBufferCapacity: { offset: 60, type: "constant", unit: "bytes", description: "NRT-out ring buffer capacity" },
    mode: { offset: 61, type: "enum", values: ["sab", "postMessage"], description: "Transport mode" },
    // Audio diagnostics [62-68] (main thread, Chrome playbackStats + cross-browser health)
    glitchCount: { offset: 62, type: "counter", unit: "count", description: "Chrome only: audio underrun/glitch events" },
    glitchDurationMs: { offset: 63, type: "gauge", unit: "ms", description: "Chrome only: total silence from audio underruns" },
    averageLatencyUs: { offset: 64, type: "gauge", unit: "us", description: "Chrome only: average audio output latency" },
    maxLatencyUs: { offset: 65, type: "gauge", unit: "us", description: "Chrome only: maximum audio output latency" },
    audioHealthPct: { offset: 66, type: "gauge", unit: "%", description: "Cross-browser: fraction of expected audio frames delivered (100% = no issues)" },
    totalFramesDurationMs: { offset: 67, type: "counter", unit: "ms", description: "Chrome only: total audio rendered duration" },
    hasPlaybackStats: { offset: 68, type: "gauge", unit: "bool", description: "1 if Chrome playbackStats API is available, 0 otherwise" }
    // Buffer pool growth metrics [69-72] (main thread)
  },
  // NATIVE_STATS shm segment (native/JUCE backend only; see NATIVE_STAT_* in
  // src/shared_memory.h). `index` is the u32 slot within the segment — a
  // separate address space from the PerformanceMetrics offsets above.
  nativeStats: {
    cpuAvgCenti: { index: 0, type: "gauge", unit: "centi", description: "Average DSP load: how much of each audio callback's time budget the render consumed, smoothed over the last ~10 callbacks. 100% means rendering ate the whole real-time deadline" },
    cpuPeakCenti: { index: 1, type: "gauge", unit: "centi", description: "Peak DSP load: spikes show immediately, then decay ~5% per callback so they fade instead of pinning forever. Sustained values near 100% risk audible glitches" },
    cbOverruns: { index: 2, type: "counter", unit: "count", description: "Audio callbacks that overran their time budget" },
    nrtMaxPassUs: { index: 3, type: "gauge", unit: "us", description: "Longest the control thread has spent handling one batch of commands since boot" },
    nrtInFlightUs: { index: 4, type: "gauge", unit: "us", description: "How long the control thread has been stuck in the command it is handling right now. Anything but 0 means later commands, and every reply behind them, are waiting" },
    nrtRecentWorstUs: { index: 5, type: "gauge", unit: "us", description: "Longest the control thread has spent handling one batch of commands in the last minute (unlike the since-boot worst, this decays back to quiet)" }
  },
  composites: COMPOSITES,
  layout: {
    panels: [
      {
        title: "OSC Out",
        rows: [
          { label: "sent", cells: [{ key: "oscOutMessagesSent" }] },
          { label: "bytes", cells: [{ key: "oscOutBytesSent", kind: "muted", format: "bytes" }] },
          { label: "lost", cells: [{ key: "engineSequenceGaps", kind: "error" }] }
        ]
      },
      {
        title: "OSC In",
        rows: [
          { label: "received", cells: [{ key: "oscInMessagesReceived" }] },
          { label: "bytes", cells: [{ key: "oscInBytesReceived", kind: "muted", format: "bytes" }] },
          { label: "dropped", cells: [{ key: "oscInMessagesDropped", kind: "error" }] },
          { label: "corrupted", cells: [{ key: "oscInCorrupted", kind: "error" }] }
        ]
      },
      {
        title: "Engine Scheduler",
        rows: [
          { label: "queue", tooltip: COMPOSITES.schedulerQueueCurrentPeak.description, cells: [{ key: "engineSchedulerDepth" }, { sep: " | " }, { key: "engineSchedulerPeakDepth", kind: "muted" }] },
          { label: "dropped", cells: [{ key: "engineSchedulerDropped", kind: "error" }] },
          { label: "lates", cells: [{ key: "engineSchedulerLates", kind: "error" }] },
          { label: "max | last", tooltip: COMPOSITES.schedulerLateWorstLast.description, cells: [{ key: "engineSchedulerMaxLateMs", kind: "error" }, { sep: " | " }, { key: "engineSchedulerLastLateMs", kind: "dim" }, { text: " ms", kind: "muted" }] }
        ]
      },
      {
        title: "Engine",
        rows: [
          { label: "ticks", tooltip: "Audio process() callback count and OSC messages processed", cells: [{ key: "engineProcessCount", kind: "dim" }, { sep: " | " }, { key: "engineMessagesProcessed", kind: "muted" }, { text: " msgs", kind: "muted" }] },
          { label: "dropped", cells: [{ key: "engineMessagesDropped", kind: "error" }] },
          { label: "drift", cells: [{ key: "driftOffsetMs", format: "signed" }, { text: " ms", kind: "muted" }] },
          { label: "debug", tooltip: COMPOSITES.debugCountBytes.description, cells: [{ key: "debugMessagesReceived", kind: "muted" }, { text: " (" }, { key: "debugBytesReceived", kind: "muted", format: "bytes" }, { text: ")" }] }
        ]
      },
      {
        title: "Ring Buffer Level",
        class: "wide",
        rows: [
          { type: "bar", label: "in", usedKey: "inBufferUsedBytes", peakKey: "inBufferPeakBytes", capacityKey: "inBufferCapacity", color: "blue" },
          { type: "bar", label: "out", usedKey: "outBufferUsedBytes", peakKey: "outBufferPeakBytes", capacityKey: "outBufferCapacity", color: "green" },
          { type: "bar", label: "dbg", usedKey: "nrtOutBufferUsedBytes", peakKey: "nrtOutBufferPeakBytes", capacityKey: "nrtOutBufferCapacity", color: "purple" },
          { label: "direct write fails", cells: [{ key: "ringBufferDirectWriteFails", kind: "error" }] }
        ]
      },
      // A panel of one engine's sample-pool and definition counters used to
      // sit here. A panel is a claim about what a guest HAS, so it moved out
      // with the metrics it displays: a guest supplies its own through
      // `metricsPanels` on its profile, and one with no pool shows no panel
      // rather than four empty rows.
      {
        title: "AudioWorklet",
        rows: [
          { label: "health", tooltip: "AudioContext state and audio health percentage (fraction of expected frames delivered)", cells: [{ key: "audioContextState", kind: "green", format: "enum" }, { sep: " | " }, { key: "audioHealthPct", kind: "green", format: "percent" }, { text: " %", kind: "muted" }] },
          { label: "glitches", tooltip: "Chrome only: audio underrun/glitch events and total silence duration", cells: [{ key: "glitchCount", kind: "error", format: "chromeOnly" }, { sep: " (" }, { key: "glitchDurationMs", kind: "error", format: "chromeOnly" }, { text: " ms)", kind: "muted" }] },
          { label: "latency", tooltip: "Chrome only: avg | max audio output latency in ms", cells: [{ key: "averageLatencyUs", kind: "dim", format: "chromeLatencyUs" }, { sep: " | " }, { key: "maxLatencyUs", kind: "dim", format: "chromeLatencyUs" }, { text: " ms", kind: "muted" }] },
          { label: "WASM errors", cells: [{ key: "engineWasmErrors", kind: "error" }] }
        ]
      },
      {
        title: "Engine",
        rows: [
          { label: "version", cells: [{ key: "clockworkVersionMajor" }, { text: "." }, { key: "clockworkVersionMinor" }, { text: "." }, { key: "clockworkVersionPatch" }] },
          { label: "rate", cells: [{ key: "audioSampleRate" }, { text: " Hz", kind: "muted" }] },
          { label: "block", cells: [{ key: "audioBlockSize" }, { text: " frames", kind: "muted" }] },
          { label: "channels", tooltip: COMPOSITES.busChannelsOutIn.description, cells: [{ key: "audioOutputChannels" }, { sep: " | " }, { key: "audioInputChannels", kind: "muted" }] }
        ]
      },
      {
        title: "Clock",
        rows: [
          { label: "tempo", cells: [{ key: "clockTempoMbpm", format: "milliBpm" }, { text: " bpm", kind: "muted" }] },
          { label: "beat", cells: [{ key: "clockBeatCenti", kind: "dim", format: "centi" }] },
          { label: "phase", cells: [{ key: "clockPhaseCenti", kind: "dim", format: "centi" }] },
          { label: "playing", cells: [{ key: "clockPlaying", kind: "muted" }] }
        ]
      }
    ]
  }
};

// clockwork/js/lib/ntp_timing.js
var NTP_EPOCH_OFFSET4 = 2208988800;
var DRIFT_UPDATE_INTERVAL_MS = 1e3;
var INITIAL_DRIFT_DELAY_MS = 500;
var AUDIO_START_TIMEOUT_MS = 5e3;
var AUDIO_START_POLL_MS = 50;
function calculateCurrentNTP(performanceTimeMs) {
  return performanceTimeMs / 1e3 + NTP_EPOCH_OFFSET4;
}
function calculateNTPStartTime(currentNTP, contextTime) {
  return currentNTP - contextTime;
}
function calculateDriftUs(expectedContextTime, actualContextTime) {
  const driftSeconds = expectedContextTime - actualContextTime;
  return Math.round(driftSeconds * 1e6);
}
var NTPTiming = class {
  #mode;
  #audioContext;
  #workletPort;
  #audioStartTimeoutMs;
  #bufferConstants;
  #ringBufferBase;
  // Cached SAB views (SAB mode only)
  #ntpStartView;
  #driftView;
  #clockOffsetView;
  // Local storage (postMessage mode, or fallback)
  #initialNTPStartTime;
  #localDriftMs = 0;
  #localClockOffsetMs = 0;
  // Drift update timer
  #driftOffsetTimer = null;
  /**
   * @param {Object} options
   * @param {string} options.mode - 'sab' or 'postMessage'
   * @param {AudioContext} options.audioContext
   * @param {MessagePort} [options.workletPort] - Required for postMessage mode
   */
  constructor(options = {}) {
    this.#mode = options.mode || "sab";
    this.#audioContext = options.audioContext;
    this.#workletPort = options.workletPort || null;
    this.#audioStartTimeoutMs = options.audioStartTimeoutMs ?? AUDIO_START_TIMEOUT_MS;
  }
  /**
   * Write NTP start time to shared memory with a store-release fence.
   * Float64Array doesn't support Atomics, so we write via DataView and
   * fence with an Atomics.store on the adjacent drift Int32. The C++ side
   * reads drift with memory_order_acquire before reading the float64,
   * ensuring the double is fully visible.
   */
  #writeNtpStartTime(value) {
    this.#ntpStartView.setFloat64(0, value, true);
    if (this.#driftView) {
      Atomics.store(this.#driftView, 0, Atomics.load(this.#driftView, 0));
    }
  }
  /**
   * Initialize shared views for SAB mode
   * @param {SharedArrayBuffer} sharedBuffer
   * @param {number} ringBufferBase
   * @param {Object} bufferConstants
   */
  initSharedViews(sharedBuffer, ringBufferBase, bufferConstants) {
    this.#ringBufferBase = ringBufferBase;
    this.#bufferConstants = bufferConstants;
    if (this.#mode === "sab" && sharedBuffer && bufferConstants) {
      this.#ntpStartView = new DataView(
        sharedBuffer,
        ringBufferBase + bufferConstants.NTP_START_TIME_START,
        8
      );
      this.#driftView = new Int32Array(
        sharedBuffer,
        ringBufferBase + bufferConstants.DRIFT_OFFSET_START,
        1
      );
      this.#clockOffsetView = new Int32Array(
        sharedBuffer,
        ringBufferBase + bufferConstants.GLOBAL_OFFSET_START,
        1
      );
    }
  }
  /**
   * Set worklet port (for postMessage mode)
  /**
   * Update audio context reference (for recovery)
   * @param {AudioContext} audioContext
   */
  updateAudioContext(audioContext) {
    this.#audioContext = audioContext;
  }
  /**
   * Initialize NTP timing
   * Sets the NTP start time when AudioContext started, then calculates initial drift.
   * Blocks until audio is flowing and initial drift is measured.
   */
  async initialize() {
    if (!this.#audioContext) {
      return;
    }
    let timestamp;
    const maxAttempts = Math.max(1, Math.ceil(this.#audioStartTimeoutMs / AUDIO_START_POLL_MS));
    let attempts = 0;
    while (true) {
      timestamp = this.#audioContext.getOutputTimestamp();
      if (timestamp.contextTime > 0) {
        break;
      }
      if (++attempts >= maxAttempts) {
        throw new Error(
          `NTPTiming: AudioContext did not start (contextTime stayed 0 after ${this.#audioStartTimeoutMs}ms) \u2014 resume the AudioContext after a user gesture, then retry init()`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, AUDIO_START_POLL_MS));
    }
    timestamp = this.#audioContext.getOutputTimestamp();
    const perfTimeMs = performance.timeOrigin + timestamp.performanceTime;
    const currentNTP = calculateCurrentNTP(perfTimeMs);
    const contextTime = timestamp.contextTime;
    const ntpStartTime = calculateNTPStartTime(currentNTP, contextTime);
    if (this.#mode === "sab" && this.#ntpStartView) {
      this.#writeNtpStartTime(ntpStartTime);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: "setNTPStartTime",
        ntpStartTime
      });
    }
    this.#initialNTPStartTime = ntpStartTime;
    if (true) {
      console.log(
        `[Dbg-NTPTiming] Initialized: start=${ntpStartTime.toFixed(6)}s (NTP=${currentNTP.toFixed(3)}s, contextTime=${timestamp.contextTime.toFixed(3)}s)`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, INITIAL_DRIFT_DELAY_MS));
    this.updateDriftOffset();
  }
  /**
   * Update drift offset (AudioContext → NTP drift correction)
   * CRITICAL: This REPLACES the drift value, does not accumulate
   */
  updateDriftOffset() {
    if (!this.#audioContext || this.#initialNTPStartTime === void 0) {
      return;
    }
    const timestamp = this.#audioContext.getOutputTimestamp();
    const perfTimeMs = performance.timeOrigin + timestamp.performanceTime;
    const currentNTP = calculateCurrentNTP(perfTimeMs);
    const expectedContextTime = currentNTP - this.#initialNTPStartTime;
    const driftUs = calculateDriftUs(expectedContextTime, timestamp.contextTime);
    this.#localDriftMs = Math.round(driftUs / 1e3);
    if (this.#mode === "sab" && this.#driftView) {
      Atomics.store(this.#driftView, 0, driftUs);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: "setDriftOffset",
        driftOffsetUs: driftUs
      });
    }
    if (true) {
      console.log(
        `[Dbg-NTPTiming] Drift: ${(driftUs / 1e3).toFixed(1)}ms (expected=${expectedContextTime.toFixed(3)}s, actual=${timestamp.contextTime.toFixed(3)}s)`
      );
    }
  }
  /**
   * Resync NTP timing after recovering from suspend/interrupt.
   * Re-baselines the NTP start time and recalculates drift.
   */
  resync() {
    if (!this.#audioContext) {
      return;
    }
    const timestamp = this.#audioContext.getOutputTimestamp();
    if (!timestamp || timestamp.contextTime <= 0) {
      return;
    }
    const perfTimeMs = performance.timeOrigin + timestamp.performanceTime;
    const currentNTP = calculateCurrentNTP(perfTimeMs);
    const ntpStartTime = calculateNTPStartTime(currentNTP, timestamp.contextTime);
    if (this.#mode === "sab" && this.#ntpStartView) {
      this.#writeNtpStartTime(ntpStartTime);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: "setNTPStartTime",
        ntpStartTime
      });
    }
    this.#initialNTPStartTime = ntpStartTime;
    this.updateDriftOffset();
    if (true) {
      console.log(`[Dbg-NTPTiming] Resynced: start=${ntpStartTime.toFixed(6)}s`);
    }
  }
  /**
   * Start periodic drift offset updates
   */
  startDriftTimer() {
    this.stopDriftTimer();
    this.#driftOffsetTimer = setInterval(() => {
      this.updateDriftOffset();
    }, DRIFT_UPDATE_INTERVAL_MS);
    if (true) {
      console.log(`[Dbg-NTPTiming] Started drift timer (every ${DRIFT_UPDATE_INTERVAL_MS}ms)`);
    }
  }
  /**
   * Stop periodic drift offset updates
   */
  stopDriftTimer() {
    if (this.#driftOffsetTimer) {
      clearInterval(this.#driftOffsetTimer);
      this.#driftOffsetTimer = null;
    }
  }
  /**
   * Get current drift offset in milliseconds
   * @returns {number}
   */
  getDriftOffset() {
    if (this.#driftView) {
      return Math.round(Atomics.load(this.#driftView, 0) / 1e3);
    }
    return this.#localDriftMs;
  }
  /**
   * Get NTP start time
   * @returns {number}
   */
  getNTPStartTime() {
    if (this.#ntpStartView) {
      return this.#ntpStartView.getFloat64(0, true);
    }
    return this.#initialNTPStartTime ?? 0;
  }
  /**
   * Get clock offset in milliseconds (internal use)
   * @returns {number}
   */
  getClockOffset() {
    if (this.#clockOffsetView) {
      return Atomics.load(this.#clockOffsetView, 0);
    }
    return this.#localClockOffsetMs;
  }
  /**
   * Set clock offset for multi-system sync (e.g., Ableton Link, NTP server).
   * Positive values mean the shared/server clock is ahead of local time —
   * bundles with shared-clock timetags are shifted earlier to compensate.
   * @param {number} offsetS - Offset in seconds
   */
  setClockOffset(offsetS) {
    const offsetMs = Math.round(offsetS * 1e3);
    this.#localClockOffsetMs = offsetMs;
    if (this.#mode === "sab" && this.#clockOffsetView) {
      Atomics.store(this.#clockOffsetView, 0, offsetMs);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: "setClockOffset",
        clockOffsetMs: offsetMs
      });
    }
    if (true) {
      console.log(`[Dbg-NTPTiming] Clock offset set: ${offsetMs}ms (${offsetS}s)`);
    }
  }
  /**
   * Reset timing state (for shutdown/recover)
   */
  reset() {
    this.stopDriftTimer();
    this.#initialNTPStartTime = void 0;
    this.#localDriftMs = 0;
    this.#localClockOffsetMs = 0;
    this.#ntpStartView = null;
    this.#driftView = null;
    this.#clockOffsetView = null;
  }
};

// clockwork/js/lib/clock_math.js
function beatAt(t, origin, bpm) {
  return (t - origin) * bpm / 60;
}
function timeAtBeat(beat, origin, bpm) {
  return origin + beat * 60 / bpm;
}
function originFor(beat, t, bpm) {
  return t - beat * 60 / bpm;
}
function retempoOrigin(origin, oldBpm, newBpm, now) {
  if (origin === 0 || !(oldBpm >= 1)) return origin;
  return originFor(beatAt(now, origin, oldBpm), now, newBpm);
}
function wrapPhase(beat, quantum) {
  if (!(quantum > 0)) return 0;
  let p = beat % quantum;
  if (p < 0) p += quantum;
  return p;
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
function unpackMeter(packed) {
  return { num: packed >>> 16 & 65535, den: packed & 65535 };
}
function readClockMeter(views) {
  const packed = Atomics.load(views.int32, SC_METER_I32);
  return packed === 0 ? { num: 4, den: 4 } : unpackMeter(packed);
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

// clockwork/js/lib/clockwork_clock.js
var ClockworkClock = class {
  #mode;
  #workletPort;
  #audioContext;
  // SAB views over the ClockworkClockState region (same bytes, two strides).
  #sabBigInt;
  // BigInt64Array — for the three double fields
  #sabInt32;
  // Int32Array    — for the is_playing field
  #sabViews;
  // {bigInt, int32} — what the clockwork_clock_protocol writers take
  // PM-mode local copies. In SAB mode these are also kept up-to-date so
  // getters have a fallback before initSharedViews has run.
  #localBpm = 120;
  #localBeatOriginNtp = 0;
  #localIsPlaying = false;
  #localIsPlayingAtNtp = 0;
  #localMeter = { num: 4, den: 4 };
  #ntp;
  /**
   * @param {Object} options
   * @param {'sab'|'postMessage'} options.mode
   * @param {AudioContext} options.audioContext
   * @param {MessagePort} [options.workletPort] — required in PM mode
   */
  constructor(options = {}) {
    this.#mode = options.mode || "sab";
    this.#workletPort = options.workletPort || null;
    this.#audioContext = options.audioContext || null;
    this.#ntp = new NTPTiming({
      mode: this.#mode,
      audioContext: options.audioContext,
      workletPort: this.#workletPort
    });
  }
  /**
   * Initialize SAB views for session state and time.
   * @param {SharedArrayBuffer} sharedBuffer
   * @param {number} ringBufferBase
   * @param {Object} bufferConstants — must include CLOCK_STATE_START / _SIZE
   */
  initSharedViews(sharedBuffer, ringBufferBase, bufferConstants) {
    if (this.#mode === "sab") {
      const base = ringBufferBase + bufferConstants.CLOCK_STATE_START;
      const size = bufferConstants.CLOCK_STATE_SIZE;
      this.#sabBigInt = new BigInt64Array(sharedBuffer, base, size / 8);
      this.#sabInt32 = new Int32Array(sharedBuffer, base, size / 4);
      this.#sabViews = { bigInt: this.#sabBigInt, int32: this.#sabInt32 };
    }
    this.#ntp.initSharedViews(sharedBuffer, ringBufferBase, bufferConstants);
  }
  /** @param {MessagePort} port */
  setWorkletPort(port) {
    this.#workletPort = port;
  }
  updateAudioContext(audioContext) {
    this.#audioContext = audioContext;
    this.#ntp.updateAudioContext(audioContext);
  }
  // ── Time / drift surface (delegates to private NTPTiming) ──────────────
  async initialize() {
    await this.#ntp.initialize();
  }
  resync() {
    this.#ntp.resync();
  }
  startDriftTimer() {
    this.#ntp.startDriftTimer();
  }
  stopDriftTimer() {
    this.#ntp.stopDriftTimer();
  }
  updateDriftOffset() {
    this.#ntp.updateDriftOffset();
  }
  getDriftOffset() {
    return this.#ntp.getDriftOffset();
  }
  getNTPStartTime() {
    return this.#ntp.getNTPStartTime();
  }
  getClockOffset() {
    return this.#ntp.getClockOffset();
  }
  setClockOffset(s) {
    this.#ntp.setClockOffset(s);
  }
  reset() {
    this.#ntp.reset();
  }
  // ── Session mutators ───────────────────────────────────────────────────
  /**
   * Change the tempo without moving the beat that is playing: the grid is
   * re-anchored at `nowNtp` (clock_math.js retempoOrigin), which defaults to
   * the audio thread's now. Before this, setBpm stored the tempo against the
   * old origin and every web tempo change jumped the beat — the same defect
   * the C++ sessions had (test_clock_tempo_change.cpp), on the path a page
   * actually calls.
   *
   * @param {number} bpm
   * @param {number} [atNtpSeconds=0] — honoured by a Link backing
   * @param {number} [nowNtp] — the instant whose beat is held; tests pass one
   */
  setBpm(bpm, atNtpSeconds = 0, nowNtp = this.#nowForRetempo()) {
    bpm = clampBpm(bpm);
    this.#localBeatOriginNtp = retempoOrigin(this.#localBeatOriginNtp, this.#localBpm, bpm, nowNtp);
    this.#localBpm = bpm;
    if (this.#sabViews) {
      retempoClock(this.#sabViews, bpm, nowNtp);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: ClockworkClockMessageType.SET_SESSION_BPM,
        bpm,
        atNtpSeconds,
        nowNtp
      });
    }
  }
  // Audio-thread NTP when there is an AudioContext to read it from, else the
  // wall clock: either way it is "now" in the domain beatAtTime is asked in.
  #nowForRetempo() {
    return this.#audioContext ? this.now() : this.wallNow();
  }
  /**
   * @param {boolean} playing
   * @param {number} [atNtpSeconds=0]
   */
  setIsPlaying(playing, atNtpSeconds = 0) {
    this.#localIsPlaying = !!playing;
    this.#localIsPlayingAtNtp = atNtpSeconds;
    if (this.#sabViews) {
      writeClockTransport(this.#sabViews, playing, atNtpSeconds);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: ClockworkClockMessageType.SET_SESSION_IS_PLAYING,
        isPlaying: this.#localIsPlaying,
        atNtpSeconds
      });
    }
  }
  /**
   * The meter: how quarter-note beats group into bars. 4/4 until set. A
   * meter isValidMeter refuses is ignored and false is returned; the grid
   * is never touched, because bars are counted from beat 0 whatever the
   * meter. Twin of ClockworkClock::setMeter (C++).
   *
   * @param {number} num
   * @param {number} den — 1, 2, 4, 8, 16 or 32
   * @returns {boolean}
   */
  setMeter(num, den) {
    if (!isValidMeter(num, den)) return false;
    this.#localMeter = { num, den };
    if (this.#sabViews) {
      writeClockMeter(this.#sabViews, num, den);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: ClockworkClockMessageType.SET_SESSION_METER,
        num,
        den
      });
    }
    return true;
  }
  /**
   * Link integration (peer discovery, tempo sync, audio sharing) is
   * native-only — the browser AudioWorklet can't host Link's network
   * thread or do UDP multicast. On native, set via OSC:
   * /clockwork/clock/visibility (int 0|1|2). On web this is a no-op.
   *
   * @param {boolean} enabled
   */
  setLinkEnabled(enabled) {
    if (enabled) {
      console.warn(
        "[ClockworkClock] setLinkEnabled(true) ignored on web \u2014 Link is native-only. Use the native build + /clockwork/clock/visibility."
      );
    }
  }
  /**
   * @param {number} beat
   * @param {number} atNtpSeconds
   * @param {number} quantum
   */
  requestBeatAtTime(beat, atNtpSeconds, quantum) {
    const newOrigin = originFor(beat, atNtpSeconds, this.getBpm());
    this.#localBeatOriginNtp = newOrigin;
    if (this.#sabViews) {
      writeClockOrigin(this.#sabViews, newOrigin);
    } else if (this.#workletPort) {
      this.#workletPort.postMessage({
        type: ClockworkClockMessageType.SET_SESSION_BEAT_ORIGIN_NTP,
        beatOriginNtp: newOrigin
      });
    }
  }
  forceBeatAtTime(beat, atNtpSeconds, quantum) {
    this.requestBeatAtTime(beat, atNtpSeconds, quantum);
  }
  // ── Session getters ────────────────────────────────────────────────────
  getBpm() {
    if (this.#sabBigInt) return bitsToDouble(Atomics.load(this.#sabBigInt, SC_BPM_I64));
    return this.#localBpm;
  }
  isPlaying() {
    if (this.#sabInt32) return Atomics.load(this.#sabInt32, SC_IS_PLAYING_I32) !== 0;
    return this.#localIsPlaying;
  }
  getBeatOriginNtp() {
    if (this.#sabBigInt) return bitsToDouble(Atomics.load(this.#sabBigInt, SC_BEAT_ORIGIN_NTP_I64));
    return this.#localBeatOriginNtp;
  }
  getIsPlayingAtNtp() {
    if (this.#sabBigInt) return bitsToDouble(Atomics.load(this.#sabBigInt, SC_IS_PLAYING_AT_NTP_I64));
    return this.#localIsPlayingAtNtp;
  }
  /** @returns {{num: number, den: number}} */
  getMeter() {
    if (this.#sabViews) return readClockMeter(this.#sabViews);
    return { ...this.#localMeter };
  }
  isLinkEnabled() {
    return false;
  }
  numPeers() {
    return 0;
  }
  /**
   * Current NTP time as seen by the audio thread — `AudioContext.currentTime`
   * + the engine's NTP-start anchor + drift + global offset.
   *
   * Use this to schedule events relative to "now in audio time":
   *
   *   sonic.sendOSC(osc.encodeBundle(sonic.clock.now() + 0.05, packets));
   *
   * That bundle fires 50 ms of *audio time* from now. The audio thread is
   * reading the same clock, so the two sides always agree — no skew if
   * AudioContext is throttled, no need to know the NTP-start formula.
   */
  now() {
    if (!this.#audioContext) return 0;
    return this.nowAt(this.#audioContext.currentTime);
  }
  /**
   * Compute audio-thread NTP for a specific `AudioContext.currentTime`.
   * `now()` calls this with the live `currentTime`; advanced callers can
   * pass a specific value (e.g. from `audioContext.getOutputTimestamp()`
   * for tight sample-aligned scheduling).
   */
  nowAt(audioCurrentTime) {
    return audioCurrentTime + this.getNTPStartTime() + this.getDriftOffset() / 1e3 + this.getClockOffset() / 1e3;
  }
  /**
   * Current NTP time as seen by the system wall clock — `performance.now()`
   * + `performance.timeOrigin`, converted to NTP. Independent of the audio
   * clock; useful when matching against external wall-clock events (e.g.
   * network MIDI, NTP sources). For scheduling engine events, prefer
   * {@link now} so the audio thread and the scheduler agree.
   */
  wallNow() {
    return (performance.timeOrigin + performance.now()) / 1e3 + NTP_EPOCH_OFFSET4;
  }
  // ── Beat math ──────────────────────────────────────────────────────────
  // Reads bpm and beat_origin individually — no multi-field coherence
  // guarantee. Today's only callers are app-thread (single-writer JS).
  beatAtTime(ntpSeconds, quantum) {
    return beatAt(ntpSeconds, this.getBeatOriginNtp(), this.getBpm());
  }
  phaseAtTime(ntpSeconds, quantum) {
    return wrapPhase(this.beatAtTime(ntpSeconds, quantum), quantum);
  }
  timeAtBeat(beat, quantum) {
    return timeAtBeat(beat, this.getBeatOriginNtp(), this.getBpm());
  }
};

// clockwork/js/lib/audio_health_monitor.js
var AudioHealthMonitor = class _AudioHealthMonitor {
  #audioContext;
  #prevContextTime = 0;
  #prevPerfTime = 0;
  #healthPct = 100;
  /** Minimum wall-clock delta (ms) before we compute a new reading.
   *  1000ms eliminates render quantum quantization noise (~0.3% error at 48kHz/128)
   *  while still being responsive enough for health monitoring. */
  static #MIN_DELTA_MS = 1e3;
  /**
   * @param {{ audioContext: AudioContext }} options
   */
  constructor({ audioContext }) {
    this.#audioContext = audioContext;
  }
  /**
   * Sample current times and recompute health percentage.
   * Called from #metricsContext() on each metrics read (~10Hz).
   * @returns {number} Health percentage 0-100
   */
  update() {
    if (this.#audioContext.state !== "running") {
      return this.#healthPct;
    }
    const now = performance.now();
    const contextTime = this.#audioContext.currentTime;
    if (this.#prevPerfTime === 0) {
      this.#prevPerfTime = now;
      this.#prevContextTime = contextTime;
      return this.#healthPct;
    }
    const wallDeltaMs = now - this.#prevPerfTime;
    if (wallDeltaMs < _AudioHealthMonitor.#MIN_DELTA_MS) {
      return this.#healthPct;
    }
    const wallDeltaS = wallDeltaMs / 1e3;
    const audioDelta = contextTime - this.#prevContextTime;
    this.#healthPct = Math.min(100, Math.round(audioDelta / wallDeltaS * 100));
    this.#prevPerfTime = now;
    this.#prevContextTime = contextTime;
    return this.#healthPct;
  }
  /**
   * Get current health reading without recomputing.
   * @returns {{ healthPct: number }}
   */
  getHealth() {
    return { healthPct: this.#healthPct };
  }
  /**
   * Clear accumulated state. Call on suspend/resume to avoid
   * stale deltas producing misleading readings.
   */
  reset() {
    this.#prevContextTime = 0;
    this.#prevPerfTime = 0;
    this.#healthPct = 100;
  }
};

// clockwork/js/lib/audio_capture.js
var AudioCapture = class _AudioCapture {
  #sharedBuffer;
  #bufferConstants;
  #ringBufferBase;
  #slot;
  /** The writer's cursor when the capture started, or null when none is running. */
  #startPosition = null;
  /**
   * @param {object} [options]
   * @param {number} [options.slot] 0 for the OUT tap (default), 1 for the IN tap
   */
  constructor(options = {}) {
    this.#sharedBuffer = options.sharedBuffer || null;
    this.#bufferConstants = options.bufferConstants || null;
    this.#ringBufferBase = options.ringBufferBase || 0;
    this.#slot = options.slot ?? 0;
  }
  update(sharedBuffer, ringBufferBase, bufferConstants) {
    this.#sharedBuffer = sharedBuffer;
    this.#ringBufferBase = ringBufferBase;
    this.#bufferConstants = bufferConstants;
  }
  isAvailable() {
    return !!(this.#sharedBuffer && this.#bufferConstants);
  }
  // Header layout (Uint32 indices from the slot start), shm_audio_buffer.
  static #IDX_ENABLED = 0;
  static #IDX_SAMPLE_RATE = 1;
  static #IDX_CHANNELS = 2;
  static #IDX_CAPACITY = 3;
  static #IDX_WPOS_LOW = 4;
  static #IDX_WPOS_HIGH = 5;
  static #HEADER_U32 = 8;
  #slotOffset() {
    const bc = this.#bufferConstants;
    return this.#ringBufferBase + bc.SHM_AUDIO_START + this.#slot * bc.SHM_AUDIO_SLOT_SIZE;
  }
  #header() {
    return new Uint32Array(this.#sharedBuffer, this.#slotOffset(), _AudioCapture.#HEADER_U32);
  }
  #writerPosition(h) {
    const high = Atomics.load(h, _AudioCapture.#IDX_WPOS_HIGH);
    const low = Atomics.load(h, _AudioCapture.#IDX_WPOS_LOW);
    return high * 4294967296 + low;
  }
  /** Whether the tap is live: the device has this direction. */
  isLive() {
    if (!this.isAvailable()) return false;
    return Atomics.load(this.#header(), _AudioCapture.#IDX_ENABLED) === 1;
  }
  /** Begin: everything the tap writes from now on is the capture. */
  start() {
    if (!this.isAvailable()) throw new Error("AudioCapture not initialized");
    this.#startPosition = this.#writerPosition(this.#header());
  }
  /** End the capture and return it. */
  stop() {
    const out = this.read();
    this.#startPosition = null;
    return out;
  }
  /**
   * The frames written since start() — or, with no capture running, the
   * newest ring's worth. Deinterleaved into per-channel arrays; `lost` is
   * how many frames the ring overwrote before they were read.
   */
  read() {
    if (!this.isAvailable()) throw new Error("AudioCapture not initialized");
    const bc = this.#bufferConstants;
    const h = this.#header();
    const sampleRate = h[_AudioCapture.#IDX_SAMPLE_RATE];
    const channels = h[_AudioCapture.#IDX_CHANNELS];
    const capacity = h[_AudioCapture.#IDX_CAPACITY];
    const writer = this.#writerPosition(h);
    const from = this.#startPosition ?? Math.max(0, writer - capacity);
    let lost = 0;
    let start = from;
    if (writer - start > capacity) {
      lost = writer - start - capacity;
      start = writer - capacity;
    }
    const frames = Math.max(0, writer - start);
    const data = new Float32Array(
      this.#sharedBuffer,
      this.#slotOffset() + bc.SHM_AUDIO_HEADER_SIZE,
      capacity * channels
    );
    const out = Array.from({ length: channels }, () => new Float32Array(frames));
    let at = start % capacity;
    for (let f = 0; f < frames; f++) {
      for (let c = 0; c < channels; c++) out[c][f] = data[at * channels + c];
      at = (at + 1) % capacity;
    }
    return {
      sampleRate,
      channels,
      frames,
      lost,
      channelData: out,
      // The names a stereo reader has always used.
      left: out[0] ?? new Float32Array(0),
      right: out[1] ?? null
    };
  }
  /** Whether a capture is running. */
  isEnabled() {
    return this.#startPosition !== null;
  }
  /** Frames captured so far, or written in all when no capture is running. */
  getFrameCount() {
    if (!this.isAvailable()) return 0;
    const writer = this.#writerPosition(this.#header());
    return this.#startPosition === null ? writer : writer - this.#startPosition;
  }
  /** The longest capture the ring holds, in seconds. */
  getMaxDuration() {
    if (!this.#bufferConstants) return 0;
    const bc = this.#bufferConstants;
    return bc.SHM_AUDIO_FRAMES / (bc.SHM_AUDIO_SAMPLE_RATE || 48e3);
  }
};

// clockwork/js/memory_layout.js
var MemoryLayout = {
  /**
   * WASM heap size in bytes
   * Space for emscripten malloc, static data, and stack.
   * Reduced from implicit 16MB since the guest's region became a region of
   * its own, then given back the 3MB reserved next door but never used.
   * Holds the static ring-buffer array (6.72MB measured) plus malloc and
   * the stack, so treat the difference as the real malloc budget and
   * re-measure with `sonic.bufferConstants` after changing any region size.
   * Only the sum of this, ringBufferReserved and memArenaSize matters; see
   * the header.
   * Current: 24MB
   */
  wasmHeapSize: 24 * 1024 * 1024,
  // 24MB — see the measurement below
  /*
   * WHY 24MB, MEASURED 2026-08-31.
   *
   * This said 12MB, and that raising it to 20MB "made things worse" and
   * must not be repeated. The reasoning in that note was right about the
   * pressure and wrong about the cause, so it is replaced rather than kept:
   * raising the floor was never the problem, and the arithmetic here has
   * never actually fit.
   *
   * What this space must hold, measured on the web build:
   *
   *     static data (incl. the 6.474MB of rings)    6.72 MB
   *     wasm stack (--stack-first)                  1.00 MB
   *     clockwork_heap's backing block (CLOCKWORK_HEAP_SIZE)    8.00 MB
   *     everything else emscripten mallocs          ?
   *                                                --------
   *                                                15.7 MB +
   *
   * against a floor of 12MB + 2MB. It does not fit and never did. clockwork_heap
   * is claimed with malloc, so it simply ran past the line: measured, its
   * backing ended at 0x01113F48 (17.08 MB) while the guest's region began
   * at 0x00E00000 (14.00 MB). Clockwork's heap and the guest's memory
   * overlapped by 3.08 MB on EVERY boot, and nothing anywhere said so.
   *
   * That is what the tests of the time were reacting to. They did not break
   * because the gap grew; they broke because moving the gap moved which
   * bytes two allocators shared, and any change to this number reshuffled a
   * corruption that was always present.
   *
   * So the floor is now big enough to hold what is measured above, and
   * the boot REFUSES TO RUN if the heap's end reaches the guest region
   * (see clockwork_heap_backing_end). If that ever fires, raise this number —
   * do not go looking for which test is flaky.
   */
  /**
   * Ring buffer reserved space (between the WASM heap and the guest's
   * region).
   *
   * DO NOT LIST THE FIGURES HERE OR RE-DERIVE THE TOTAL BY HAND — a written
   * total drifts from the build it describes, and SHM_SCOPE, the largest
   * region of the lot, is the one most easily forgotten. The regions are
   * laid out by
   * src/shared_memory.h from the build's own -D flags, and the module
   * exports every start and size at runtime. Read them from a booted engine
   * (`sonic.bufferConstants`) and measure.
   *
   * Measured on the web build, 2026-08-22: the regions span 6.474MB from
   * `ringBufferBase`, of which SHM_SCOPE is 4.097MB, SHM_AUDIO 1.500MB and
   * the OSC rings 1.125MB (IN 1MB + OUT 128KB). They sit inside the WASM
   * heap below, not in the reservation named here.
   */
  /**
   * Clockwork's placement arena, in bytes — what clockwork::mem allocates from
   * on this target.
   *
   * A THIRD NAME FOR PART OF THE SAME GAP below guestMemoryOffset, like
   * wasmHeapSize and ringBufferReserved: the module claims it with one
   * malloc at init_memory and hands it to clockwork::mem::set_arena, so it has to
   * be budgeted here or that malloc pushes the break upward into the guest.
   *
   * 32MB because that is exactly what the guest region used to lend back for
   * this. Until 2026-09-01 the client carved an RT arena (RT_ARENA_MIN, 32MB)
   * out of the FRONT of its own region and passed the offset to the engine
   * through a config-block slot; guestMemorySize was 36MB for that reason,
   * "32MB RT pool + 4MB buffers". The 32MB moved here and the guest region
   * kept the 4MB it was actually using, so the total is unchanged and the
   * engine's pool now comes from the same clockwork::mem every other target uses.
   *
   * It bounds the engine: a real-time pool larger than this fails at boot
   * with both numbers in the message, rather than being served from memory
   * clockwork does not own.
   */
  memArenaSize: 32 * 1024 * 1024,
  // 32MB
  ringBufferReserved: 2 * 1024 * 1024,
  // 2MB — see the header: the rings do
  // not live here, and this only sets
  // where the guest's region starts
  /**
   * Guest memory, committed at boot, in bytes.
   *
   * One opaque region handed to the guest, which subdivides it however its
   * own design requires. This replaced `rtPoolSize` (32MB, sized from a
   * real-time-memory field in one engine's own config) and `bufferPoolSize`
   * (4MB, audio samples) on 2026-08-31; the default is their sum, so a
   * guest that splits it the old way gets exactly what it had before.
   *
   * Override at runtime: memory: { guestMemorySize: N }
   */
  guestMemorySize: 4 * 1024 * 1024,
  // 4MB — fixed at boot; see memArenaSize
  /**
   * Bulk staging, committed at boot. ONE WRITER EACH: the client writes the
   * inbox and the guest only reads it; the guest writes the outbox and the
   * client only reads it. Neither is the guest's arena, and nothing is
   * written from both ends — which is what removes the need for the two
   * sides to agree at runtime about which bytes belong to whom.
   *
   * The INBOX sits at the top of the memory and is the only region that
   * grows, because bulk arriving from the client is the only thing whose
   * size a session discovers as it runs. See inboxOffset.
   *
   * Override at runtime: memory: { inboxSize: N, outboxSize: N }
   */
  inboxSize: 4 * 1024 * 1024,
  // client -> guest, grows to maxInboxSize
  outboxSize: 4 * 1024 * 1024,
  // guest -> client, fixed
  /**
   * Maximum inbox size in bytes — the hard ceiling for growth.
   *
   * WASM address space is RESERVED up to inboxOffset +
   * maxInboxSize at construction and can never be raised afterwards;
   * only the committed size grows into it. That is why this is a build-time
   * cap rather than something a caller can lift at runtime.
   *
   * Measured 2026-08-31: growth works because the memory is created with
   * `shared: true`. A non-shared WebAssembly.Memory DETACHES its old
   * ArrayBuffer on grow() and every view over it throws; a shared one does
   * not, and pre-existing views keep reading. The growable allocator relies
   * on this, because it appends a new pool per growth and keeps the earlier
   * pools' buffer references alive.
   */
  maxInboxSize: 768 * 1024 * 1024,
  // 768MB — bulk in; see memArenaSize
  /**
   * Guest memory byte offset from the start of the SharedArrayBuffer.
   *
   * Everything below this is the module's own: emscripten's static data,
   * malloc and stack, clockwork's ring buffers (a static array inside that
   * same heap) and the placement arena. Everything at or above it is the
   * guest's and clockwork never interprets it.
   */
  get outboxOffset() {
    return this.wasmHeapSize + this.ringBufferReserved + this.memArenaSize;
  },
  get guestMemoryOffset() {
    return this.outboxOffset + this.outboxSize;
  },
  /**
   * THE INBOX IS LAST, because it is the one region that grows.
   *
   * Only the region at the top of the memory can grow in place — everything
   * above it would have to move, and a published range that moved would be a
   * pointer the guest already holds pointing at something else. The thing
   * that grows is bulk arriving from the client: samples, wavetables,
   * impulse responses, however many of them a session turns out to load. The
   * guest's arena is sized once at boot, as an arena is.
   */
  get inboxOffset() {
    return this.guestMemoryOffset + this.guestMemorySize;
  },
  /**
   * Total committed memory (derived)
   * inboxOffset + inboxSize
   */
  get totalMemory() {
    return this.inboxOffset + this.inboxSize;
  },
  /**
   * Maximum total WASM memory (derived, used by build.sh for -sMAXIMUM_MEMORY).
   * Computed as: inboxOffset + maxInboxSize.
   *
   * This is the RESERVATION. It fixes the address space at construction and
   * cannot be raised later, so it is the one number a build must get right
   * up front; everything else is committed on demand beneath it.
   */
  get maxTotalMemory() {
    return this.inboxOffset + Math.max(this.maxInboxSize, this.inboxSize);
  },
  /**
   * Total WebAssembly memory in pages (derived, 1 page = 64KB)
   * Used by build.sh to set -sINITIAL_MEMORY.
   */
  get totalPages() {
    return Math.ceil(this.totalMemory / 65536);
  }
};

// clockwork/js/clockwork.js
var SYNC_TIMEOUT_MS = 1e4;
var WORKLET_INIT_TIMEOUT_MS = 5e3;
var PURGE_ACK_TIMEOUT_MS = 1e3;
var SNAPSHOT_INTERVAL_MS = 150;
var HEX = [];
for (let i = 0; i < 256; i++) HEX[i] = i.toString(16).padStart(2, "0");
function formatUUID(bytes) {
  return HEX[bytes[0]] + HEX[bytes[1]] + HEX[bytes[2]] + HEX[bytes[3]] + "-" + HEX[bytes[4]] + HEX[bytes[5]] + "-" + HEX[bytes[6]] + HEX[bytes[7]] + "-" + HEX[bytes[8]] + HEX[bytes[9]] + "-" + HEX[bytes[10]] + HEX[bytes[11]] + HEX[bytes[12]] + HEX[bytes[13]] + HEX[bytes[14]] + HEX[bytes[15]];
}
function formatUUIDShort(bytes) {
  return "\u2026" + HEX[bytes[13]] + HEX[bytes[14]] + HEX[bytes[15]];
}
function formatOscArg(a, maxLen) {
  if (a && a.type === "uuid" && a.value) return formatUUIDShort(a.value);
  if (a instanceof Uint8Array || a instanceof ArrayBuffer) return `<${a.byteLength || a.length} bytes>`;
  const str = JSON.stringify(a);
  return maxLen && str.length > maxLen ? str.slice(0, maxLen) + "..." : str;
}
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function formatOscArgHtml(arg, address, argIndex) {
  if (arg && arg.type === "uuid" && arg.value) {
    return `<span class="clockwork-osc-string" title="${formatUUID(arg.value)}">${formatUUIDShort(arg.value)}</span>`;
  }
  let value = arg, type = null;
  if (typeof arg === "object" && arg !== null && arg.value !== void 0) {
    value = arg.value;
    type = arg.type;
  }
  if (type === "b" || value instanceof Uint8Array || value instanceof ArrayBuffer) {
    const len = value.byteLength ?? value.length ?? "?";
    return `<span class="clockwork-osc-binary">&lt;${len} bytes&gt;</span>`;
  }
  const isFloat = type === "f" || type === null && typeof value === "number" && !Number.isInteger(value);
  const isInt = type === "i" || type === null && Number.isInteger(value);
  if (isFloat) return `<span class="clockwork-osc-float">${parseFloat(value.toFixed(3))}</span>`;
  if (isInt) return `<span class="clockwork-osc-int">${value}</span>`;
  if (typeof value === "string") return `<span class="clockwork-osc-string">${escapeHtml(JSON.stringify(value))}</span>`;
  return `<span class="clockwork-osc-string">${escapeHtml(value)}</span>`;
}
function formatOscLineHtml(msg, sequence, timestamp, initTime, sourceId) {
  const address = msg[0];
  const args = msg.slice(1);
  const relTime = initTime && timestamp ? (timestamp - initTime).toFixed(2) : "";
  let html = `<span class="clockwork-osc-seq">[${sequence}]</span>`;
  if (relTime) html += ` <span class="clockwork-osc-time">${relTime}</span>`;
  if (sourceId !== void 0) html += ` <span class="clockwork-osc-source">ch${sourceId}</span>`;
  html += ` <span class="clockwork-osc-address">${escapeHtml(address)}</span>`;
  if (args.length > 0) {
    const argsHtml = args.map((a, i) => formatOscArgHtml(a, address, i)).join(", ");
    html += " " + argsHtml;
  }
  return html;
}
function formatBundleHtml(decoded, sequence, timestamp, initTime, sourceId) {
  if (!decoded.packets) return formatOscLineHtml(decoded, sequence, timestamp, initTime, sourceId);
  if (decoded.packets.length === 1) return formatOscLineHtml(decoded.packets[0], sequence, timestamp, initTime, sourceId);
  const relTime = initTime && timestamp ? (timestamp - initTime).toFixed(2) : "";
  let html = `<span class="clockwork-osc-seq">[${sequence}]</span>`;
  if (relTime) html += ` <span class="clockwork-osc-time">${relTime}</span>`;
  if (sourceId !== void 0) html += ` <span class="clockwork-osc-source">ch${sourceId}</span>`;
  html += ` <span class="clockwork-osc-bundle">Bundle (${decoded.packets.length})</span>`;
  for (const pkt of decoded.packets) {
    const addr = pkt[0];
    const pktArgs = pkt.slice(1);
    html += `<br><span class="clockwork-osc-address">${escapeHtml(addr)}</span>`;
    if (pktArgs.length > 0) {
      html += " " + pktArgs.map((a, i) => formatOscArgHtml(a, addr, i)).join(", ");
    }
  }
  return html;
}
var Clockwork = class _Clockwork {
  // Expose OSC utilities as static methods (uses plain args, not typed {type, value} format)
  static osc = {
    encodeMessage: (address, args) => copyEncoded(encodeMessage(address, args)),
    encodeBundle: (timeTag, packets) => copyEncoded(encodeBundle(timeTag, packets)),
    decode: (data) => decodePacket(data),
    encodeSingleBundle: (timeTag, address, args) => copyEncoded(encodeSingleBundle(timeTag, address, args)),
    readTimetag: (bundleData) => readTimetag(bundleData),
    ntpNow: () => getCurrentNTPFromPerformance(),
    NTP_EPOCH_OFFSET: NTP_EPOCH_OFFSET2
  };
  /**
   * Schema describing every available metric — each key maps to
   * { offset, type, unit, description } for the merged Uint32Array — plus a
   * `layout` panel structure for rendering a metrics UI.
   */
  static getMetricsSchema() {
    return METRICS_SCHEMA;
  }
  /**
   * Schema describing the node tree structure.
   */
  #audioContext;
  #workletNode;
  #node = null;
  #osc;
  #wasmMemory;
  #syncListeners;
  #fetchRetryConfig;
  #assetLoader;
  #guestWriteSeq = 0;
  #guestReadSeq = 0;
  #guestGrowSeq = 0;
  #exportCallSeq = 0;
  #initialized;
  #initializing;
  #initPromise;
  #capabilities;
  #version;
  #dsp = NO_DSP;
  #config;
  #eventEmitter;
  #metricsReader;
  #clock;
  #audioCapture;
  #audioHealthMonitor;
  #oscChannel;
  // The host's front (js/lib/host_front.js): the far end of clockwork's
  // chain on the web. Every /clockwork/ verb the worklet's audio thread does
  // not answer itself comes back here to be answered — MIDI and gamepad,
  // when enabled — or refused by name.
  #front = null;
  // Node ID counter for PM mode (SAB mode uses shared memory).
  // Starts at 1000: 0 is the root group and
  // 1–999 are left free for the client to assign by hand.
  #nodeIdCounter = 1e3;
  #previousAudioContextState = null;
  #cachedWasmBytes = null;
  #snapshotsSent = 0;
  #earlyDebugMessages = [];
  #debugRawHandler = null;
  // Cached TypedArray views for scope slots (lazily initialized, avoids per-frame allocations)
  #scopeViews = null;
  /* Guest options are the product's to validate — clockwork enforces its own
   * rules (128-frame blocks and the rest) through its own `audio` options.
   */
  /*
   * Build the memory config.
   *
   * CLOCKWORK NEVER LOOKS INSIDE GUEST CONFIG to size anything. A guest that
   * wants more memory says so the way any caller does, through
   * `memory: { guestMemorySize }`.
   */
  #buildMemoryConfig(overrides) {
    const mem = overrides ? { ...MemoryLayout, ...overrides } : { ...MemoryLayout };
    mem.outboxOffset = (mem.wasmHeapSize ?? MemoryLayout.wasmHeapSize) + (mem.ringBufferReserved ?? MemoryLayout.ringBufferReserved) + (mem.memArenaSize ?? MemoryLayout.memArenaSize);
    mem.guestMemoryOffset = mem.outboxOffset + (mem.outboxSize ?? MemoryLayout.outboxSize);
    mem.inboxOffset = mem.guestMemoryOffset + (mem.guestMemorySize ?? MemoryLayout.guestMemorySize);
    mem.totalMemory = mem.inboxOffset + mem.inboxSize;
    mem.maxTotalMemory = mem.inboxOffset + Math.max(
      mem.maxInboxSize,
      mem.inboxSize
    );
    return mem;
  }
  constructor(options = {}) {
    this.#initialized = false;
    this.#initializing = false;
    this.#initPromise = null;
    this.#capabilities = {};
    this.#version = null;
    this.#eventEmitter = new EventEmitter();
    this.#audioCapture = new AudioCapture({});
    this.#audioContext = null;
    this.#workletNode = null;
    this.#osc = null;
    const baseURL = options.baseURL || null;
    const coreBaseURL = options.coreBaseURL || baseURL;
    const workerBaseURL = options.workerBaseURL || (baseURL ? `${baseURL}workers/` : null);
    const wasmBaseURL = options.wasmBaseURL || (coreBaseURL ? `${coreBaseURL}wasm/` : null);
    if (!workerBaseURL || !wasmBaseURL) {
      throw new Error(
        `Clockwork requires explicit URL configuration.

For CDN usage:
  import { Clockwork } from 'https://unpkg.com/clockwork@VERSION/dist/clockwork.js';
  new Clockwork({
    baseURL: 'https://unpkg.com/clockwork@VERSION/dist/',
  })

For local usage:
  new Clockwork({ baseURL: '/path/to/clockwork/dist/' })

See: docs/ in the clockwork repository`
      );
    }
    const guestOptions = { ...options.guestOptions };
    const mode = options.mode || "postMessage";
    this.#dsp = dspProfile(options.dsp);
    this.#metricsReader = new MetricsReader({
      mode: options.mode || "postMessage",
      guestMetrics: this.#dsp?.metrics || {}
    });
    this.#config = {
      mode,
      snapshotIntervalMs: options.snapshotIntervalMs ?? SNAPSHOT_INTERVAL_MS,
      wasmBytes: options.wasmBytes ?? null,
      wasmUrl: options.wasmUrl || wasmBaseURL + "clockwork-engine.wasm",
      wasmBaseURL,
      workletUrl: options.workletUrl || (coreBaseURL ? `${coreBaseURL}workers/clockwork_audio_worklet.js` : workerBaseURL + "clockwork_audio_worklet.js"),
      workerBaseURL,
      audioContext: options.audioContext || null,
      autoConnect: options.autoConnect !== false,
      audioContextOptions: {
        latencyHint: "interactive",
        sampleRate: 48e3,
        ...options.audioContextOptions
      },
      memory: this.#buildMemoryConfig(options.memory),
      guestOptions,
      audio: {
        outputChannels: options.audio?.outputChannels ?? 2,
        inputChannels: options.audio?.inputChannels ?? 0
      },
      bypassLookaheadMs: options.bypassLookaheadMs ?? 500,
      activityEvent: {
        maxLineLength: options.activityEvent?.maxLineLength ?? 200,
        engineMaxLineLength: options.activityEvent?.engineMaxLineLength ?? null,
        oscInMaxLineLength: options.activityEvent?.oscInMaxLineLength ?? null,
        oscOutMaxLineLength: options.activityEvent?.oscOutMaxLineLength ?? null
      },
      debug: options.debug ?? false,
      // The main-thread subsystems (js/lib/host_front.js). Off by default:
      // Web MIDI asks the user's permission, and a page that never sends a
      // /clockwork/midi/ verb should not. `true`, or an object of manager
      // options (a test injects its fake device access there).
      midi: options.midi ?? false,
      gamepad: options.gamepad ?? false,
      debugEngine: options.debugEngine ?? false,
      debugOscIn: options.debugOscIn ?? false,
      debugOscOut: options.debugOscOut ?? false,
      bufferGrowIncrement: options.bufferGrowIncrement ?? 32 * 1024 * 1024
    };
    this.#config.effectiveMaxInbox = options.maxInbox || this.#config.memory.maxInboxSize || this.#config.memory.inboxSize;
    this.#fetchRetryConfig = {
      maxRetries: options.fetchMaxRetries ?? 3,
      baseDelay: options.fetchRetryDelay ?? 1e3
    };
    this.#assetLoader = new AssetLoader({
      onLoadingEvent: (event, data) => this.#eventEmitter.emit(event, data),
      maxRetries: this.#fetchRetryConfig.maxRetries,
      baseDelay: this.#fetchRetryConfig.baseDelay,
      skipHeadRequests: options.skipHeadRequests ?? false
    });
    this.bootStats = {
      initStartTime: null,
      initDuration: null
    };
  }
  // ============================================================================
  // PUBLIC GETTERS
  // ============================================================================
  get initialized() {
    return this.#initialized;
  }
  get initializing() {
    return this.#initializing;
  }
  // Mirrors C++ ClockworkEngine::isRunning(). Same value as the
  // `initialized` getter, exposed as a method to match the C++ API shape.
  isRunning() {
    return this.#initialized;
  }
  // Mirrors C++ ClockworkEngine::engineState(). Returns 'stopped',
  // 'booting', or 'running'. The C++ enum also has 'restarting' and 'error'
  // values that JS does not currently distinguish — calls to recover/resume
  // do not surface a separate 'restarting' state from JS.
  getEngineState() {
    if (this.#initializing) return "booting";
    if (this.#initialized) return "running";
    return "stopped";
  }
  get audioContext() {
    return this.#audioContext;
  }
  // ClockworkClock — engine-wide session-state + time authority.
  // Available after init() resolves. Read-only reference.
  get clock() {
    return this.#clock;
  }
  get mode() {
    return this.#config.mode;
  }
  get bufferConstants() {
    return this.#metricsReader.bufferConstants;
  }
  get ringBufferBase() {
    return this.#metricsReader.ringBufferBase;
  }
  get sharedBuffer() {
    return this.#metricsReader.sharedBuffer;
  }
  /*
   * The guest's memory object, for a client that maps its own region.
   *
   * `sharedBuffer` is not a substitute: growth leaves earlier ArrayBuffer
   * references valid but still sized to the OLD length, so a client holding
   * one cannot see memory it has just grown into. The Memory object always
   * yields the current buffer. Null in postMessage mode, where the client
   * has no heap of its own and must go through writeInbox.
   */
  get wasmMemory() {
    return this.#wasmMemory;
  }
  /*
   * Fetching, with the retry and progress policy clockwork already applies
   * to its own artifacts. A client fetching a definition or sample material
   * wants exactly that behaviour and should not build a second one beside it.
   */
  get assetLoader() {
    return this.#assetLoader;
  }
  get node() {
    return this.#node;
  }
  get osc() {
    return this.#osc;
  }
  /*
   * The main-thread subsystems, when enabled (`midi: true`, `gamepad: true`):
   * the MidiManager and GamepadManager the front answers /clockwork/midi/ and
   * /clockwork/gamepad/ with. Null when not enabled, and before init. A
   * client that wants the structured fast path (onMessage) rather than OSC
   * bytes reaches them here.
   */
  get midi() {
    return this.#front?.midi ?? null;
  }
  get gamepad() {
    return this.#front?.gamepad ?? null;
  }
  /**
   * NTP time (seconds since 1900) when the AudioContext started.
   *
   * @deprecated Use `sonic.clock.getNTPStartTime()` for the same value, or
   *   `sonic.clock.now()` to get the current audio-thread NTP. This getter
   *   stays for backward compatibility with older callers that did
   *   `event.timestamp - sonic.initTime`.
   */
  get initTime() {
    return this.#clock?.getNTPStartTime() ?? 0;
  }
  // ============================================================================
  // EVENT EMITTER DELEGATION
  // ============================================================================
  /*
   * Raise an event on clockwork's own emitter.
   *
   * For a product built on clockwork: its events should reach listeners
   * through the same `on()` its clients already use, rather than a second
   * emitter beside it that callers have to know about separately.
   */
  emit(event, payload) {
    return this.#eventEmitter.emit(event, payload);
  }
  on(event, callback) {
    return this.#eventEmitter.on(event, callback);
  }
  off(event, callback) {
    this.#eventEmitter.off(event, callback);
    return this;
  }
  once(event, callback) {
    return this.#eventEmitter.once(event, callback);
  }
  removeAllListeners(event) {
    this.#eventEmitter.removeAllListeners(event);
    return this;
  }
  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  async init() {
    if (this.#initialized) return;
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = this.#doInit();
    return this.#initPromise;
  }
  async #doInit() {
    this.#initializing = true;
    this.bootStats.initStartTime = performance.now();
    try {
      this.#setAndValidateCapabilities();
      this.#initializeMemory();
      this.#initializeAudioContext();
      const wasmBytes = await this.#loadWasm();
      await this.#initializeAudioWorklet(wasmBytes);
      await this.#initializeOSC();
      await this.#initializeFront();
      await this.#finishInitialization();
    } catch (error) {
      this.#initializing = false;
      this.#initPromise = null;
      console.error("[Clockwork] Initialization failed:", error);
      this.#eventEmitter.emit("error", error);
      throw error;
    }
  }
  // ============================================================================
  // METRICS API
  // ============================================================================
  getMetrics() {
    return this.#gatherMetrics();
  }
  /**
   * Get metrics as a flat Uint32Array for zero-allocation reading.
   * Returns the same array reference every call — values are updated in-place.
   * Slots 0-49: SAB/snapshot metrics (slot 50 is the C++ struct's alignment
   * padding, reused by the first context metric), 50-68: main-thread context
   * metrics, 69+: metrics the guest declared in its DSP profile.
   * Use getMetricsSchema().metrics for offset mappings.
   * @returns {Uint32Array}
   */
  getMetricsArray() {
    this.#updateMergedArray();
    return this.#metricsReader.getMergedArray();
  }
  /**
   * Get a diagnostic snapshot containing metrics and memory info.
   * Useful for debugging timing issues, capturing state for bug reports, etc.
   * @returns {Object} Snapshot with timestamp, metrics (with descriptions) and memory info
   */
  getSnapshot() {
    const rawMetrics = this.#gatherMetrics();
    const schemaMetrics = _Clockwork.getMetricsSchema()?.metrics || {};
    const metricsWithDescriptions = {};
    for (const [key, value] of Object.entries(rawMetrics)) {
      const def = schemaMetrics[key];
      if (def?.description) {
        metricsWithDescriptions[key] = {
          value,
          description: def.description
        };
      } else {
        metricsWithDescriptions[key] = { value };
      }
    }
    let memory = null;
    if (typeof performance !== "undefined" && performance.memory) {
      memory = {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
      };
    }
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      metrics: metricsWithDescriptions,
      memory
    };
  }
  /**
   * Get a comprehensive system performance report.
   *
   * Includes hardware info, audio configuration, Chrome playbackStats (if available),
   * a cross-browser audio health percentage, and a human-readable health assessment.
   * Useful for diagnosing audio crackling on constrained hardware.
   * @returns {Object} SystemReport
   */
  getSystemReport() {
    this.#ensureInitialized("get system report");
    const metrics = this.#gatherMetrics();
    const issues = [];
    const system = {
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency ?? null,
      deviceMemory: navigator.deviceMemory ?? null,
      platform: navigator.platform
    };
    const audio = {
      sampleRate: this.#audioContext.sampleRate,
      baseLatency: this.#audioContext.baseLatency ?? null,
      outputLatency: this.#audioContext.outputLatency ?? null,
      state: this.#audioContext.state,
      channelCount: this.#config.audio.outputChannels
    };
    const pbStats = this.#capabilities.playbackStats ? this.#audioContext.playbackStats : null;
    const playbackStats = pbStats ? {
      glitchCount: pbStats.fallbackFramesEvents,
      glitchDurationS: pbStats.fallbackFramesDuration,
      totalDurationS: pbStats.totalFramesDuration,
      averageLatencyS: pbStats.averageLatency,
      maximumLatencyS: pbStats.maximumLatency
    } : null;
    const healthPct = this.#audioHealthMonitor?.getHealth()?.healthPct ?? 100;
    if (healthPct < 95) {
      issues.push({
        severity: healthPct < 80 ? "critical" : "warning",
        message: `Audio health at ${healthPct}% \u2014 audio thread may be falling behind`
      });
    }
    if (metrics.engineSchedulerLates > 0) {
      issues.push({
        severity: "warning",
        message: `${metrics.engineSchedulerLates} late bundles in engine scheduler`
      });
    }
    if (metrics.engineWasmErrors > 0) {
      issues.push({
        severity: "error",
        message: `${metrics.engineWasmErrors} WASM errors detected`
      });
    }
    if (pbStats?.fallbackFramesEvents > 0) {
      issues.push({
        severity: "warning",
        message: `${pbStats.fallbackFramesEvents} audio glitch events (${(pbStats.fallbackFramesDuration * 1e3).toFixed(1)}ms total silence)`
      });
    }
    if (metrics.driftOffsetMs !== void 0 && Math.abs(metrics.driftOffsetMs) > 10) {
      issues.push({
        severity: "warning",
        message: `Clock drift: ${metrics.driftOffsetMs}ms between AudioContext and wall clock`
      });
    }
    const summary = issues.length === 0 ? `Audio health: ${healthPct}% \u2014 no issues detected` : `Audio health: ${healthPct}% \u2014 ${issues.length} issue(s): ${issues.map((i) => i.message).join("; ")}`;
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      system,
      audio,
      playbackStats,
      engine: {
        mode: this.mode,
        version: this.#version,
        bootTimeMs: this.bootStats.initDuration
      },
      health: {
        audioHealthPct: healthPct,
        issues,
        summary
      },
      metrics
    };
  }
  // ============================================================================
  // TIMING API
  // ============================================================================
  /**
   * Set clock offset for multi-system sync (e.g., Ableton Link, NTP server).
   * This shifts all scheduled bundle execution times by the specified offset.
   * Positive values mean the shared/server clock is ahead of local time —
   * bundles with shared-clock timetags are shifted earlier to compensate.
   * @param {number} offsetS - Offset in seconds
   */
  setClockOffset(offsetS) {
    this.#ensureInitialized("set clock offset");
    this.#clock?.setClockOffset(offsetS);
  }
  // ============================================================================
  // RECOVERY API
  // ============================================================================
  /**
   * Smart recovery - tries quick resume first, falls back to full reload.
   * Use this when you don't know if a quick resume will work.
   * @returns {Promise<boolean>} true if audio is running after recovery
   */
  async recover() {
    if (!this.#initialized) return false;
    if (true) console.log("[Dbg-Clockwork] Attempting recovery...");
    if (await this.resume()) {
      if (true) console.log("[Dbg-Clockwork] Quick resume succeeded");
      return true;
    }
    if (true) console.log("[Dbg-Clockwork] Resume failed, doing full reload");
    return await this.reload();
  }
  /**
   * Quick resume - just resumes AudioContext and resyncs timing.
   * Memory and node tree are preserved. Does NOT emit 'setup' event.
   * Use when you know the worklet is still running (e.g., tab was just backgrounded briefly).
   * @returns {Promise<boolean>} true if worklet is running after resume
   */
  async resume() {
    if (!this.#initialized || !this.#audioContext) return false;
    await this.purge();
    try {
      await this.#audioContext.resume();
    } catch (e) {
    }
    this.#clock?.startDriftTimer();
    const count1 = this.#readProcessCount();
    if (count1 === null) {
      const isRunning2 = this.#audioContext.state === "running";
      if (isRunning2) {
        this.#clock?.resync();
        this.#eventEmitter.emit("resumed");
      }
      return isRunning2;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    const count2 = this.#readProcessCount();
    const isRunning = count2 !== null && count2 > count1;
    if (isRunning) {
      this.#clock?.resync();
      this.#eventEmitter.emit("resumed");
    }
    return isRunning;
  }
  /**
   * Suspend the AudioContext and stop the drift timer.
   * The worklet remains loaded but processing stops.
   * The audiocontext statechange listener handles emitting events.
   */
  async suspend() {
    if (!this.#initialized) return;
    this.#clock?.stopDriftTimer();
    try {
      await this.#audioContext?.suspend();
    } catch (e) {
    }
  }
  /**
   * Full reload - destroys and recreates worklet/WASM, then calls
   * restoreClientState() to put back whatever the product was holding.
   * Emits 'setup' event so you can rebuild groups, FX chains, bus routing.
   * Use when the worklet was killed (e.g., long background, browser reclaimed memory).
   * @returns {Promise<boolean>} true if reload succeeded
   */
  async reload() {
    if (!this.#initialized) return false;
    this.#eventEmitter.emit("reload:start");
    await this.#partialShutdown();
    await this.#partialInit();
    try {
      await this.restoreClientState();
    } catch (e) {
      console.error("[Clockwork] client state did not survive the reload:", e);
    }
    await this.#syncWithRetry();
    this.#eventEmitter.emit("reload:complete", { success: true });
    return true;
  }
  async #syncWithRetry(attempts = 6, timeoutMs = 1500) {
    let lastErr = null;
    for (let i = 0; i < attempts; i++) {
      try {
        await this.sync(void 0, timeoutMs);
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error("sync failed after reload");
  }
  /**
   * Zero the ring control words in a reused SAB, in the one window where it
   * is safe: after partialShutdown (workers terminated, worklet gone) and
   * before anything new attaches.
   *
   * A first boot gets this free (a fresh SAB is zeros); reload keeps the SAB,
   * so the old session's cursors survive. The engine's own epoch reset runs on
   * the audio thread's first process(), but the new OSC workers attach before
   * that — they would drink the stale ring and starve at a read index the
   * reborn writer won't reach for several messages.
   */
  #resetRingEpoch() {
    if (this.#config.mode !== "sab" || !this.#wasmMemory) return;
    const bc = this.#metricsReader?.bufferConstants;
    const ringBufferBase = this.#metricsReader?.ringBufferBase;
    if (!bc || ringBufferBase == null || bc.CONTROL_START == null) return;
    const view = new Int32Array(this.#wasmMemory.buffer, ringBufferBase + bc.CONTROL_START, 12);
    for (const idx of [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11]) {
      Atomics.store(view, idx, 0);
    }
  }
  async #awaitEngineProcessing(timeoutMs = 5e3) {
    const view = this.#metricsReader?.getMetricsView?.() ?? null;
    const readCount = () => {
      if (view) return Atomics.load(view, ENGINE_PROCESS_COUNT);
      const snap = this.#metricsReader?.getSnapshotBuffer?.();
      return snap ? new Uint32Array(snap, 0, ENGINE_PROCESS_COUNT + 1)[ENGINE_PROCESS_COUNT] : null;
    };
    const t0 = performance.now();
    let last = null;
    let rises = 0;
    while (performance.now() - t0 < timeoutMs) {
      const n = readCount();
      if (n != null && last != null && n > last) {
        rises += 1;
        if (rises >= 2) return true;
      }
      if (n != null) last = n;
      await new Promise((r) => setTimeout(r, 25));
    }
    console.warn("[Clockwork] Engine did not start processing within", timeoutMs, "ms");
    return false;
  }
  async #partialShutdown() {
    this.#clock?.stopDriftTimer();
    this.#syncListeners?.clear();
    this.#syncListeners = null;
    if (this.#osc) {
      this.#osc.dispose();
      this.#osc = null;
    }
    this.#debugRawHandler = null;
    this.#front?.dispose();
    this.#front = null;
    if (this.#workletNode) {
      this.#workletNode.disconnect();
      this.#workletNode = null;
    }
    if (this.#audioContext) {
      await this.#audioContext.close();
      this.#audioContext = null;
    }
    this.#initialized = false;
    this.#scopeViews = null;
    this.#initPromise = null;
    this.#oscChannel = null;
    this.#clock?.reset();
    this.#audioHealthMonitor?.reset();
  }
  async #partialInit() {
    this.#initializing = true;
    this.bootStats.initStartTime = performance.now();
    try {
      this.#resetRingEpoch();
      this.#initializeAudioContext();
      const wasmBytes = await this.#loadWasm();
      await this.#initializeAudioWorklet(wasmBytes);
      await this.#initializeOSC();
      await this.#initializeFront();
      await this.#awaitEngineProcessing();
      await this.#finishInitialization();
    } catch (error) {
      this.#initializing = false;
      this.#initPromise = null;
      console.error("[Clockwork] Partial init failed:", error);
      this.#eventEmitter.emit("error", error);
      throw error;
    }
  }
  // ============================================================================
  // THE GUEST'S PUBLISH WINDOW
  // ============================================================================
  /**
   * Where the guest publishes, and how to reach it in either mode.
   *
   * Clockwork does not know what is in there — a node tree, a meter table, a
   * grid of anything. It reserves the region, copies it out beside the metrics
   * on change, and hands a consumer the bytes. Whoever knows the guest's
   * layout casts them.
   *
   * @returns {{buffer: ArrayBuffer|SharedArrayBuffer, offset: number, size: number}|null}
   */
  readWindow() {
    if (!this.#initialized) return null;
    const bc = this.#metricsReader.bufferConstants;
    if (!bc) return null;
    if (this.#config.mode === "postMessage") {
      const snapshot = this.#metricsReader.getSnapshotBuffer();
      if (!snapshot) return null;
      return { buffer: snapshot, offset: bc.METRICS_SIZE, size: bc.SHM_WINDOW_SIZE };
    }
    const sab = this.#metricsReader.sharedBuffer;
    if (!sab) return null;
    return {
      buffer: sab,
      offset: this.#metricsReader.ringBufferBase + bc.SHM_WINDOW_START,
      size: bc.SHM_WINDOW_SIZE
    };
  }
  // ============================================================================
  // SCOPE API
  // ============================================================================
  /** @returns {object} Cached TypedArray views for a scope stream slot (lazily created) */
  #getScopeSlotViews(scopeNum) {
    if (!this.#scopeViews) {
      this.#scopeViews = new Array(this.#metricsReader.bufferConstants.SHM_SCOPE_SLOT_COUNT);
    }
    let views = this.#scopeViews[scopeNum];
    if (views) return views;
    const bc = this.#metricsReader.bufferConstants;
    const sab = this.#metricsReader.sharedBuffer;
    const base = this.#metricsReader.ringBufferBase;
    const slotOffset = scopeNum < bc.SHM_SCOPE_MAX_SCOPES ? base + bc.SHM_SCOPE_START + bc.SHM_SCOPE_HEADER_SIZE + scopeNum * bc.SHM_SCOPE_SLOT_SIZE : base + bc.SHM_TRACK_TAPS_START + (scopeNum - bc.SHM_SCOPE_MAX_SCOPES) * bc.SHM_SCOPE_SLOT_SIZE;
    const ringFrames = bc.SHM_SCOPE_RING_FRAMES;
    views = {
      meta: new Uint32Array(sab, slotOffset, 4),
      cursor: new BigUint64Array(sab, slotOffset + 16, 2),
      // [write_position, base_engine_frames]
      data: new Float32Array(
        sab,
        slotOffset + bc.SHM_SCOPE_SLOT_HEADER_SIZE,
        ringFrames * bc.SHM_SCOPE_CHANNELS
      ),
      ringFrames
    };
    this.#scopeViews[scopeNum] = views;
    return views;
  }
  /**
   * Get the newest `frames` frames of a scope stream.
   *
   * The stream is a lossless interleaved ring with a monotonic write cursor
   * (see docs/PORTS.md); this copies out the window ending at
   * the current cursor. SAB mode only for now.
   *
   * @param {number} scopeNum - Scope slot index (0 to maxScopes-1)
   * @param {number} [frames] - Window length; defaults to 1024
   * @returns {{ frames: number, channels: number, writePosition: bigint, interleaved: Float32Array }|null}
   */
  getScope(scopeNum, frames = 1024) {
    if (!this.#initialized) return null;
    const bc = this.#metricsReader.bufferConstants;
    if (!bc || bc.SHM_SCOPE_START == null || bc.SHM_SCOPE_SLOT_COUNT == null) return null;
    if (scopeNum < 0 || scopeNum >= bc.SHM_SCOPE_SLOT_COUNT) return null;
    if (!this.#metricsReader.sharedBuffer) return null;
    const views = this.#getScopeSlotViews(scopeNum);
    if (Atomics.load(views.meta, 0) !== 1) return null;
    const channels = Math.min(Math.max(views.meta[1], 1), bc.SHM_SCOPE_CHANNELS);
    const cap = views.ringFrames;
    const writer = Atomics.load(views.cursor, 0);
    if (writer === 0n) return null;
    const want = Math.min(frames, cap);
    const end = writer;
    let start = end > BigInt(want) ? end - BigInt(want) : 0n;
    const margin = BigInt(Math.min(cap >> 2, 2048));
    const oldest = end > BigInt(cap) ? end - BigInt(cap) + margin : 0n;
    if (start < oldest) start = oldest;
    const real = Number(end - start);
    const out = new Float32Array(want * channels);
    const fill = want - real;
    let at = Number(start % BigInt(cap));
    for (let i = 0; i < real; i++) {
      for (let c = 0; c < channels; c++) {
        out[(fill + i) * channels + c] = views.data[at * channels + c];
      }
      at = (at + 1) % cap;
    }
    return { frames: want, channels, writePosition: writer, interleaved: out };
  }
  /**
   * Get all active scope slots.
   * @returns {Array<{ index: number, channels: number }>}
   */
  getScopes() {
    if (!this.#initialized) return [];
    const bc = this.#metricsReader.bufferConstants;
    if (!bc || bc.SHM_SCOPE_START == null || bc.SHM_SCOPE_SLOT_COUNT == null) return [];
    if (!this.#metricsReader.sharedBuffer) return [];
    const scopes = [];
    for (let i = 0; i < bc.SHM_SCOPE_SLOT_COUNT; i++) {
      const views = this.#getScopeSlotViews(i);
      if (views.meta[0] !== 0) {
        scopes.push({ index: i, channels: views.meta[1] });
      }
    }
    return scopes;
  }
  /**
   * Get scope schema (capacity, ring frames per slot, channels).
   * @returns {{ maxScopes: number, ringFrames: number, channels: number }|null}
   */
  static getScopeSchema() {
    return {
      maxScopes: 32,
      ringFrames: 16384,
      channels: 2
    };
  }
  // ============================================================================
  // AUDIO CAPTURE API
  //
  // The audio taps are clockwork's and flow from boot: the OUT tap is what
  // left for the device each block, written by the tick at the device edge
  // (audio_processor.cpp), the IN tap what arrived. A capture is a reader's
  // notion — startCapture notes the writer's cursor, stopCapture returns
  // what was written since — and toggles nothing in the engine. See
  // js/lib/audio_capture.js and docs/ARENA.md.
  // ============================================================================
  startCapture() {
    this.#ensureInitialized("start capture");
    if (!this.#audioCapture.isAvailable()) {
      throw new Error(
        "Audio capture is only available in SAB mode (set mode: 'sab')."
      );
    }
    this.#audioCapture.start();
  }
  stopCapture() {
    this.#ensureInitialized("stop capture");
    return this.#audioCapture.stop();
  }
  isCaptureEnabled() {
    return this.#audioCapture.isEnabled();
  }
  getCaptureFrames() {
    return this.#audioCapture.getFrameCount();
  }
  getMaxCaptureDuration() {
    return this.#audioCapture.getMaxDuration();
  }
  // ============================================================================
  // OSC MESSAGING API
  // ============================================================================
  send(address, ...args) {
    this.#ensureInitialized("send OSC messages");
    const blocked = this.#dsp.blockedVerbs;
    if (blocked[address]) {
      throw new Error(`${address} is not supported in Clockwork. ${blocked[address]}`);
    }
    const normalizedArgs = args.map((arg) => {
      if (arg instanceof ArrayBuffer) return new Uint8Array(arg);
      return arg;
    });
    const oscData = _Clockwork.osc.encodeMessage(address, normalizedArgs);
    this.sendOSC(oscData);
  }
  sendOSC(oscData) {
    this.#ensureInitialized("send OSC data");
    const uint8Data = this.#toUint8Array(oscData);
    this.#sendPreparedOSC(uint8Data);
  }
  /**
   * Flush pending OSC from the WASM scheduler and the IN ring.
   *
   * Uses a postMessage flag (not the ring buffer) to avoid the race where stale
   * scheduled bundles would fire before a clearSched command could be read from
   * the ring buffer. Resolves when the worklet acks — or, if the worklet is
   * gone, when that ack times out.
   *
   * @returns {Promise<void>}
   */
  async purge() {
    this.#ensureInitialized("purge");
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.#workletNode.port.removeEventListener("message", handler);
        resolve();
      };
      const handler = (event) => {
        if (event.data.type === "clearSchedAck") finish();
      };
      const timer = setTimeout(() => {
        if (true) console.warn("[Dbg-Clockwork] purge() timed out waiting for clearSchedAck; worklet may be gone");
        finish();
      }, PURGE_ACK_TIMEOUT_MS);
      this.#workletNode.port.addEventListener("message", handler);
      this.#workletNode.port.postMessage({ type: "clearSched", ack: true });
    });
  }
  /**
   * A transferable channel letting a Web Worker send OSC straight to the
   * worklet, bypassing the main thread. SAB-backed or MessagePort-backed
   * depending on transport.
   *
   * @returns {OscChannel}
   */
  createOscChannel(options = {}) {
    this.#ensureInitialized("create OSC channel");
    return this.#osc.createOscChannel(options);
  }
  /**
   * Get the next unique node ID.
   *
   * Globally unique with no coordination. IDs start at 1000: 0 is the root group
   * and 1-999 are left free for the client to assign by hand.
   *
   * SAB mode is a single atomic increment; PM mode allocates by range.
   * Also available on OscChannel, for Web Workers.
   *
   * @returns {number} A unique node ID (>= 1000)
   */
  nextNodeId() {
    this.#ensureInitialized("allocate node IDs");
    return this.#oscChannel.nextNodeId();
  }
  // ============================================================================
  // ASSET LOADING API
  // ============================================================================
  /**
   * Where the guest's memory is, and how far it may grow.
   *
   * Clockwork reserves this region and never interprets a byte of it. What
   * lives there — an allocator arena, sample frames, a wavetable, anything —
   * is decided entirely by the guest and its client code.
   *
   * @returns {{offset: number, size: number, maxSize: number}} byte addresses
   *          in the guest's own address space
   */
  guestMemory() {
    const mem = this.#config.memory;
    return {
      offset: mem.guestMemoryOffset,
      size: mem.guestMemorySize,
      maxSize: mem.guestMemorySize
      // fixed at boot: the inbox is what grows
    };
  }
  /**
   * The inbound staging region. THE CLIENT WRITES IT, THE GUEST ONLY READS IT.
   *
   * Bulk into the engine goes here — a sample, a wavetable, an impulse
   * response — followed by a short message saying where it landed. It is not
   * the guest's arena, and there is deliberately no way to write to that from
   * here: a region with two writers would need both sides to agree at runtime
   * about which bytes belong to whom, and nothing could enforce that.
   *
   * @returns {{offset: number, size: number}}
   */
  inbox() {
    const mem = this.#config.memory;
    const committed = this.#wasmMemory ? Math.max(0, this.#wasmMemory.buffer.byteLength - mem.inboxOffset) : mem.inboxSize;
    return {
      offset: mem.inboxOffset,
      size: committed,
      maxSize: this.#config.effectiveMaxInbox ?? mem.maxInboxSize
    };
  }
  /**
   * The outbound staging region. THE GUEST WRITES IT, THE CLIENT ONLY READS IT.
   *
   * @returns {{offset: number, size: number}}
   */
  outbox() {
    const mem = this.#config.memory;
    return { offset: mem.outboxOffset, size: mem.outboxSize };
  }
  /**
   * Commit more inbox, growing the WASM heap by whole pages.
   *
   * The CEILING CANNOT MOVE. `maximum` is fixed when the memory is
   * constructed and reserves address space that growth then commits into, so
   * this can only ever reach `inbox().maxSize`. A client that needs more
   * than that must ask for it before boot, not here.
   *
   * @param {number} bytes  how much more is needed, rounded up to whole pages
   * @returns {Promise<boolean>} false if the ceiling refused it
   */
  async growInbox(bytes) {
    this.#ensureInitialized("grow inbox");
    const pages = Math.ceil(bytes / 65536);
    if (pages <= 0) return true;
    if (this.#config.mode === "sab") {
      return this.#wasmMemory.grow(pages) !== -1;
    }
    const growId = ++this.#guestGrowSeq;
    return this.#workletReply(
      { type: "growMemory", growId, pages },
      "memoryGrown",
      (d) => d.growId === growId,
      "grow inbox"
    ).then((d) => {
      const ok = !!d.success;
      if (ok) this.#config.memory.inboxSize += pages * 65536;
      return ok;
    }).catch(() => false);
  }
  /**
   * Call a named wasm export on the audio thread and return its result.
   *
   * A guest (or a demo like rerezzed) sometimes has to invoke one of its own
   * exports from inside the audio context — spawning a program, staging a
   * pipeline — where it can touch the live engine directly. The worklet runs
   * the export and posts the result back.
   */
  async callExport(name, args = []) {
    const callId = ++this.#exportCallSeq;
    const reply = await this.#workletReply(
      { type: "callExport", callId, name, args },
      "exportCalled",
      (d) => d.callId === callId,
      `call ${name}`
    );
    return reply.result;
  }
  /**
   * Put bytes into the INBOX at `offset`, for the guest to read.
   *
   * SAB mode writes straight into the shared heap; postMessage mode ships the
   * bytes to the worklet to write. Bulk never rides OSC ingress either way.
   *
   * OFFSET, NOT POINTER — measured from the base of the inbox. Native maps the
   * same region at a different address than the engine's, so an absolute
   * pointer names the wrong bytes there without faulting.
   *
   * @param {number} offset  a byte offset into `inbox()`
   * @param {ArrayBuffer|ArrayBufferView} bytes
   * @returns {Promise<{offset: number, bytes: number}>}
   */
  async writeInbox(offset, bytes) {
    this.#ensureInitialized("write inbox");
    const src = ArrayBuffer.isView(bytes) ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : new Uint8Array(bytes);
    const region = this.inbox();
    this.#checkGuestRange(offset, src.byteLength, region, "write inbox");
    const ptr = region.offset + offset;
    if (this.#config.mode === "sab") {
      new Uint8Array(this.#wasmMemory.buffer, ptr, src.byteLength).set(src);
      return { offset, bytes: src.byteLength };
    }
    const copyId = ++this.#guestWriteSeq;
    const buf = src.slice().buffer;
    await this.#workletReply(
      { type: "copyBufferData", copyId, ptr, data: buf },
      "bufferCopied",
      (d) => d.copyId === copyId,
      "write guest memory",
      [buf]
    );
    return { offset, bytes: src.byteLength };
  }
  /*
   * Refuse a range that leaves the guest's region, before anyone acts on it.
   *
   * Written as a subtraction rather than as `offset + len > size` because the
   * latter passes on overflow — a huge length wraps and the check waves it
   * through, which in SAB mode is a write past the region and in native terms
   * is the read the C++ side's region_at() exists to prevent. Same shape on
   * both sides on purpose.
   */
  #checkGuestRange(offset, len, region, what) {
    const size = region.size;
    if (!Number.isInteger(offset) || !Number.isInteger(len) || offset < 0 || len < 0 || offset > size || len > size - offset) {
      throw new RangeError(
        `${what}: [${offset}, ${offset + len}) is outside the region (0..${size})`
      );
    }
  }
  /**
   * Read bytes out of the OUTBOX, which only the guest writes.
   *
   * The mirror of writeInbox: a guest writes a blob into the outbox and sends a
   * short message saying where. `offset` is region-relative, as there.
   *
   * ASYNC ON BOTH TRANSPORTS, though SAB could answer synchronously — a
   * signature that changed shape with the transport would break any caller that
   * awaited only in postMessage mode.
   *
   * @param {number} offset  a byte offset into `outbox()`
   * @param {number} len
   * @returns {Promise<Uint8Array>} a COPY, so a later growth cannot invalidate it
   */
  async readOutbox(offset, len) {
    this.#ensureInitialized("read outbox");
    const region = this.outbox();
    this.#checkGuestRange(offset, len, region, "read outbox");
    const ptr = region.offset + offset;
    if (this.#config.mode === "sab") {
      return new Uint8Array(this.#wasmMemory.buffer, ptr, len).slice();
    }
    const readId = ++this.#guestReadSeq;
    const reply = await this.#workletReply(
      { type: "readBufferData", readId, ptr, len },
      "bufferRead",
      (d) => d.readId === readId,
      "read guest memory"
    );
    return new Uint8Array(reply.data);
  }
  /*
   * One request to the worklet, one matching reply, or a timeout.
   *
   * Both memory primitives need the same shape, and the message names live in one
   * place so they can be checked against the worklet — a name the worklet never
   * implemented can only ever time out.
   */
  #workletReply(message, replyType, matches, what, transfer = []) {
    const port = this.#workletNode.port;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        port.removeEventListener("message", handler);
        reject(new Error(`${what}: the worklet did not answer within 10s`));
      }, 1e4);
      const handler = (e) => {
        if (!e.data || e.data.type !== replyType || !matches(e.data)) return;
        clearTimeout(timer);
        port.removeEventListener("message", handler);
        e.data.success === false ? reject(new Error(e.data.error || `${what}: the worklet refused`)) : resolve(e.data);
      };
      port.addEventListener("message", handler);
      port.postMessage(message, transfer);
    });
  }
  async sync(syncId = Math.floor(Math.random() * 2147483647), timeoutMs = SYNC_TIMEOUT_MS) {
    this.#ensureInitialized("sync");
    const syncPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#syncListeners?.delete(syncId);
        reject(new Error(`Timeout waiting for ${this.#dsp.syncedVerb} response`));
      }, timeoutMs);
      const messageHandler = () => {
        clearTimeout(timeout);
        this.#syncListeners.delete(syncId);
        resolve();
      };
      if (!this.#syncListeners) this.#syncListeners = /* @__PURE__ */ new Map();
      this.#syncListeners.set(syncId, messageHandler);
    });
    if (!this.#dsp.syncVerb) {
      throw new Error("sync() needs a dsp profile: no DSP declares a sync verb.");
    }
    this.send(this.#dsp.syncVerb, syncId);
    await syncPromise;
    if (this.#config.mode === "postMessage") {
      await new Promise((r) => setTimeout(r, this.#config.snapshotIntervalMs * 2));
    }
  }
  // ============================================================================
  // INFO API
  // ============================================================================
  getInfo() {
    this.#ensureInitialized("get info");
    return {
      sampleRate: this.#audioContext.sampleRate,
      totalMemory: this.#config.memory.totalMemory,
      wasmHeapSize: this.#config.memory.wasmHeapSize,
      guestMemorySize: this.#config.memory.guestMemorySize,
      bootTimeMs: this.bootStats.initDuration,
      capabilities: { ...this.#capabilities },
      version: this.#version
    };
  }
  // ============================================================================
  // LIFECYCLE API
  // ============================================================================
  async shutdown() {
    if (!this.#initialized && !this.#initializing) return;
    this.#eventEmitter.emit("shutdown");
    this.#clock?.stopDriftTimer();
    this.#audioHealthMonitor?.reset();
    this.#audioHealthMonitor = null;
    this.#syncListeners?.clear();
    this.#syncListeners = null;
    if (this.#osc) {
      this.#osc.dispose();
      this.#osc = null;
    }
    this.#debugRawHandler = null;
    this.#front?.dispose();
    this.#front = null;
    if (this.#workletNode) {
      this.#workletNode.disconnect();
      this.#workletNode = null;
    }
    if (this.#audioContext) {
      await this.#audioContext.close();
      this.#audioContext = null;
    }
    this.#oscChannel = null;
    this.#initialized = false;
    this.#scopeViews = null;
    this.#initPromise = null;
    this.#wasmMemory = null;
    this.#clock?.reset();
    this.bootStats = { initStartTime: null, initDuration: null };
  }
  async destroy() {
    this.#eventEmitter.emit("destroy");
    await this.shutdown();
    this.#cachedWasmBytes = null;
    this.#eventEmitter.removeAllListeners();
  }
  async reset() {
    await this.shutdown();
    await this.init();
  }
  // ============================================================================
  // PRIVATE: INITIALIZATION HELPERS
  // ============================================================================
  #setAndValidateCapabilities() {
    this.#capabilities = {
      audioWorklet: typeof AudioWorklet !== "undefined",
      sharedArrayBuffer: typeof SharedArrayBuffer !== "undefined",
      crossOriginIsolated: window.crossOriginIsolated === true,
      atomics: typeof Atomics !== "undefined",
      webWorker: typeof Worker !== "undefined",
      playbackStats: typeof AudioContext !== "undefined" && "playbackStats" in AudioContext.prototype
    };
    const mode = this.#config.mode;
    const required = ["audioWorklet", "webWorker"];
    if (mode === "sab") {
      required.push("sharedArrayBuffer", "crossOriginIsolated", "atomics");
    }
    const missing = required.filter((f) => !this.#capabilities[f]);
    if (missing.length > 0) {
      const error = new Error(`Missing required features for ${mode} mode: ${missing.join(", ")}`);
      if (mode === "sab" && !this.#capabilities.crossOriginIsolated) {
        error.message += "\n\nConsider using mode: 'postMessage' which doesn't require COOP/COEP headers.";
      }
      throw error;
    }
    if (mode !== "sab" && mode !== "postMessage") {
      throw new Error(`Invalid mode: '${mode}'. Use 'sab' or 'postMessage'.`);
    }
  }
  #initializeMemory() {
    const memConfig = this.#config.memory;
    const mode = this.#config.mode;
    if (mode === "sab") {
      const minPages = MemoryLayout.totalPages;
      const totalPages = Math.max(Math.ceil(memConfig.totalMemory / 65536), minPages);
      const maxPages = Math.ceil(memConfig.maxTotalMemory / 65536);
      this.#wasmMemory = new WebAssembly.Memory({
        initial: totalPages,
        maximum: maxPages,
        shared: true
      });
    } else {
      this.#wasmMemory = null;
    }
  }
  #initializeAudioContext() {
    if (this.#config.audioContext) {
      this.#audioContext = this.#config.audioContext;
    } else {
      this.#audioContext = new AudioContext(this.#config.audioContextOptions);
    }
    this.#audioContext.addEventListener("statechange", () => {
      const state = this.#audioContext?.state;
      if (!state) return;
      const previousState = this.#previousAudioContextState;
      this.#previousAudioContextState = state;
      if (state === "running" && (previousState === "suspended" || previousState === "interrupted")) {
        this.#clock?.resync();
      }
      this.#eventEmitter.emit("audiocontext:statechange", { state });
      if (state === "suspended") {
        this.#eventEmitter.emit("audiocontext:suspended");
        this.#audioHealthMonitor?.reset();
      } else if (state === "running") {
        this.#eventEmitter.emit("audiocontext:resumed");
        this.#audioHealthMonitor?.reset();
      } else if (state === "interrupted") {
        this.#eventEmitter.emit("audiocontext:interrupted");
        this.#audioHealthMonitor?.reset();
      }
    });
    this.#audioHealthMonitor = new AudioHealthMonitor({ audioContext: this.#audioContext });
  }
  async #loadWasm() {
    if (this.#cachedWasmBytes) return this.#cachedWasmBytes;
    const wasmName = this.#config.wasmUrl.split("/").pop();
    if (this.#config.wasmBytes) {
      const wasmBytes2 = this.#config.wasmBytes;
      this.#eventEmitter.emit("loading:start", { type: "wasm", name: wasmName, size: wasmBytes2.byteLength });
      this.#eventEmitter.emit("loading:complete", { type: "wasm", name: wasmName, size: wasmBytes2.byteLength });
      this.#cachedWasmBytes = wasmBytes2;
      return wasmBytes2;
    }
    const wasmBytes = await this.#assetLoader.fetch(this.#config.wasmUrl, { type: "wasm", name: wasmName });
    this.#cachedWasmBytes = wasmBytes;
    return wasmBytes;
  }
  async #initializeAudioWorklet(wasmBytes) {
    await addWorkletModule(this.#audioContext.audioWorklet, this.#config.workletUrl);
    const numOutputChannels = this.#config.audio.outputChannels;
    this.#workletNode = new AudioWorkletNode(this.#audioContext, "clockwork-processor", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [numOutputChannels]
    });
    if (this.#config.autoConnect) {
      const dest = this.#audioContext.destination;
      if (numOutputChannels > 2) {
        dest.channelCount = Math.min(numOutputChannels, dest.maxChannelCount);
        dest.channelInterpretation = "discrete";
      }
      this.#workletNode.connect(dest);
    }
    this.#node = this.#createNodeWrapper();
    this.#workletNode.port.start();
    this.#setupMessageHandlers();
    const mode = this.#config.mode;
    const sharedBuffer = mode === "sab" ? this.#wasmMemory.buffer : null;
    this.#workletNode.port.postMessage({
      type: "init",
      mode,
      sharedBuffer,
      snapshotIntervalMs: this.#config.snapshotIntervalMs
    });
    const loadWasmMsg = {
      type: "loadWasm",
      wasmBytes,
      // The guest's config block, already encoded by whoever knows its shape.
      guestConfigBytes: this.encodeGuestConfig({
        mode,
        guestMemoryOffset: this.#config.memory.guestMemoryOffset
      }),
      // Where the guest's opaque region is.
      guestMemoryOffset: this.#config.memory.guestMemoryOffset,
      guestMemorySize: this.#config.memory.guestMemorySize,
      // The two one-way bulk lanes. Each has exactly one writer: the client
      // writes the inbox and the guest only reads it; the guest writes the
      // outbox and the client only reads it. Neither overlaps the arena.
      inboxOffset: this.#config.memory.inboxOffset,
      inboxSize: this.#config.memory.inboxSize,
      outboxOffset: this.#config.memory.outboxOffset,
      outboxSize: this.#config.memory.outboxSize,
      // And the span clockwork::mem allocates from, which sits below that region and
      // is where the guest's real-time pool comes from. A build-time constant
      // cannot size it: how big that pool is, is a runtime question.
      memArenaSize: this.#config.memory.memArenaSize ?? 0,
      inputChannels: this.#config.audio.inputChannels,
      outputChannels: this.#config.audio.outputChannels,
      sampleRate: this.#audioContext.sampleRate
    };
    if (mode === "sab") {
      loadWasmMsg.wasmMemory = this.#wasmMemory;
    } else {
      const minPages = MemoryLayout.totalPages;
      loadWasmMsg.memoryPages = Math.max(Math.ceil(this.#config.memory.totalMemory / 65536), minPages);
      loadWasmMsg.maxMemoryPages = Math.ceil(this.#config.memory.maxTotalMemory / 65536);
    }
    this.#workletNode.port.postMessage(loadWasmMsg);
    await this.#waitForWorkletInit();
  }
  #createNodeWrapper() {
    const worklet = this.#workletNode;
    return Object.freeze({
      connect: (...args) => worklet.connect(...args),
      disconnect: (...args) => worklet.disconnect(...args),
      get context() {
        return worklet.context;
      },
      get numberOfOutputs() {
        return worklet.numberOfOutputs;
      },
      get numberOfInputs() {
        return worklet.numberOfInputs;
      },
      get channelCount() {
        return worklet.channelCount;
      },
      get input() {
        return worklet;
      }
    });
  }
  async #initializeOSC() {
    const mode = this.#config.mode;
    const bc = this.#metricsReader.bufferConstants;
    const ringBufferBase = this.#metricsReader.ringBufferBase;
    const sharedBuffer = this.#metricsReader.sharedBuffer;
    const transportConfig = {
      workerBaseURL: this.#config.workerBaseURL,
      snapshotIntervalMs: this.#config.snapshotIntervalMs,
      bypassLookaheadS: this.#config.bypassLookaheadMs / 1e3,
      getAudioContextTime: () => this.#audioContext?.currentTime ?? 0,
      getNTPStartTime: () => this.#clock?.getNTPStartTime() ?? 0
    };
    if (mode === "sab") {
      transportConfig.sharedBuffer = sharedBuffer;
      transportConfig.ringBufferBase = ringBufferBase;
      transportConfig.bufferConstants = bc;
      transportConfig.wasmMemory = this.#wasmMemory;
      transportConfig.wasmModule = await WebAssembly.compile(this.#cachedWasmBytes);
      if (bc?.NODE_ID_COUNTER_START !== void 0) {
        const counterBase = ringBufferBase + bc.NODE_ID_COUNTER_START;
        const counterView = new Int32Array(sharedBuffer, counterBase, 1);
        Atomics.store(counterView, 0, 1e3);
      }
    } else {
      this.#nodeIdCounter = 1e3;
      transportConfig.nodeIdSource = (rangeSize) => {
        const from = this.#nodeIdCounter;
        this.#nodeIdCounter += rangeSize;
        return { from, to: from + rangeSize };
      };
      const workletNodeIdRangeSize = 1e4;
      const workletRange = transportConfig.nodeIdSource(workletNodeIdRangeSize);
      const nodeIdChannel = new MessageChannel();
      const nodeIdSource = transportConfig.nodeIdSource;
      nodeIdChannel.port1.onmessage = (e) => {
        if (e.data.type === "requestNodeIdRange") {
          const r = nodeIdSource(workletNodeIdRangeSize);
          nodeIdChannel.port1.postMessage({ type: "nodeIdRange", from: r.from, to: r.to });
        }
      };
      this.#workletNode.port.postMessage(
        { type: "nodeIdRange", from: workletRange.from, to: workletRange.to },
        [nodeIdChannel.port2]
      );
    }
    this.#osc = createTransport(mode, transportConfig);
    this.#osc.onReply((oscData, sequence, timestamp) => {
      if (this.#front && this.#front.take(oscData)) return;
      this.#deliverInbound(oscData, sequence, timestamp);
    });
    this.#osc.onError((error, workerName) => {
      console.error(`[Clockwork] ${workerName} error:`, error);
      this.#eventEmitter.emit("error", new Error(`${workerName}: ${error}`));
    });
    this.#osc.onOscLog((entries) => {
      for (const entry of entries) {
        const scheduledTime = getBundleTimeTag(entry.oscData) || null;
        this.#eventEmitter.emit("out:osc", {
          oscData: entry.oscData,
          sourceId: entry.sourceId,
          sequence: entry.sequence,
          timestamp: entry.timestamp,
          scheduledTime
        });
        const needsDecode = this.#eventEmitter.hasListeners("out") || this.#eventEmitter.hasListeners("out:text") || this.#eventEmitter.hasListeners("out:html") || this.#config.debug || this.#config.debugOscOut;
        if (needsDecode) {
          try {
            const msg = decodePacket(entry.oscData);
            this.#eventEmitter.emit("out", msg);
            if (this.#eventEmitter.hasListeners("out:text") || this.#config.debug || this.#config.debugOscOut) {
              const maxLen = this.#config.activityEvent.oscOutMaxLineLength ?? this.#config.activityEvent.maxLineLength;
              const outAddr = msg[0];
              const outArgs = msg.slice(1);
              const argsStr = outArgs.map((a) => formatOscArg(a, maxLen)).join(", ");
              const text = `${outAddr}${argsStr ? " " + argsStr : ""}`;
              this.#eventEmitter.emit("out:text", { text, sequence: entry.sequence, timestamp: entry.timestamp });
            }
            if (this.#eventEmitter.hasListeners("out:html")) {
              const html = formatBundleHtml(msg, entry.sequence, entry.timestamp, this.initTime, entry.sourceId);
              this.#eventEmitter.emit("out:html", { html, sequence: entry.sequence, timestamp: entry.timestamp });
            }
          } catch (e) {
          }
        }
      }
    });
    if (this.#config.debug || this.#config.debugOscIn) {
      this.on("in:text", ({ text }) => console.log(`[\u2190 OSC] ${text}`));
    }
    if (this.#config.debug || this.#config.debugOscOut) {
      this.on("out:text", ({ text }) => console.log(`[OSC \u2192] ${text}`));
    }
    if (this.#config.debug || this.#config.debugEngine) {
      this.on("debug", (msg) => console.log(`[synth] ${msg.text}`));
    }
    if (mode === "sab") {
      await this.#osc.initialize();
    } else {
      await this.#osc.initialize(this.#workletNode.port);
      this.#osc.setBufferConstants(bc);
      if (this.#earlyDebugMessages?.length > 0) {
        for (const data of this.#earlyDebugMessages) {
          this.#osc.handleDebugRaw(data);
        }
      }
      this.#debugRawHandler = (data) => this.#osc?.handleDebugRaw(data);
      this.#earlyDebugMessages = [];
    }
    this.#oscChannel = this.#osc.createOscChannel({ sourceId: 0 });
  }
  /*
   * The host's front (js/lib/host_front.js). Always present once the
   * transport is: the worklet forwards every /clockwork/ verb its audio
   * thread does not answer, so SOMETHING on this side has to be the far end
   * that answers or refuses. With `midi` / `gamepad` enabled, that is the
   * managers; without, every such verb is refused by name.
   */
  async #initializeFront() {
    this.#front?.dispose();
    this.#front = new HostFront({
      midi: this.#config.midi,
      gamepad: this.#config.gamepad,
      wasmBaseURL: this.#config.wasmBaseURL,
      deliver: (bytes) => this.#deliverInbound(bytes, -1, performance.now()),
      // An event goes INTO the engine, as a native subsystem's would: the
      // transport exists by now, and the client need not be 'initialized'
      // for a keyboard to be heard during boot.
      ingest: (bytes) => this.#sendPreparedOSC(this.#toUint8Array(bytes))
    });
    await this.#front.init();
  }
  /*
   * One inbound frame for the client: an engine reply or push off the
   * egress, or a reply or push the front made on the engine's behalf — the
   * same path, the same events, so a listener cannot tell which side
   * answered. `sequence` is the egress frame's, or -1 for the front's.
   */
  #deliverInbound(oscData, sequence, timestamp) {
    const scheduledTime = getBundleTimeTag(oscData) || null;
    this.#eventEmitter.emit("in:osc", { oscData, sequence, timestamp, scheduledTime });
    try {
      const msg = decodePacket(oscData);
      const address = msg[0];
      const args = msg.slice(1);
      if (address === clockworkSys("debug")) {
        const eventMaxLen = this.#config.activityEvent.engineMaxLineLength ?? this.#config.activityEvent.maxLineLength;
        let text = args[0] ?? "";
        if (eventMaxLen > 0 && text.length > eventMaxLen) text = text.slice(0, eventMaxLen) + "...";
        this.#eventEmitter.emit("debug", { text, sequence, timestamp });
        return;
      } else if (address === this.#dsp.syncedVerb && args.length > 0) {
        const syncId = args[0];
        if (this.#syncListeners?.has(syncId)) {
          this.#syncListeners.get(syncId)(msg);
        }
      }
      this.#eventEmitter.emit("in", msg);
      if (this.#eventEmitter.hasListeners("in:text") || this.#config.debug || this.#config.debugOscIn) {
        const maxLen = this.#config.activityEvent.oscInMaxLineLength ?? this.#config.activityEvent.maxLineLength;
        const argsStr = args.map((a) => formatOscArg(a, maxLen)).join(", ") || "";
        const text = `${address}${argsStr ? " " + argsStr : ""}`;
        this.#eventEmitter.emit("in:text", { text, sequence, timestamp });
      }
      if (this.#eventEmitter.hasListeners("in:html")) {
        const html = formatOscLineHtml(msg, sequence, timestamp, this.initTime);
        this.#eventEmitter.emit("in:html", { html, sequence, timestamp });
      }
    } catch (e) {
      console.error("[Clockwork] Failed to decode OSC message:", e);
    }
  }
  async #finishInitialization() {
    this.#initialized = true;
    this.#initializing = false;
    this.bootStats.initDuration = performance.now() - this.bootStats.initStartTime;
    await this.#eventEmitter.emitAsync("setup");
    this.#eventEmitter.emit("ready", { capabilities: this.#capabilities, bootStats: this.bootStats });
    if (typeof window !== "undefined") {
      if (!window.__clockwork__) {
        const ss = window.__clockwork__ = { instances: [] };
        Object.defineProperties(ss, {
          primary: { get: () => ss.instances[0] },
          layout: { get: () => ss.primary?.bufferConstants }
        });
        ss.metrics = () => ss.primary?.getMetrics();
        ss.window = () => ss.primary?.readWindow();
        ss.snapshot = () => ss.primary?.getSnapshot();
      }
      window.__clockwork__.instances.push(this);
    }
  }
  #waitForWorkletInit() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("AudioWorklet initialization timeout"));
      }, WORKLET_INIT_TIMEOUT_MS);
      const messageHandler = async (event) => {
        if (event.data.type === "error") {
          clearTimeout(timeout);
          this.#workletNode.port.removeEventListener("message", messageHandler);
          reject(new Error(event.data.error || "AudioWorklet error"));
          return;
        }
        if (event.data.type === "initialized") {
          clearTimeout(timeout);
          this.#workletNode.port.removeEventListener("message", messageHandler);
          if (event.data.success) {
            const ringBufferBase = event.data.ringBufferBase ?? 0;
            const bufferConstants = event.data.bufferConstants;
            const sharedBuffer = this.#config.mode === "sab" ? this.#wasmMemory.buffer : null;
            this.#metricsReader.initSharedViews(sharedBuffer, ringBufferBase, bufferConstants);
            this.#clock = new ClockworkClock({
              mode: this.#config.mode,
              audioContext: this.#audioContext,
              workletPort: this.#workletNode.port
            });
            this.#clock.initSharedViews(sharedBuffer, ringBufferBase, bufferConstants);
            await this.#clock.initialize();
            this.#clock.startDriftTimer();
            if (this.#config.mode === "sab") {
              this.#audioCapture.update(sharedBuffer, ringBufferBase, bufferConstants);
            }
            if (this.#config.mode === "postMessage" && event.data.initialSnapshot) {
              this.#metricsReader.updateSnapshot(event.data.initialSnapshot);
            }
            resolve();
          } else {
            reject(new Error(event.data.error || "AudioWorklet initialization failed"));
          }
        }
      };
      this.#workletNode.port.addEventListener("message", messageHandler);
      this.#workletNode.port.start();
    });
  }
  #setupMessageHandlers() {
    this.#workletNode.port.addEventListener("message", (event) => {
      const { data } = event;
      switch (data.type) {
        case "error":
          console.error("[Worklet] Error:", data.error);
          this.#eventEmitter.emit("error", new Error(data.error));
          break;
        case "version":
          this.#version = data.version;
          break;
        case "snapshot":
          if (data.buffer) {
            this.#metricsReader.updateSnapshot(data.buffer);
            this.#snapshotsSent = data.snapshotsSent;
          }
          break;
        case "debugRawBatch":
          if (this.#debugRawHandler) {
            this.#debugRawHandler(data);
          } else if (this.#earlyDebugMessages) {
            this.#earlyDebugMessages.push(data);
          }
          break;
      }
    });
  }
  // ============================================================================
  // PRIVATE: METRICS
  // ============================================================================
  /**
   * Extra metrics context from the product built on clockwork.
   *
   * A client holds state clockwork cannot see — how many samples are
   * loaded, how often its own pool has grown — and the metrics object is
   * where a user looks for it. Overriding this is the supported way to get it
   * there; the alternative is a parallel metrics path beside clockwork's,
   * reported separately and never lining up with it.
   *
   * Return whatever the reader understands. Anything it does not recognise is
   * ignored rather than surfaced, so an unknown key is inert, not an error.
   *
   * @returns {object} merged over clockwork's own context
   */
  clientMetrics() {
    return {};
  }
  /**
   * Encode the guest's config block, or null when it has none.
   *
   * Clockwork reserves a region for it and copies the bytes in; it does not
   * know or care what they mean. Clockwork's own geometry travels as arguments
   * to clockwork_init rather than through this block, so a product's encoder is
   * free to lay it out however its guest wants.
   *
   * @param {{mode: string, guestMemoryOffset: number}} ctx  what only
   *        clockwork knows and the encoder may need
   * @returns {ArrayBuffer|ArrayBufferView|null}
   */
  encodeGuestConfig(ctx) {
    return null;
  }
  /**
   * Re-send whatever the product had in the engine, after a reload.
   *
   * A reload tears the engine down and builds it again, so everything the
   * engine held is gone, and clockwork has no idea what any of it was.
   * Override this to put it back — definitions, samples, anything.
   *
   * This is the ONLY restore path — there is no second mechanism for any one
   * category of state.
   *
   * Called before the barrier that waits on all of it, so a product does not
   * need its own sync.
   */
  async restoreClientState() {
  }
  /*
   * The declared guest metrics, merged into the schema clockwork reports so
   * a caller sees one list rather than clockwork's plus a product's.
   */
  getMetricsSchema() {
    return _Clockwork.mergeGuestMetrics(this.#dsp);
  }
  /**
   * Clockwork's schema with one guest's declarations folded in.
   *
   * Static, because a product overriding the static `getMetricsSchema()` needs
   * the same merge before any instance exists — a caller inspecting what a
   * product reports should not have to boot one to find out.
   */
  static mergeGuestMetrics(dsp) {
    const declared = dsp?.metrics || {};
    const metrics = { ...METRICS_SCHEMA.metrics };
    for (const [name, def] of Object.entries(declared)) {
      metrics[name] = { ...def, offset: GUEST_METRICS_BASE + def.slot };
    }
    const layout = {
      ...METRICS_SCHEMA.layout,
      panels: [...METRICS_SCHEMA.layout?.panels || [], ...dsp?.metricsPanels || []]
    };
    return { ...METRICS_SCHEMA, metrics, layout };
  }
  #metricsContext() {
    return {
      // Only what the guest declared gets through; the rest has no slot.
      guestMetrics: this.clientMetrics(),
      transportMetrics: this.#osc?.getMetrics(),
      driftOffsetMs: this.#clock?.getDriftOffset() ?? 0,
      ntpStartTime: this.#clock?.getNTPStartTime() ?? 0,
      clockOffsetMs: this.#clock?.getClockOffset() ?? 0,
      audioContextState: this.#audioContext?.state || "unknown",
      audioHealthPct: this.#audioHealthMonitor?.update() ?? 100,
      playbackStats: this.#capabilities.playbackStats ? this.#audioContext?.playbackStats : null
    };
  }
  #gatherMetrics() {
    return this.#metricsReader.gatherMetrics(this.#metricsContext());
  }
  #updateMergedArray() {
    this.#metricsReader.updateMergedArray(this.#metricsContext());
  }
  // ============================================================================
  // PRIVATE: UTILITIES
  // ============================================================================
  #readProcessCount() {
    if (this.#config.mode === "sab") {
      const view = this.#metricsReader.getMetricsView();
      return view ? view[0] : null;
    }
    const buffer = this.#metricsReader.getSnapshotBuffer();
    if (!buffer) return null;
    return new Uint32Array(buffer, 0, 1)[0];
  }
  #ensureInitialized(actionDescription = "perform this operation") {
    if (!this.#initialized) {
      throw new Error(`Clockwork not initialized. Call init() before attempting to ${actionDescription}.`);
    }
  }
  #toUint8Array(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    throw new Error("oscData must be ArrayBuffer or Uint8Array");
  }
  #sendPreparedOSC(preparedData) {
    const bc = this.#metricsReader?.bufferConstants;
    const maxSize = bc?.IN_BUFFER_SIZE;
    if (maxSize && preparedData.length > maxSize - 16) {
      throw new Error(
        `OSC message too large to send (${preparedData.length} > ${maxSize - 16} bytes)`
      );
    }
    this.#oscChannel.send(preparedData);
  }
};
var osc = Clockwork.osc;

// node_modules/@thi.ng/api/typedarray.js
var GL2TYPE = {
  [
    5120
    /* I8 */
  ]: "i8",
  [
    5121
    /* U8 */
  ]: "u8",
  [
    5122
    /* I16 */
  ]: "i16",
  [
    5123
    /* U16 */
  ]: "u16",
  [
    5124
    /* I32 */
  ]: "i32",
  [
    5125
    /* U32 */
  ]: "u32",
  [
    5126
    /* F32 */
  ]: "f32"
};
var SIZEOF = {
  u8: 1,
  u8c: 1,
  i8: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  i64: 8,
  u64: 8,
  f32: 4,
  f64: 8
};
var FLOAT_ARRAY_CTORS = {
  f32: Float32Array,
  f64: Float64Array
};
var INT_ARRAY_CTORS = {
  i8: Int8Array,
  i16: Int16Array,
  i32: Int32Array
};
var UINT_ARRAY_CTORS = {
  u8: Uint8Array,
  u8c: Uint8ClampedArray,
  u16: Uint16Array,
  u32: Uint32Array
};
var BIGINT_ARRAY_CTORS = {
  i64: BigInt64Array,
  u64: BigUint64Array
};
var TYPEDARRAY_CTORS = {
  ...FLOAT_ARRAY_CTORS,
  ...INT_ARRAY_CTORS,
  ...UINT_ARRAY_CTORS
};
var asNativeType = (type) => {
  const t = GL2TYPE[type];
  return t !== void 0 ? t : type;
};
function typedArray(type, ...args) {
  const ctor = BIGINT_ARRAY_CTORS[type];
  return new (ctor || TYPEDARRAY_CTORS[asNativeType(type)])(...args);
}

// node_modules/@thi.ng/binary/align.js
var align = (addr, size) => (size--, addr + size & ~size);

// node_modules/@thi.ng/checks/is-number.js
var isNumber = (x) => typeof x === "number";

// node_modules/@thi.ng/errors/deferror.js
var defError = (prefix, suffix = (msg) => msg !== void 0 ? ": " + msg : "") => class extends Error {
  origMessage;
  constructor(msg) {
    super(prefix(msg) + suffix(msg));
    this.origMessage = msg !== void 0 ? String(msg) : "";
  }
};

// node_modules/@thi.ng/errors/assert.js
var AssertionError = defError(() => "Assertion failed");
var assert = (typeof process !== "undefined" && process.env !== void 0 ? true : import.meta.env ? import.meta.env.MODE !== "production" || !!import.meta.env.UMBRELLA_ASSERTS || !!import.meta.env.VITE_UMBRELLA_ASSERTS : true) ? (test, msg) => {
  if (typeof test === "function" && !test() || !test) {
    throw new AssertionError(
      typeof msg === "function" ? msg() : msg
    );
  }
} : () => {
};

// node_modules/@thi.ng/errors/illegal-arguments.js
var IllegalArgumentError = defError(() => "illegal argument(s)");
var illegalArgs = (msg) => {
  throw new IllegalArgumentError(msg);
};

// node_modules/@thi.ng/malloc/pool.js
var STATE_FREE = 0;
var STATE_USED = 1;
var STATE_TOP = 2;
var STATE_END = 3;
var STATE_ALIGN = 4;
var STATE_FLAGS = 5;
var STATE_MIN_SPLIT = 6;
var MASK_COMPACT = 1;
var MASK_SPLIT = 2;
var SIZEOF_STATE = 7 * 4;
var MEM_BLOCK_SIZE = 0;
var MEM_BLOCK_NEXT = 1;
var SIZEOF_MEM_BLOCK = 2 * 4;
var MemPool = class {
  buf;
  start;
  u8;
  u32;
  state;
  constructor(opts = {}) {
    this.buf = opts.buf ? opts.buf : new ArrayBuffer(opts.size || 4096);
    this.start = opts.start != null ? align(Math.max(opts.start, 0), 4) : 0;
    this.u8 = new Uint8Array(this.buf);
    this.u32 = new Uint32Array(this.buf);
    this.state = new Uint32Array(this.buf, this.start, SIZEOF_STATE / 4);
    if (!opts.skipInitialization) {
      const _align = opts.align || 8;
      assert(
        _align >= 8,
        `invalid alignment: ${_align}, must be a pow2 and >= 8`
      );
      const top = this.initialTop(_align);
      const resolvedEnd = opts.end != null ? Math.min(opts.end, this.buf.byteLength) : this.buf.byteLength;
      if (top >= resolvedEnd) {
        illegalArgs(
          `insufficient address range (0x${this.start.toString(
            16
          )} - 0x${resolvedEnd.toString(16)})`
        );
      }
      this.align = _align;
      this.doCompact = opts.compact !== false;
      this.doSplit = opts.split !== false;
      this.minSplit = opts.minSplit || 16;
      this.end = resolvedEnd;
      this.top = top;
      this._free = 0;
      this._used = 0;
    }
  }
  stats() {
    const listStats = (block) => {
      let count = 0;
      let size = 0;
      while (block) {
        count++;
        size += this.blockSize(block);
        block = this.blockNext(block);
      }
      return { count, size };
    };
    const free = listStats(this._free);
    return {
      free,
      used: listStats(this._used),
      top: this.top,
      available: this.end - this.top + free.size,
      total: this.buf.byteLength
    };
  }
  callocAs(type, num, fill = 0) {
    const block = this.mallocAs(type, num);
    block?.fill(fill);
    return block;
  }
  mallocAs(type, num) {
    const addr = this.malloc(num * SIZEOF[type]);
    return addr ? typedArray(type, this.buf, addr, num) : void 0;
  }
  calloc(bytes, fill = 0) {
    const addr = this.malloc(bytes);
    addr && this.u8.fill(fill, addr, addr + bytes);
    return addr;
  }
  malloc(bytes) {
    if (bytes <= 0) {
      return 0;
    }
    const paddedSize = align(bytes + SIZEOF_MEM_BLOCK, this.align);
    const end = this.end;
    let top = this.top;
    let block = this._free;
    let prev = 0;
    while (block) {
      const blockSize = this.blockSize(block);
      const isTop = block + blockSize >= top;
      if (isTop || blockSize >= paddedSize) {
        return this.mallocTop(
          block,
          prev,
          blockSize,
          paddedSize,
          isTop
        );
      }
      prev = block;
      block = this.blockNext(block);
    }
    block = top;
    top = block + paddedSize;
    if (top <= end) {
      this.initBlock(block, paddedSize, this._used);
      this._used = block;
      this.top = top;
      return __blockDataAddress(block);
    }
    return 0;
  }
  mallocTop(block, prev, blockSize, paddedSize, isTop) {
    if (isTop && block + paddedSize > this.end) return 0;
    if (prev) {
      this.unlinkBlock(prev, block);
    } else {
      this._free = this.blockNext(block);
    }
    this.setBlockNext(block, this._used);
    this._used = block;
    if (isTop) {
      this.top = block + this.setBlockSize(block, paddedSize);
    } else if (this.doSplit) {
      const excess = blockSize - paddedSize;
      excess >= this.minSplit && this.splitBlock(block, paddedSize, excess);
    }
    return __blockDataAddress(block);
  }
  realloc(ptr, bytes) {
    if (bytes <= 0) {
      return 0;
    }
    const oldAddr = __blockSelfAddress(ptr);
    let newAddr = 0;
    let block = this._used;
    let blockEnd = 0;
    while (block) {
      if (block === oldAddr) {
        [newAddr, blockEnd] = this.reallocBlock(block, bytes);
        break;
      }
      block = this.blockNext(block);
    }
    if (newAddr && newAddr !== oldAddr) {
      this.u8.copyWithin(
        __blockDataAddress(newAddr),
        __blockDataAddress(oldAddr),
        blockEnd
      );
    }
    return __blockDataAddress(newAddr);
  }
  reallocBlock(block, bytes) {
    const blockSize = this.blockSize(block);
    const blockEnd = block + blockSize;
    const isTop = blockEnd >= this.top;
    const paddedSize = align(bytes + SIZEOF_MEM_BLOCK, this.align);
    if (paddedSize <= blockSize) {
      if (this.doSplit) {
        const excess = blockSize - paddedSize;
        if (excess >= this.minSplit) {
          this.splitBlock(block, paddedSize, excess);
        } else if (isTop) {
          this.top = block + paddedSize;
        }
      } else if (isTop) {
        this.top = block + paddedSize;
      }
      return [block, blockEnd];
    }
    if (isTop && block + paddedSize < this.end) {
      this.top = block + this.setBlockSize(block, paddedSize);
      return [block, blockEnd];
    }
    this.free(block);
    return [__blockSelfAddress(this.malloc(bytes)), blockEnd];
  }
  reallocArray(array, num) {
    if (array.buffer !== this.buf) {
      return;
    }
    const addr = this.realloc(
      array.byteOffset,
      num * array.BYTES_PER_ELEMENT
    );
    return addr ? new array.constructor(this.buf, addr, num) : void 0;
  }
  free(ptrOrArray) {
    let addr;
    if (!isNumber(ptrOrArray)) {
      if (ptrOrArray.buffer !== this.buf) {
        return false;
      }
      addr = ptrOrArray.byteOffset;
    } else {
      addr = ptrOrArray;
    }
    addr = __blockSelfAddress(addr);
    let block = this._used;
    let prev = 0;
    while (block) {
      if (block === addr) {
        if (prev) {
          this.unlinkBlock(prev, block);
        } else {
          this._used = this.blockNext(block);
        }
        this.insert(block);
        this.doCompact && this.compact();
        return true;
      }
      prev = block;
      block = this.blockNext(block);
    }
    return false;
  }
  freeAll() {
    this._free = 0;
    this._used = 0;
    this.top = this.initialTop();
  }
  release() {
    delete this.u8;
    delete this.u32;
    delete this.state;
    delete this.buf;
    return true;
  }
  get align() {
    return this.state[STATE_ALIGN];
  }
  set align(x) {
    this.state[STATE_ALIGN] = x;
  }
  get end() {
    return this.state[STATE_END];
  }
  set end(x) {
    this.state[STATE_END] = x;
  }
  get top() {
    return this.state[STATE_TOP];
  }
  set top(x) {
    this.state[STATE_TOP] = x;
  }
  get _free() {
    return this.state[STATE_FREE];
  }
  set _free(block) {
    this.state[STATE_FREE] = block;
  }
  get _used() {
    return this.state[STATE_USED];
  }
  set _used(block) {
    this.state[STATE_USED] = block;
  }
  get doCompact() {
    return !!(this.state[STATE_FLAGS] & MASK_COMPACT);
  }
  set doCompact(flag) {
    flag ? this.state[STATE_FLAGS] |= 1 << MASK_COMPACT - 1 : this.state[STATE_FLAGS] &= ~MASK_COMPACT;
  }
  get doSplit() {
    return !!(this.state[STATE_FLAGS] & MASK_SPLIT);
  }
  set doSplit(flag) {
    flag ? this.state[STATE_FLAGS] |= 1 << MASK_SPLIT - 1 : this.state[STATE_FLAGS] &= ~MASK_SPLIT;
  }
  get minSplit() {
    return this.state[STATE_MIN_SPLIT];
  }
  set minSplit(x) {
    assert(
      x > SIZEOF_MEM_BLOCK,
      `illegal min split threshold: ${x}, require at least ${SIZEOF_MEM_BLOCK + 1}`
    );
    this.state[STATE_MIN_SPLIT] = x;
  }
  blockSize(block) {
    return this.u32[(block >> 2) + MEM_BLOCK_SIZE];
  }
  /**
   * Sets & returns given block size.
   *
   * @param block -
   * @param size -
   */
  setBlockSize(block, size) {
    this.u32[(block >> 2) + MEM_BLOCK_SIZE] = size;
    return size;
  }
  blockNext(block) {
    return this.u32[(block >> 2) + MEM_BLOCK_NEXT];
  }
  /**
   * Sets block next pointer to `next`. Use zero to indicate list end.
   *
   * @param block -
   */
  setBlockNext(block, next) {
    this.u32[(block >> 2) + MEM_BLOCK_NEXT] = next;
  }
  /**
   * Initializes block header with given `size` and `next` pointer. Returns `block`.
   *
   * @param block -
   * @param size -
   * @param next -
   */
  initBlock(block, size, next) {
    const idx = block >>> 2;
    this.u32[idx + MEM_BLOCK_SIZE] = size;
    this.u32[idx + MEM_BLOCK_NEXT] = next;
    return block;
  }
  unlinkBlock(prev, block) {
    this.setBlockNext(prev, this.blockNext(block));
  }
  splitBlock(block, blockSize, excess) {
    this.insert(
      this.initBlock(
        block + this.setBlockSize(block, blockSize),
        excess,
        0
      )
    );
    this.doCompact && this.compact();
  }
  initialTop(_align = this.align) {
    return align(this.start + SIZEOF_STATE + SIZEOF_MEM_BLOCK, _align) - SIZEOF_MEM_BLOCK;
  }
  /**
   * Traverses free list and attempts to recursively merge blocks
   * occupying consecutive memory regions. Returns true if any blocks
   * have been merged. Only called if `compact` option is enabled.
   */
  compact() {
    let block = this._free;
    let prev = 0;
    let scan = 0;
    let scanPrev;
    let res = false;
    while (block) {
      scanPrev = block;
      scan = this.blockNext(block);
      while (scan && scanPrev + this.blockSize(scanPrev) === scan) {
        scanPrev = scan;
        scan = this.blockNext(scan);
      }
      if (scanPrev !== block) {
        const newSize = scanPrev - block + this.blockSize(scanPrev);
        this.setBlockSize(block, newSize);
        const next = this.blockNext(scanPrev);
        let tmp = this.blockNext(block);
        while (tmp && tmp !== next) {
          const tn = this.blockNext(tmp);
          this.setBlockNext(tmp, 0);
          tmp = tn;
        }
        this.setBlockNext(block, next);
        res = true;
      }
      if (block + this.blockSize(block) >= this.top) {
        this.top = block;
        prev ? this.unlinkBlock(prev, block) : this._free = this.blockNext(block);
      }
      prev = block;
      block = this.blockNext(block);
    }
    return res;
  }
  /**
   * Inserts given block into list of free blocks, sorted by address.
   *
   * @param block -
   */
  insert(block) {
    let ptr = this._free;
    let prev = 0;
    while (ptr) {
      if (block <= ptr) break;
      prev = ptr;
      ptr = this.blockNext(ptr);
    }
    if (prev) {
      this.setBlockNext(prev, block);
    } else {
      this._free = block;
    }
    this.setBlockNext(block, ptr);
  }
};
var __blockDataAddress = (blockAddress) => blockAddress > 0 ? blockAddress + SIZEOF_MEM_BLOCK : 0;
var __blockSelfAddress = (dataAddress) => dataAddress > 0 ? dataAddress - SIZEOF_MEM_BLOCK : 0;

// clockwork/js/lib/growable_buffer_pool.js
var ALIGN = 8;
var PAGE_SIZE = 65536;
var GrowableBufferPool = class {
  /** @type {Array<{pool: MemPool, start: number, end: number, baseOffset: number}>} */
  #pools = [];
  #wasmMemory;
  #growIncrement;
  #growthCount = 0;
  #growing = false;
  #growFn;
  #onGrowth;
  #nextPoolStart;
  #maxEnd;
  /**
   * @param {object} options
   * @param {SharedArrayBuffer|ArrayBuffer} options.buf - backing buffer for initial pool
   * @param {number} options.start - byte offset for initial pool start
   * @param {number} options.size - byte size of initial pool
   * @param {WebAssembly.Memory|null} [options.wasmMemory] - for SAB mode growth
   * @param {number} options.maxSize - maximum total buffer pool capacity (bytes)
   * @param {number} [options.growIncrement=33554432] - bytes to grow per event (default 32MB)
   * @param {Function|null} [options.growFn] - async function(pages) for PM mode growth
   * @param {Function|null} [options.onGrowth] - callback({poolIndex, newBytes, totalCapacity})
   */
  constructor({ buf, start, size, wasmMemory = null, maxSize, growIncrement = 32 * 1024 * 1024, growFn = null, onGrowth = null }) {
    this.#wasmMemory = wasmMemory;
    this.#growIncrement = growIncrement;
    this.#growFn = growFn;
    this.#onGrowth = onGrowth;
    this.#nextPoolStart = start + size;
    this.#maxEnd = start + maxSize;
    this.#addPool(buf, start, size, 0);
  }
  /**
   * Allocate bytes from the pool chain.
   * Tries pools in reverse order (newest first, most likely to have space).
   * Returns 0 on failure (caller should try grow() then retry).
   */
  malloc(bytes) {
    for (let i = this.#pools.length - 1; i >= 0; i--) {
      const entry = this.#pools[i];
      const localPtr = entry.pool.malloc(bytes);
      if (localPtr !== 0) return localPtr + entry.baseOffset;
    }
    return 0;
  }
  /**
   * Free memory at the given pointer.
   * Routes to the correct pool by address range.
   */
  free(ptr) {
    for (const entry of this.#pools) {
      if (ptr >= entry.start && ptr < entry.end) {
        return entry.pool.free(ptr - entry.baseOffset);
      }
    }
    return false;
  }
  /**
   * Aggregate stats across all pools.
   */
  stats() {
    let freeCount = 0, freeSize = 0;
    let usedCount = 0, usedSize = 0;
    let available = 0, total = 0;
    let top = 0;
    for (const entry of this.#pools) {
      const s = entry.pool.stats();
      freeCount += s.free?.count || 0;
      freeSize += s.free?.size || 0;
      usedCount += s.used?.count || 0;
      usedSize += s.used?.size || 0;
      available += s.available || 0;
      total += s.total || 0;
      if (s.top > top) top = s.top;
    }
    return {
      free: { count: freeCount, size: freeSize },
      used: { count: usedCount, size: usedSize },
      top,
      available,
      total
    };
  }
  /** Whether the pool can grow (hasn't reached maximum). */
  canGrow() {
    return this.#nextPoolStart + ALIGN < this.#maxEnd;
  }
  /**
   * Grow the pool by extending WASM memory and creating a new MemPool segment.
   * @param {number} [minBytes=0] - minimum bytes needed (grow at least this much)
   * @returns {Promise<boolean>} true if growth succeeded
   */
  async grow(minBytes = 0) {
    if (this.#growing) return false;
    if (!this.canGrow()) return false;
    this.#growing = true;
    try {
      const remaining = this.#maxEnd - this.#nextPoolStart;
      const growBytes = Math.min(Math.max(this.#growIncrement, minBytes), remaining);
      if (growBytes < ALIGN) return false;
      const pages = Math.ceil(growBytes / PAGE_SIZE);
      const newStart = this.#nextPoolStart;
      const newSize = Math.min(pages * PAGE_SIZE, this.#maxEnd - newStart);
      let buf;
      if (this.#wasmMemory) {
        const result = this.#wasmMemory.grow(pages);
        if (result === -1) return false;
        buf = this.#wasmMemory.buffer;
      } else if (this.#growFn) {
        const success = await this.#growFn(pages);
        if (!success) return false;
        buf = new ArrayBuffer(newSize);
      } else {
        return false;
      }
      const baseOffset = this.#wasmMemory ? 0 : newStart;
      const poolStart = this.#wasmMemory ? newStart : 0;
      this.#addPool(buf, poolStart, newSize, baseOffset);
      this.#nextPoolStart = newStart + newSize;
      this.#growthCount++;
      if (this.#onGrowth) {
        this.#onGrowth({
          poolIndex: this.#pools.length - 1,
          newBytes: newSize,
          totalCapacity: this.totalCapacity
        });
      }
      return true;
    } finally {
      this.#growing = false;
    }
  }
  /** Number of pool segments */
  get poolCount() {
    return this.#pools.length;
  }
  /** Number of growth events */
  get growthCount() {
    return this.#growthCount;
  }
  /** Current committed capacity across all pools (bytes) */
  get totalCapacity() {
    let total = 0;
    for (const entry of this.#pools) {
      total += entry.end - entry.start;
    }
    return total;
  }
  /** Hard ceiling from config (bytes) */
  get maxCapacity() {
    return this.#maxEnd - this.#pools[0].start;
  }
  /** @private Create and register a MemPool for a memory region */
  #addPool(buf, start, size, baseOffset) {
    const pool = new MemPool({ buf, start, size, align: ALIGN });
    const wasmStart = start + baseOffset;
    this.#pools.push({ pool, start: wasmStart, end: wasmStart + size, baseOffset });
  }
};

// js/lib/aiff_converter.js
function isAiff(buffer) {
  if (buffer.byteLength < 12) {
    return false;
  }
  const view = new Uint8Array(buffer, 0, 12);
  const magic = String.fromCharCode(view[0], view[1], view[2], view[3]);
  const formType = String.fromCharCode(view[8], view[9], view[10], view[11]);
  return magic === "FORM" && (formType === "AIFF" || formType === "AIFC");
}
function parseFloat80(bytes) {
  const sign = bytes[0] >> 7 & 1;
  const exponent = (bytes[0] & 127) << 8 | bytes[1];
  let mantissa = 0;
  for (let i = 2; i < 10; i++) {
    mantissa = mantissa * 256 + bytes[i];
  }
  if (exponent === 0) {
    return 0;
  }
  const value = mantissa * Math.pow(2, exponent - 16383 - 63);
  return sign ? -value : value;
}
function findChunk(view, chunkId) {
  let offset = 12;
  while (offset < view.byteLength - 8) {
    const id = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const size = view.getUint32(offset + 4, false);
    if (id === chunkId) {
      return { offset: offset + 8, size };
    }
    offset += 8 + size + size % 2;
  }
  return null;
}
function aiffToWav(aiffBuffer) {
  const view = new DataView(aiffBuffer);
  const formType = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  const commChunk = findChunk(view, "COMM");
  if (!commChunk) {
    throw new Error("AIFF file missing COMM chunk");
  }
  const numChannels = view.getUint16(commChunk.offset, false);
  const numSampleFrames = view.getUint32(commChunk.offset + 2, false);
  const bitsPerSample = view.getUint16(commChunk.offset + 6, false);
  const sampleRateBytes = new Uint8Array(aiffBuffer, commChunk.offset + 8, 10);
  const sampleRate = parseFloat80(sampleRateBytes);
  if (formType === "AIFC") {
    if (commChunk.size >= 22) {
      const compressionType = String.fromCharCode(
        view.getUint8(commChunk.offset + 18),
        view.getUint8(commChunk.offset + 19),
        view.getUint8(commChunk.offset + 20),
        view.getUint8(commChunk.offset + 21)
      );
      if (compressionType !== "NONE" && compressionType !== "sowt") {
        throw new Error(`AIFC compression type '${compressionType}' is not supported. Only uncompressed AIFF/AIFC files are supported.`);
      }
      if (compressionType === "sowt") {
        return aiffSowtToWav(aiffBuffer, numChannels, numSampleFrames, bitsPerSample, sampleRate);
      }
    }
  }
  const { wavBuffer, wavBytes, srcBytes, audioDataSize, bytesPerSample, wavHeaderSize } = prepareWavFromAiff(aiffBuffer, numChannels, numSampleFrames, bitsPerSample, sampleRate);
  if (bytesPerSample === 1) {
    for (let i = 0; i < audioDataSize; i++) {
      wavBytes[wavHeaderSize + i] = srcBytes[i] + 128;
    }
  } else if (bytesPerSample === 2) {
    for (let i = 0; i < audioDataSize; i += 2) {
      wavBytes[wavHeaderSize + i] = srcBytes[i + 1];
      wavBytes[wavHeaderSize + i + 1] = srcBytes[i];
    }
  } else if (bytesPerSample === 3) {
    for (let i = 0; i < audioDataSize; i += 3) {
      wavBytes[wavHeaderSize + i] = srcBytes[i + 2];
      wavBytes[wavHeaderSize + i + 1] = srcBytes[i + 1];
      wavBytes[wavHeaderSize + i + 2] = srcBytes[i];
    }
  } else if (bytesPerSample === 4) {
    for (let i = 0; i < audioDataSize; i += 4) {
      wavBytes[wavHeaderSize + i] = srcBytes[i + 3];
      wavBytes[wavHeaderSize + i + 1] = srcBytes[i + 2];
      wavBytes[wavHeaderSize + i + 2] = srcBytes[i + 1];
      wavBytes[wavHeaderSize + i + 3] = srcBytes[i];
    }
  } else {
    throw new Error(`Unsupported bit depth: ${bitsPerSample}`);
  }
  return wavBuffer;
}
function prepareWavFromAiff(aiffBuffer, numChannels, numSampleFrames, bitsPerSample, sampleRate) {
  const view = new DataView(aiffBuffer);
  const ssndChunk = findChunk(view, "SSND");
  if (!ssndChunk) {
    throw new Error("AIFF file missing SSND chunk");
  }
  const ssndOffset = view.getUint32(ssndChunk.offset, false);
  const audioDataStart = ssndChunk.offset + 8 + ssndOffset;
  const bytesPerSample = bitsPerSample / 8;
  const audioDataSize = numSampleFrames * numChannels * bytesPerSample;
  if (audioDataStart + audioDataSize > aiffBuffer.byteLength) {
    throw new Error("AIFF file truncated: not enough audio data");
  }
  const wavHeaderSize = 44;
  const wavBuffer = new ArrayBuffer(wavHeaderSize + audioDataSize);
  const wavView = new DataView(wavBuffer);
  const wavBytes = new Uint8Array(wavBuffer);
  writeWavHeader(wavView, {
    numChannels,
    sampleRate: Math.round(sampleRate),
    bitsPerSample,
    dataSize: audioDataSize
  });
  const srcBytes = new Uint8Array(aiffBuffer, audioDataStart, audioDataSize);
  return { wavBuffer, wavBytes, srcBytes, audioDataSize, bytesPerSample, wavHeaderSize };
}
function aiffSowtToWav(aiffBuffer, numChannels, numSampleFrames, bitsPerSample, sampleRate) {
  const { wavBuffer, wavBytes, srcBytes, audioDataSize, bytesPerSample, wavHeaderSize } = prepareWavFromAiff(aiffBuffer, numChannels, numSampleFrames, bitsPerSample, sampleRate);
  if (bytesPerSample === 1) {
    for (let i = 0; i < audioDataSize; i++) {
      wavBytes[wavHeaderSize + i] = srcBytes[i] + 128;
    }
  } else {
    wavBytes.set(srcBytes, wavHeaderSize);
  }
  return wavBuffer;
}
function writeWavHeader(view, { numChannels, sampleRate, bitsPerSample, dataSize }) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  view.setUint8(0, 82);
  view.setUint8(1, 73);
  view.setUint8(2, 70);
  view.setUint8(3, 70);
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 87);
  view.setUint8(9, 65);
  view.setUint8(10, 86);
  view.setUint8(11, 69);
  view.setUint8(12, 102);
  view.setUint8(13, 109);
  view.setUint8(14, 116);
  view.setUint8(15, 32);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  view.setUint8(36, 100);
  view.setUint8(37, 97);
  view.setUint8(38, 116);
  view.setUint8(39, 97);
  view.setUint32(40, dataSize, true);
}

// js/lib/buffer_manager.js
var BufferManager = class {
  // Private configuration
  #mode;
  #sampleBaseURL;
  #assetLoader;
  // Private implementation
  #audioContext;
  #sharedBuffer;
  #clockwork;
  #wasmMemory;
  #bufferPool;
  #allocatedBuffers;
  #pendingBufferOps;
  #bufferLocks;
  // postMessage mode: worklet port for sending sample data
  constructor(options) {
    const {
      mode = "sab",
      audioContext,
      sharedBuffer,
      bufferPoolConfig,
      sampleBaseURL,
      maxBuffers = 1024,
      assetLoader = null,
      clockwork = null,
      wasmMemory = null,
      maxBufferMemory = null,
      bufferGrowIncrement = 32 * 1024 * 1024,
      onBufferPoolGrowth = null,
      growFn = null
    } = options;
    this.#mode = mode;
    if (!audioContext) {
      throw new Error("BufferManager requires audioContext");
    }
    if (mode === "sab") {
      if (!sharedBuffer || !(sharedBuffer instanceof SharedArrayBuffer)) {
        throw new Error("BufferManager requires sharedBuffer (SharedArrayBuffer) in SAB mode");
      }
      if (!bufferPoolConfig || typeof bufferPoolConfig !== "object") {
        throw new Error("BufferManager requires bufferPoolConfig (object with start, size, align)");
      }
      if (!Number.isFinite(bufferPoolConfig.start) || bufferPoolConfig.start < 0) {
        throw new Error("bufferPoolConfig.start must be a non-negative number");
      }
      if (!Number.isFinite(bufferPoolConfig.size) || bufferPoolConfig.size <= 0) {
        throw new Error("bufferPoolConfig.size must be a positive number");
      }
    }
    if (mode === "postMessage") {
      if (!bufferPoolConfig || typeof bufferPoolConfig !== "object") {
        throw new Error("BufferManager requires bufferPoolConfig in postMessage mode");
      }
    }
    if (!Number.isInteger(maxBuffers) || maxBuffers <= 0) {
      throw new Error("maxBuffers must be a positive integer");
    }
    this.#audioContext = audioContext;
    this.#sharedBuffer = sharedBuffer;
    this.#clockwork = clockwork;
    this.#wasmMemory = wasmMemory;
    this.#sampleBaseURL = sampleBaseURL;
    this.#assetLoader = assetLoader;
    const effectiveMaxSize = maxBufferMemory || bufferPoolConfig.maxSize || bufferPoolConfig.size;
    const buf = mode === "sab" ? sharedBuffer : new ArrayBuffer(bufferPoolConfig.start + bufferPoolConfig.size);
    this.#bufferPool = new GrowableBufferPool({
      buf,
      start: bufferPoolConfig.start,
      size: bufferPoolConfig.size,
      wasmMemory: mode === "sab" ? wasmMemory : null,
      maxSize: effectiveMaxSize,
      growIncrement: bufferGrowIncrement,
      // In SAB mode GrowableBufferPool grows the shared memory itself.
      // In postMessage mode only the worklet has a heap to grow, and
      // asking it is `growInbox` — the same call, whatever the mode.
      growFn: mode === "postMessage" ? growFn || ((pages) => clockwork.growInbox(pages * 65536)) : null,
      onGrowth: onBufferPoolGrowth
    });
    this.#allocatedBuffers = /* @__PURE__ */ new Map();
    this.#pendingBufferOps = /* @__PURE__ */ new Map();
    this.#bufferLocks = /* @__PURE__ */ new Map();
    this.GUARD_BEFORE = 3;
    this.GUARD_AFTER = 1;
    this.MAX_BUFFERS = maxBuffers;
    const poolSizeMB = (bufferPoolConfig.size / (1024 * 1024)).toFixed(0);
    const poolOffsetMB = (bufferPoolConfig.start / (1024 * 1024)).toFixed(0);
    if (true) console.log(`[Dbg-BufferManager] Initialized (${mode} mode): ${poolSizeMB}MB pool at offset ${poolOffsetMB}MB`);
  }
  /**
   * Hash a Float32Array via SHA-256, returning a hex string
   * @param {Float32Array} float32Array
   * @returns {Promise<string>} hex digest
   */
  async #hash(float32Array) {
    const buf = float32Array.byteOffset === 0 && float32Array.byteLength === float32Array.buffer.byteLength ? float32Array.buffer : float32Array.buffer.slice(float32Array.byteOffset, float32Array.byteOffset + float32Array.byteLength);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  /**
   * Fetch (if path) or convert source, decode audio, interleave with guard samples
   * @returns {Promise<{interleaved: Float32Array, numFrames: number, numChannels: number, sampleRate: number, sourceInfo: object|null}>}
   */
  async #fetchAndDecode({ source, startFrame = 0, numFrames = 0, channels = null }) {
    let arrayBuffer;
    let sourceInfo;
    if (typeof source === "string") {
      const resolvedPath = this.#resolveAudioPath(source);
      const sampleName = source.split("/").pop();
      arrayBuffer = await this.#assetLoader.fetch(resolvedPath, { type: "sample", name: sampleName });
      sourceInfo = { type: "file", path: source, startFrame, numFrames, channels };
    } else {
      arrayBuffer = source instanceof ArrayBuffer ? source : source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
      sourceInfo = null;
    }
    const audioBuffer = await this.#decodeAudioData(arrayBuffer);
    const start = Math.max(0, Math.floor(startFrame || 0));
    const availableFrames = audioBuffer.length - start;
    const framesRequested = numFrames && numFrames > 0 ? Math.min(Math.floor(numFrames), availableFrames) : availableFrames;
    if (framesRequested <= 0) {
      throw new Error(`No audio frames available`);
    }
    const selectedChannels = this.#normalizeChannels(channels, audioBuffer.numberOfChannels);
    const numCh = selectedChannels.length;
    const totalSamples = framesRequested * numCh + (this.GUARD_BEFORE + this.GUARD_AFTER) * numCh;
    const interleaved = new Float32Array(totalSamples);
    const dataOffset = this.GUARD_BEFORE * numCh;
    for (let frame = 0; frame < framesRequested; frame++) {
      for (let ch = 0; ch < numCh; ch++) {
        const channelData = audioBuffer.getChannelData(selectedChannels[ch]);
        interleaved[dataOffset + frame * numCh + ch] = channelData[start + frame];
      }
    }
    return { interleaved, numFrames: framesRequested, numChannels: numCh, sampleRate: audioBuffer.sampleRate, sourceInfo };
  }
  /**
   * Allocate memory and write interleaved data
   * @returns {Promise<number>} pointer
   */
  async #allocAndWrite(interleaved) {
    const ptr = await this.#malloc(interleaved.length);
    await this.#writeBufferData(ptr, interleaved);
    return ptr;
  }
  /**
   * Execute a buffer operation with parallel hashing
   * Wraps #executeBufferOperation, forking hash computation alongside malloc+write
   * @returns {Promise<Object>} Result with hash field added
   */
  async #executeBufferOperationWithHash(bufnum, timeoutMs, decoded, source) {
    let hash;
    const result = await this.#executeBufferOperation(bufnum, timeoutMs, async () => {
      const [hashResult, ptr] = await Promise.all([
        this.#hash(decoded.interleaved),
        this.#allocAndWrite(decoded.interleaved)
      ]);
      hash = hashResult;
      return {
        ptr,
        sizeBytes: decoded.interleaved.length * 4,
        numFrames: decoded.numFrames,
        numChannels: decoded.numChannels,
        sampleRate: decoded.sampleRate,
        source: source || null
      };
    });
    const entry = this.#allocatedBuffers.get(bufnum);
    if (entry) entry.hash = hash;
    return { ...result, hash };
  }
  /**
   * Decode audio data, converting AIFF to WAV if necessary
   * Web Audio API doesn't support AIFF, so we convert in-memory first
   * @param {ArrayBuffer} arrayBuffer - Raw audio file data
   * @returns {Promise<AudioBuffer>} Decoded audio buffer
   */
  async #decodeAudioData(arrayBuffer) {
    if (isAiff(arrayBuffer)) {
      if (true) console.log("[Dbg-BufferManager] Converting AIFF to WAV");
      arrayBuffer = aiffToWav(arrayBuffer);
    }
    return this.#audioContext.decodeAudioData(arrayBuffer);
  }
  /**
   * Set the worklet port for postMessage mode buffer operations
   * Must be called after AudioWorklet is initialized
   * @param {MessagePort} port - The worklet node's port
   */
  /*
   * setWorkletPort is gone. It existed so this class could post buffer
   * copies to the worklet itself; `clockwork.writeInbox` does that now and
   * owns the port. Callers that used to wire it up should delete the
   * call rather than replace it.
   */
  #resolveAudioPath(scPath) {
    if (typeof scPath !== "string" || scPath.length === 0) {
      throw new Error(`Invalid audio path: must be a non-empty string`);
    }
    if (scPath.includes("..")) {
      throw new Error(`Invalid audio path: path cannot contain '..' (got: ${scPath})`);
    }
    if (scPath.includes("%2e") || scPath.includes("%2E")) {
      throw new Error(`Invalid audio path: path cannot contain URL-encoded characters (got: ${scPath})`);
    }
    if (scPath.includes("\\")) {
      throw new Error(`Invalid audio path: use forward slashes only (got: ${scPath})`);
    }
    if (scPath.includes("://") || scPath.startsWith("/") || scPath.startsWith("./")) {
      return scPath;
    }
    if (!this.#sampleBaseURL) {
      throw new Error(
        'sampleBaseURL not configured. Please set it in SuperSonic constructor options.\nExample: new SuperSonic({ sampleBaseURL: "./dist/samples/" })\nOr use CDN: new SuperSonic({ sampleBaseURL: "https://unpkg.com/supersonic-scsynth-samples@latest/samples/" })\nOr install: npm install supersonic-scsynth-samples'
      );
    }
    return this.#sampleBaseURL + scPath;
  }
  #validateBufferNumber(bufnum) {
    if (!Number.isInteger(bufnum) || bufnum < 0 || bufnum >= this.MAX_BUFFERS) {
      throw new Error(`Invalid buffer number ${bufnum} (must be 0-${this.MAX_BUFFERS - 1})`);
    }
  }
  /**
   * Execute a buffer operation with proper locking, registration, and cleanup
   * @private
   * @param {number} bufnum - Buffer number
   * @param {number} timeoutMs - Operation timeout
   * @param {Function} operation - Async function that performs the actual buffer work
   *                                Should return {ptr, sizeBytes, ...extraProps}
   * @returns {Promise<Object>} Result object with ptr, uuid, allocationComplete, and extra props
   */
  async #executeBufferOperation(bufnum, timeoutMs, operation) {
    let allocatedPtr = null;
    let pendingToken = null;
    let allocationRegistered = false;
    const releaseLock = await this.#acquireBufferLock(bufnum);
    let lockReleased = false;
    try {
      await this.#awaitPendingReplacement(bufnum);
      const { ptr, sizeBytes, numFrames, numChannels, sampleRate, source, ...extraProps } = await operation();
      allocatedPtr = ptr;
      const { uuid, allocationComplete } = this.#registerPending(bufnum, timeoutMs);
      pendingToken = uuid;
      this.#recordAllocation(bufnum, allocatedPtr, sizeBytes, uuid, allocationComplete, {
        numFrames,
        numChannels,
        sampleRate,
        source
      });
      allocationRegistered = true;
      const managedCompletion = this.#attachFinalizer(bufnum, uuid, allocationComplete);
      releaseLock();
      lockReleased = true;
      return {
        ptr: allocatedPtr,
        // What /b_allocPtr carries: the position as an OFFSET from the
        // inbox base, never an address (dsp_api.h). The base is known
        // here and nowhere else, so this is the one place it is
        // subtracted; every sender reads this field.
        laneOffset: allocatedPtr - this.#clockwork.inbox().offset,
        uuid,
        allocationComplete: managedCompletion,
        numFrames,
        numChannels,
        sampleRate,
        ...extraProps
      };
    } catch (error) {
      if (allocationRegistered && pendingToken) {
        this.#finalizeReplacement(bufnum, pendingToken, false);
      } else if (allocatedPtr) {
        this.#bufferPool.free(allocatedPtr);
      }
      throw error;
    } finally {
      if (!lockReleased) {
        releaseLock();
      }
    }
  }
  async prepareFromBlob(params) {
    const { bufnum, blob, startFrame = 0, numFrames = 0, channels = null } = params;
    this.#validateBufferNumber(bufnum);
    if (!blob || !(blob instanceof ArrayBuffer || ArrayBuffer.isView(blob))) {
      throw new Error("/b_allocFile requires audio data as ArrayBuffer or typed array");
    }
    const decoded = await this.#fetchAndDecode({ source: blob, startFrame, numFrames, channels });
    return this.#executeBufferOperationWithHash(bufnum, 3e4, decoded, null);
  }
  async prepareFromFile(params) {
    const { bufnum, path, startFrame = 0, numFrames = 0, channels = null } = params;
    this.#validateBufferNumber(bufnum);
    const decoded = await this.#fetchAndDecode({ source: path, startFrame, numFrames, channels });
    return this.#executeBufferOperationWithHash(bufnum, 6e4, decoded, decoded.sourceInfo);
  }
  async prepareEmpty(params) {
    const { bufnum, numFrames, numChannels = 1, sampleRate = null } = params;
    this.#validateBufferNumber(bufnum);
    if (!Number.isFinite(numFrames) || numFrames <= 0) {
      throw new Error(`/b_alloc requires a positive number of frames (got ${numFrames})`);
    }
    if (!Number.isFinite(numChannels) || numChannels <= 0) {
      throw new Error(`/b_alloc requires a positive channel count (got ${numChannels})`);
    }
    const roundedFrames = Math.floor(numFrames);
    const roundedChannels = Math.floor(numChannels);
    const totalSamples = roundedFrames * roundedChannels + (this.GUARD_BEFORE + this.GUARD_AFTER) * roundedChannels;
    const interleaved = new Float32Array(totalSamples);
    const decoded = {
      interleaved,
      numFrames: roundedFrames,
      numChannels: roundedChannels,
      sampleRate: sampleRate || this.#audioContext.sampleRate
    };
    return this.#executeBufferOperationWithHash(bufnum, 5e3, decoded, null);
  }
  #normalizeChannels(requestedChannels, fileChannels) {
    if (!requestedChannels || requestedChannels.length === 0) {
      return Array.from({ length: fileChannels }, (_, i) => i);
    }
    requestedChannels.forEach((channel) => {
      if (!Number.isInteger(channel) || channel < 0 || channel >= fileChannels) {
        throw new Error(`Channel ${channel} is out of range (file has ${fileChannels} channels)`);
      }
    });
    return requestedChannels;
  }
  /** Try malloc, grow if needed, return pointer or 0 */
  async #mallocWithGrow(sizeBytes) {
    let ptr = this.#bufferPool.malloc(sizeBytes);
    if (ptr === 0 && this.#bufferPool.canGrow()) {
      if (await this.#bufferPool.grow(sizeBytes)) {
        ptr = this.#bufferPool.malloc(sizeBytes);
      }
    }
    return ptr;
  }
  async #malloc(totalSamples) {
    const bytesNeeded = totalSamples * 4;
    const ptr = await this.#mallocWithGrow(bytesNeeded);
    if (ptr === 0) {
      const stats = this.#bufferPool.stats();
      const availableMB = ((stats.available || 0) / (1024 * 1024)).toFixed(2);
      const totalMB = ((stats.total || 0) / (1024 * 1024)).toFixed(2);
      const maxMB = ((this.#bufferPool.maxCapacity || 0) / (1024 * 1024)).toFixed(2);
      const requestedMB = (bytesNeeded / (1024 * 1024)).toFixed(2);
      throw new Error(
        `Buffer pool allocation failed: requested ${requestedMB}MB, available ${availableMB}MB of ${totalMB}MB total (max ${maxMB}MB)`
      );
    }
    return ptr;
  }
  /**
   * Write frames into the guest's memory.
   *
   * TAU DOES THIS. It used to be forty lines here: a direct
   * SharedArrayBuffer write in SAB mode, and in postMessage mode a
   * transferable over the worklet port with its own copyId, handler and
   * ten-second timeout. That is not scsynth knowledge — it is "get bytes
   * into the guest's heap whichever way this browser allows" — and
   * clockwork owns it now, identically, for every guest.
   *
   * What stays here is everything about WHAT the bytes are: decoding,
   * interleaving, guard frames, the bufnum table. `ptr` came from this
   * class's own allocator over its slice of the INBOX — the lane the client
   * writes and the guest reads. The guest reads these frames IN PLACE for as
   * long as the buffer lives, which the lane's contract allows and which is
   * why nothing copies them anywhere.
   *
   * THE POINTER IS ABSOLUTE AND THIS CALL IS RELATIVE, so it is converted
   * here. The allocator hands out addresses into the whole SharedArrayBuffer
   * because that is what /b_allocPtr sends the guest — the guest
   * dereferences it. writeInbox takes an offset from the base of the region
   * instead, so that a caller cannot name memory outside it. Passing the
   * absolute address straight through made every buffer write fail its
   * range check with a number 58MB too large.
   */
  async #writeBufferData(ptr, data) {
    const base = this.#clockwork.inbox().offset;
    await this.#clockwork.writeInbox(ptr - base, data);
  }
  #createPendingOperation(uuid, bufnum, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pendingBufferOps.delete(uuid);
        reject(new Error(`Buffer ${bufnum} allocation timeout (${timeoutMs}ms)`));
      }, timeoutMs);
      this.#pendingBufferOps.set(uuid, { resolve, reject, timeout });
    });
  }
  #registerPending(bufnum, timeoutMs) {
    const uuid = crypto.randomUUID();
    const allocationComplete = this.#createPendingOperation(uuid, bufnum, timeoutMs);
    return { uuid, allocationComplete };
  }
  async #acquireBufferLock(bufnum) {
    const prev = this.#bufferLocks.get(bufnum) || Promise.resolve();
    let releaseLock;
    const current = new Promise((resolve) => {
      releaseLock = resolve;
    });
    this.#bufferLocks.set(bufnum, prev.then(() => current));
    await prev;
    return () => {
      if (releaseLock) {
        releaseLock();
        releaseLock = null;
      }
      if (this.#bufferLocks.get(bufnum) === current) {
        this.#bufferLocks.delete(bufnum);
      }
    };
  }
  #recordAllocation(bufnum, ptr, sizeBytes, pendingToken, pendingPromise, metadata = {}) {
    const previousEntry = this.#allocatedBuffers.get(bufnum);
    const entry = {
      ptr,
      size: sizeBytes,
      numFrames: metadata.numFrames || 0,
      numChannels: metadata.numChannels || 1,
      sampleRate: metadata.sampleRate || 48e3,
      pendingToken,
      pendingPromise,
      previousAllocation: previousEntry ? { ptr: previousEntry.ptr, size: previousEntry.size } : null,
      // postMessage mode: keep source info for recovery (re-load from path)
      // SAB mode: data persists in SharedArrayBuffer, only need /b_allocPtr
      source: metadata.source || null
    };
    this.#allocatedBuffers.set(bufnum, entry);
    return entry;
  }
  async #awaitPendingReplacement(bufnum) {
    const existing = this.#allocatedBuffers.get(bufnum);
    if (existing && existing.pendingToken && existing.pendingPromise) {
      try {
        await existing.pendingPromise;
      } catch {
      }
    }
  }
  #attachFinalizer(bufnum, pendingToken, promise) {
    if (!promise || typeof promise.then !== "function") {
      this.#finalizeReplacement(bufnum, pendingToken, true);
      return Promise.resolve();
    }
    return promise.then((value) => {
      this.#finalizeReplacement(bufnum, pendingToken, true);
      return value;
    }).catch((error) => {
      this.#finalizeReplacement(bufnum, pendingToken, false);
      throw error;
    });
  }
  #finalizeReplacement(bufnum, pendingToken, success) {
    const entry = this.#allocatedBuffers.get(bufnum);
    if (!entry || entry.pendingToken !== pendingToken) {
      return;
    }
    const previous = entry.previousAllocation;
    if (success) {
      entry.pendingToken = null;
      entry.pendingPromise = null;
      entry.previousAllocation = null;
      if (previous?.ptr) {
        this.#bufferPool.free(previous.ptr);
      }
      return;
    }
    if (entry.ptr) {
      this.#bufferPool.free(entry.ptr);
    }
    entry.pendingPromise = null;
    if (previous?.ptr) {
      this.#allocatedBuffers.set(bufnum, {
        ptr: previous.ptr,
        size: previous.size,
        pendingToken: null,
        previousAllocation: null
      });
    } else {
      this.#allocatedBuffers.delete(bufnum);
    }
  }
  /**
   * Handle /buffer/freed notification from scsynth
   * Called by SuperSonic when /buffer/freed OSC message is received
   * @param {Array} args - [bufnum, freedPtr]
   */
  handleBufferFreed(args) {
    const bufnum = typeof args[0] === "bigint" ? Number(args[0]) : args[0];
    const freedPtr = typeof args[1] === "bigint" ? Number(args[1]) : args[1];
    const bufferInfo = this.#allocatedBuffers.get(bufnum);
    if (!bufferInfo) {
      if (typeof freedPtr === "number" && freedPtr !== 0) {
        this.#bufferPool.free(freedPtr);
      }
      return;
    }
    if (typeof freedPtr === "number" && freedPtr === bufferInfo.ptr) {
      this.#bufferPool.free(bufferInfo.ptr);
      this.#allocatedBuffers.delete(bufnum);
      return;
    }
    if (typeof freedPtr === "number" && bufferInfo.previousAllocation && bufferInfo.previousAllocation.ptr === freedPtr) {
      this.#bufferPool.free(freedPtr);
      bufferInfo.previousAllocation = null;
      return;
    }
    this.#bufferPool.free(bufferInfo.ptr);
    this.#allocatedBuffers.delete(bufnum);
  }
  /**
   * Handle /buffer/allocated notification from scsynth
   * Called by SuperSonic when /buffer/allocated OSC message is received
   * @param {Array} args - [uuid, bufnum]
   */
  handleBufferAllocated(args) {
    const uuid = args[0];
    const bufnum = args[1];
    const pending = this.#pendingBufferOps.get(uuid);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve({ bufnum });
      this.#pendingBufferOps.delete(uuid);
    }
  }
  /**
   * Allocate raw buffer memory
   * @param {number} numSamples - Number of Float32 samples
   * @returns {Promise<number>} Byte offset, or 0 if failed
   */
  async allocate(numSamples) {
    return this.#mallocWithGrow(numSamples * 4);
  }
  /**
   * Free previously allocated buffer
   * @param {number} addr - Buffer address
   * @returns {boolean} true if freed successfully
   */
  free(addr) {
    return this.#bufferPool.free(addr);
  }
  /**
   * Get Float32Array view of buffer
   * @param {number} addr - Buffer address
   * @param {number} numSamples - Number of samples
   * @returns {Float32Array} Typed array view
   */
  getView(addr, numSamples) {
    const buf = this.#wasmMemory?.buffer || this.#sharedBuffer;
    return new Float32Array(buf, addr, numSamples);
  }
  /**
   * Get buffer pool statistics
   * @returns {Object} Stats including total, available, used
   */
  getStats() {
    if (!this.#bufferPool) {
      return { total: 0, available: 0, used: 0, allocations: 0 };
    }
    return this.#bufferPool.stats();
  }
  /**
   * Get buffer pool growth statistics
   * @returns {Object} Growth-specific stats
   */
  getGrowthStats() {
    if (!this.#bufferPool) {
      return { totalCapacity: 0, maxCapacity: 0, growthCount: 0, poolCount: 0 };
    }
    return {
      totalCapacity: this.#bufferPool.totalCapacity,
      maxCapacity: this.#bufferPool.maxCapacity,
      growthCount: this.#bufferPool.growthCount,
      poolCount: this.#bufferPool.poolCount
    };
  }
  /**
   * Get sample info (including content hash) without allocating a buffer
   * @param {Object} params - { source, startFrame, numFrames, channels }
   * @returns {Promise<{hash, source, numFrames, numChannels, sampleRate, duration}>}
   */
  async sampleInfo({ source, startFrame = 0, numFrames = 0, channels = null }) {
    const decoded = await this.#fetchAndDecode({ source, startFrame, numFrames, channels });
    const hash = await this.#hash(decoded.interleaved);
    return {
      hash,
      source: decoded.sourceInfo?.path || null,
      numFrames: decoded.numFrames,
      numChannels: decoded.numChannels,
      sampleRate: decoded.sampleRate,
      duration: decoded.sampleRate > 0 ? decoded.numFrames / decoded.sampleRate : 0
    };
  }
  /**
   * Get all allocated buffers for recovery
   * SAB mode: returns info needed to re-send /b_allocPtr (data persists in SAB)
   * postMessage mode: returns source info for re-loading (WASM memory destroyed)
   * @returns {Array<{bufnum, ptr, numFrames, numChannels, sampleRate, source?}>}
   */
  getAllocatedBuffers() {
    const buffers = [];
    for (const [bufnum, entry] of this.#allocatedBuffers.entries()) {
      if (!entry || !entry.ptr) continue;
      buffers.push({
        bufnum,
        ptr: entry.ptr,
        laneOffset: entry.ptr - this.#clockwork.inbox().offset,
        numFrames: entry.numFrames,
        numChannels: entry.numChannels,
        sampleRate: entry.sampleRate,
        source: entry.source || null,
        hash: entry.hash || null
      });
    }
    return buffers;
  }
  /**
   * Update the AudioContext reference after reload
   * Called by SuperSonic during #partialInit() when AudioContext is recreated
   * @param {AudioContext} audioContext - New AudioContext instance
   */
  updateAudioContext(audioContext) {
    if (!audioContext) {
      throw new Error("BufferManager.updateAudioContext requires audioContext");
    }
    this.#audioContext = audioContext;
    if (true) console.log("[Dbg-BufferManager] AudioContext updated");
  }
  /**
   * Clean up resources
   */
  destroy() {
    for (const [uuid, pending] of this.#pendingBufferOps.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("BufferManager destroyed"));
    }
    this.#pendingBufferOps.clear();
    for (const [bufnum, entry] of this.#allocatedBuffers.entries()) {
      if (entry.ptr) {
        this.#bufferPool.free(entry.ptr);
      }
    }
    this.#allocatedBuffers.clear();
    this.#bufferLocks.clear();
    if (true) console.log("[Dbg-BufferManager] Destroyed");
  }
};

// js/lib/osc_rewriter.js
var OSCRewriter = class {
  #bufferManager;
  #getDefaultSampleRate;
  /**
   * @param {Object} options
   * @param {Object} options.bufferManager - BufferManager instance for buffer operations
   * @param {Function} options.getDefaultSampleRate - Callback returning default sample rate
   */
  constructor({ bufferManager, getDefaultSampleRate }) {
    if (!bufferManager) {
      throw new Error("OSCRewriter requires bufferManager");
    }
    if (typeof getDefaultSampleRate !== "function") {
      throw new Error("OSCRewriter requires getDefaultSampleRate callback");
    }
    this.#bufferManager = bufferManager;
    this.#getDefaultSampleRate = getDefaultSampleRate;
  }
  /**
   * Rewrite an OSC packet (message or bundle), transforming buffer commands
   * @param {Object} packet - Decoded OSC packet
   * @returns {Promise<{packet: Object, changed: boolean}>}
   */
  async rewritePacket(packet) {
    if (Array.isArray(packet)) {
      const { message, changed } = await this.#rewriteMessage(packet);
      return { packet: message, changed };
    }
    if (this.#isBundle(packet)) {
      const subResults = await Promise.all(
        packet.packets.map((subPacket) => this.rewritePacket(subPacket))
      );
      const changed = subResults.some((result) => result.changed);
      if (!changed) {
        return { packet, changed: false };
      }
      const rewrittenPackets = subResults.map((result) => result.packet);
      return {
        packet: {
          timeTag: packet.timeTag,
          packets: rewrittenPackets
        },
        changed: true
      };
    }
    return { packet, changed: false };
  }
  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================
  async #rewriteMessage(message) {
    const address = message[0];
    const args = message.slice(1);
    switch (address) {
      case "/b_alloc":
        return {
          message: await this.#rewriteAlloc(args),
          changed: true
        };
      case "/b_allocRead":
        return {
          message: await this.#rewriteAllocRead(args),
          changed: true
        };
      case "/b_allocReadChannel":
        return {
          message: await this.#rewriteAllocReadChannel(args),
          changed: true
        };
      case "/b_allocFile":
        return {
          message: await this.#rewriteAllocFile(args),
          changed: true
        };
      default:
        return { message, changed: false };
    }
  }
  async #rewriteAlloc(args) {
    const bufnum = this.#requireIntArg(
      args,
      0,
      "/b_alloc requires a buffer number"
    );
    const numFrames = this.#requireIntArg(
      args,
      1,
      "/b_alloc requires a frame count"
    );
    let argIndex = 2;
    let numChannels = 1;
    let sampleRate = this.#getDefaultSampleRate();
    if (Number.isFinite(this.#val(args, argIndex))) {
      numChannels = Math.max(1, this.#optionalIntArg(args, argIndex, 1));
      argIndex++;
    }
    if ((Array.isArray(args) ? args[argIndex] : void 0)?.type === "b") {
      if (true) console.warn("[OSCRewriter] /b_alloc completion message detected but not supported \u2014 it will be dropped. Buffer allocation is async via the buffer pipeline.");
      argIndex++;
    }
    const srVal = this.#val(args, argIndex);
    if (Number.isFinite(srVal)) {
      sampleRate = srVal;
    }
    const bufferInfo = await this.#bufferManager.prepareEmpty({
      bufnum,
      numFrames,
      numChannels,
      sampleRate
    });
    this.#detachAllocationPromise(
      bufferInfo.allocationComplete,
      `/b_alloc ${bufnum}`
    );
    return this.#buildAllocPtrMessage(bufnum, bufferInfo);
  }
  async #rewriteAllocRead(args) {
    const bufnum = this.#requireIntArg(
      args,
      0,
      "/b_allocRead requires a buffer number"
    );
    const path = this.#requireStringArg(
      args,
      1,
      "/b_allocRead requires a file path"
    );
    const startFrame = this.#optionalIntArg(args, 2, 0);
    const numFrames = this.#optionalIntArg(args, 3, 0);
    const bufferInfo = await this.#bufferManager.prepareFromFile({
      bufnum,
      path,
      startFrame,
      numFrames
    });
    this.#detachAllocationPromise(
      bufferInfo.allocationComplete,
      `/b_allocRead ${bufnum}`
    );
    return this.#buildAllocPtrMessage(bufnum, bufferInfo);
  }
  async #rewriteAllocReadChannel(args) {
    const bufnum = this.#requireIntArg(
      args,
      0,
      "/b_allocReadChannel requires a buffer number"
    );
    const path = this.#requireStringArg(
      args,
      1,
      "/b_allocReadChannel requires a file path"
    );
    const startFrame = this.#optionalIntArg(args, 2, 0);
    const numFrames = this.#optionalIntArg(args, 3, 0);
    const channels = [];
    for (let i = 4; i < (args?.length || 0); i++) {
      const v = this.#val(args, i);
      if (!Number.isFinite(v)) break;
      channels.push(Math.floor(v));
    }
    const bufferInfo = await this.#bufferManager.prepareFromFile({
      bufnum,
      path,
      startFrame,
      numFrames,
      channels: channels.length > 0 ? channels : null
    });
    this.#detachAllocationPromise(
      bufferInfo.allocationComplete,
      `/b_allocReadChannel ${bufnum}`
    );
    return this.#buildAllocPtrMessage(bufnum, bufferInfo);
  }
  /**
   * Handle /b_allocFile - SuperSonic extension (not standard scsynth OSC)
   * Loads audio from inline file data (FLAC, WAV, OGG, etc.) without URL fetch.
   */
  async #rewriteAllocFile(args) {
    const bufnum = this.#requireIntArg(
      args,
      0,
      "/b_allocFile requires a buffer number"
    );
    const blob = this.#requireBlobArg(
      args,
      1,
      "/b_allocFile requires audio file data as blob"
    );
    const bufferInfo = await this.#bufferManager.prepareFromBlob({
      bufnum,
      blob
    });
    this.#detachAllocationPromise(
      bufferInfo.allocationComplete,
      `/b_allocFile ${bufnum}`
    );
    return this.#buildAllocPtrMessage(bufnum, bufferInfo);
  }
  #buildAllocPtrMessage(bufnum, bufferInfo) {
    return [
      "/b_allocPtr",
      Math.floor(bufnum),
      Math.floor(bufferInfo.laneOffset),
      // an offset into the inbox, not an address
      Math.floor(bufferInfo.numFrames),
      Math.floor(bufferInfo.numChannels),
      bufferInfo.sampleRate,
      String(bufferInfo.uuid)
    ];
  }
  #isBundle(packet) {
    return packet && packet.timeTag !== void 0 && Array.isArray(packet.packets);
  }
  // ============================================================================
  // ARGUMENT HELPERS
  // ============================================================================
  /** Get the raw value of an arg (supports plain values and legacy {type, value} format) */
  #val(args, index) {
    const arg = Array.isArray(args) ? args[index] : void 0;
    if (arg === void 0 || arg === null) return void 0;
    return typeof arg === "object" && Object.prototype.hasOwnProperty.call(arg, "value") ? arg.value : arg;
  }
  /** Require an arg of a given type, throwing errorMessage if missing/wrong */
  #require(args, index, check, errorMessage) {
    const v = this.#val(args, index);
    if (!check(v)) throw new Error(errorMessage);
    return v;
  }
  #requireIntArg(args, index, errorMessage) {
    return Math.floor(this.#require(args, index, Number.isFinite, errorMessage));
  }
  #optionalIntArg(args, index, defaultValue = 0) {
    const v = this.#val(args, index);
    return Number.isFinite(v) ? Math.floor(v) : defaultValue;
  }
  #requireStringArg(args, index, errorMessage) {
    return this.#require(args, index, (v) => typeof v === "string", errorMessage);
  }
  #requireBlobArg(args, index, errorMessage) {
    return this.#require(args, index, (v) => v instanceof Uint8Array || v instanceof ArrayBuffer, errorMessage);
  }
  #detachAllocationPromise(promise, context) {
    if (!promise || typeof promise.catch !== "function") {
      return;
    }
    promise.catch((error) => {
      console.error(`[OSCRewriter] ${context} allocation failed:`, error);
    });
  }
};

// js/lib/synthdef_parser.js
function extractSynthDefName(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const lastSegment = input.split("/").filter(Boolean).pop() || input;
    return lastSegment.replace(/\.scsyndef$/i, "");
  }
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;
  if (!(bytes instanceof Uint8Array) || bytes.length < 11) return null;
  if (bytes[0] !== 83 || bytes[1] !== 67 || bytes[2] !== 103 || bytes[3] !== 102) {
    return null;
  }
  const version = bytes[4] << 24 | bytes[5] << 16 | bytes[6] << 8 | bytes[7];
  const nameOffset = version >= 3 ? 14 : 10;
  if (nameOffset >= bytes.length) return null;
  const nameLen = bytes[nameOffset];
  if (nameLen === 0 || nameOffset + 1 + nameLen > bytes.length) return null;
  try {
    return new TextDecoder().decode(bytes.slice(nameOffset + 1, nameOffset + 1 + nameLen));
  } catch {
    return null;
  }
}

// js/scsynth_profile.js
var scsynthProfile = Object.freeze({
  defineVerb: "/d_recv",
  nameOf: extractSynthDefName,
  forgetVerb: "/d_free",
  forgetAllVerb: "/d_freeAll",
  syncVerb: "/sync",
  syncedVerb: "/synced",
  /*
   * Verbs the engine would take literally, refused client-side.
   *
   * Each names a file or a scheduler the browser does not have, or a setting
   * this product deliberately fixes. Refusing them here, with the alternative
   * in the message, is better than letting them reach an engine that will
   * either fail obscurely or quietly do nothing.
   */
  blockedVerbs: Object.freeze({
    "/d_load": "Use loadSynthDef() or send /d_recv with synthdef bytes instead.",
    "/d_loadDir": "Use loadSynthDef() or send /d_recv with synthdef bytes instead.",
    "/b_read": "Use loadSample() to load audio into a buffer.",
    "/b_readChannel": "Use loadSample() to load audio into a buffer.",
    "/b_write": "Writing audio files is not available in the browser.",
    "/b_close": "Writing audio files is not available in the browser.",
    "/clearSched": "Use purge() to clear both the JS prescheduler and WASM scheduler.",
    "/error": "SuperSonic always enables error notifications so you never miss a /fail message."
  }),
  /*
   * What scsynth exposes that clockwork cannot name.
   *
   * Its sample buffer pool: how much is in it, how much is left, how often it
   * has had to grow. These sat at fixed offsets in clockwork's own metrics
   * files until 2026-08-31, which meant a guest with different numbers — and
   * clockwork-vm's are entirely different — could not report them at all.
   *
   * `slot` is an index into the reserved guest range, not an absolute offset.
   */
  metrics: {
    bufferPoolUsedBytes: {
      slot: 0,
      type: "u32",
      unit: "bytes",
      description: "sample buffer pool bytes in use"
    },
    bufferPoolAvailableBytes: {
      slot: 1,
      type: "u32",
      unit: "bytes",
      description: "sample buffer pool bytes free"
    },
    bufferPoolAllocations: {
      slot: 2,
      type: "u32",
      description: "buffers currently allocated"
    },
    bufferPoolTotalCapacity: {
      slot: 3,
      type: "u32",
      unit: "bytes",
      description: "committed capacity across all pool segments"
    },
    bufferPoolMaxCapacity: {
      slot: 4,
      type: "u32",
      unit: "bytes",
      description: "hard ceiling the pool may grow to"
    },
    bufferPoolGrowthCount: {
      slot: 5,
      type: "u32",
      description: "times the pool has grown"
    },
    bufferPoolPoolCount: {
      slot: 6,
      type: "u32",
      description: "pool segments; 1 means it has never grown"
    },
    loadedSynthDefs: {
      slot: 7,
      type: "u32",
      description: "definitions this client holds, and will replay after a reload"
    }
  },
  /*
   * Where those numbers appear in the metrics UI.
   *
   * clockwork's static layout carried this panel until 2026-08-31, which
   * meant a shared layout naming one guest's counters — and a guest with no
   * sample pool got four rows that could only ever read zero. A panel is a
   * claim about what a guest HAS, so it travels with the declaration.
   */
  metricsPanels: [
    {
      title: "Buffers & SynthDefs",
      rows: [
        { label: "buf used", cells: [{ key: "bufferPoolUsedBytes", format: "bytes" }] },
        { label: "buf free", cells: [{ key: "bufferPoolAvailableBytes", kind: "green", format: "bytes" }] },
        { label: "buf allocs", cells: [{ key: "bufferPoolAllocations", kind: "dim" }] },
        { label: "synthdefs", cells: [{ key: "loadedSynthDefs" }] }
      ]
    }
  ]
});

// js/lib/node_tree_parser.js
var NODE_TREE_HEADER_SIZE = 16;
var NODE_TREE_ENTRY_SIZE = 96;
var NODE_TREE_DEF_NAME_SIZE = 32;
function parseNodeTree(buffer, treeOffset, windowBytes) {
  const headerView = new Uint32Array(buffer, treeOffset, 3);
  const version = headerView[0];
  const nodeCount = headerView[1];
  const droppedCount = headerView[2];
  const entriesBase = treeOffset + NODE_TREE_HEADER_SIZE;
  const maxNodes = Math.floor((windowBytes - NODE_TREE_HEADER_SIZE) / NODE_TREE_ENTRY_SIZE);
  const entrySize = NODE_TREE_ENTRY_SIZE;
  const defNameSize = NODE_TREE_DEF_NAME_SIZE;
  const dataView = new DataView(buffer, entriesBase, maxNodes * entrySize);
  const textDecoder2 = new TextDecoder("utf-8");
  const nodes = [];
  let foundCount = 0;
  for (let i = 0; i < maxNodes && foundCount < nodeCount; i++) {
    const byteOffset = i * entrySize;
    const id = dataView.getInt32(byteOffset, true);
    if (id === -1) continue;
    foundCount++;
    const defNameStart = entriesBase + byteOffset + 24;
    const defNameView = new Uint8Array(buffer, defNameStart, defNameSize);
    const defNameBytes = new Uint8Array(defNameSize);
    defNameBytes.set(defNameView);
    let nullIndex = defNameBytes.indexOf(0);
    if (nullIndex === -1) nullIndex = defNameSize;
    const defName = textDecoder2.decode(defNameBytes.subarray(0, nullIndex));
    const uuidStart = entriesBase + byteOffset + 56;
    const uuidRaw = new Uint8Array(buffer, uuidStart, 16);
    let hasUuid = false;
    for (let j = 0; j < 16; j++) {
      if (uuidRaw[j] !== 0) {
        hasUuid = true;
        break;
      }
    }
    let uuid = null;
    if (hasUuid) {
      uuid = new Uint8Array(16);
      for (let j = 0; j < 8; j++) {
        uuid[j] = uuidRaw[7 - j];
      }
      for (let j = 0; j < 8; j++) {
        uuid[8 + j] = uuidRaw[15 - j];
      }
    }
    const node = {
      // INT32_MIN marks a real row with no compat alias — a clockwork-API
      // process the engine surface cannot address. -1 stays the
      // empty-slot sentinel, skipped above.
      id: id === -2147483648 ? null : id,
      parentId: dataView.getInt32(byteOffset + 4, true),
      isGroup: dataView.getInt32(byteOffset + 8, true) === 1,
      prevId: dataView.getInt32(byteOffset + 12, true),
      nextId: dataView.getInt32(byteOffset + 16, true),
      headId: dataView.getInt32(byteOffset + 20, true),
      defName,
      uuid
    };
    if (entrySize >= 96) {
      const parentUuidRaw = new Uint8Array(buffer, entriesBase + byteOffset + 72, 16);
      let hasParent = false;
      for (let j = 0; j < 16; j++) {
        if (parentUuidRaw[j] !== 0) {
          hasParent = true;
          break;
        }
      }
      let parentUuid = null;
      if (hasParent) {
        parentUuid = new Uint8Array(16);
        for (let j = 0; j < 8; j++) {
          parentUuid[j] = parentUuidRaw[7 - j];
        }
        for (let j = 0; j < 8; j++) {
          parentUuid[8 + j] = parentUuidRaw[15 - j];
        }
      }
      node.parentUuid = parentUuid;
      node.outPeak = dataView.getFloat32(byteOffset + 88, true);
      node.synthCount = dataView.getUint16(byteOffset + 92, true);
      node.listens = dataView.getUint8(byteOffset + 94) === 1;
    }
    nodes.push(node);
  }
  return { nodeCount, version, droppedCount, nodes };
}

// js/scsynth_options.js
var defaultScsynthOptions = {
  /**
   * Maximum number of audio buffers (SndBuf slots)
   * Each buffer slot: 104 bytes overhead (2x SndBuf + SndBufUpdates structs)
   * Actual audio data is stored in buffer pool (separate from heap)
   * Default: 1024 (matching SuperCollider default)
   * Range: 1-65535 (limited by practical memory constraints)
   */
  numBuffers: 1024,
  /**
   * Maximum number of synthesis nodes (synths + groups)
   * Each node: ~200-500 bytes depending on synth complexity
   * Default: 1024 (matching SuperCollider default)
   */
  maxNodes: 8192,
  /**
   * Maximum number of synth definitions (SynthDef count)
   * Each definition: variable size (typically 1-10KB)
   * Default: 1024 (matching SuperCollider default)
   */
  maxGraphDefs: 1024,
  /**
   * Maximum wire buffers for internal audio routing
   * Wire buffers: temporary buffers for UGen connections
   * Each: bufLength * sizeof(float) bytes (128 samples * 4 = 512 bytes)
   * Default: 64 (matching SuperCollider default)
   */
  maxWireBufs: 64,
  /**
   * Number of audio bus channels
   * Audio buses: real-time audio routing between synths
   * Memory: bufLength * numChannels * 4 bytes (128 * 128 * 4 = 64KB)
   * Default: 128 (clockwork default, SC uses 1024)
   */
  numAudioBusChannels: 128,
  /**
   * Number of input bus channels (hardware audio input)
   * Allocates space for up to N input channels from AudioContext
   * Actual channels used depends on hardware (worklet copies min(N, actual))
   * Default: 2 (stereo)
   */
  numInputBusChannels: 2,
  /**
   * Number of output bus channels (hardware audio output)
   * Allocates space for up to N output channels to AudioContext
   * Actual channels used depends on hardware (worklet copies min(N, actual))
   * Default: 2 (stereo)
   */
  numOutputBusChannels: 2,
  /**
   * Number of control bus channels
   * Control buses: control-rate data sharing between synths
   * Memory: numChannels * 4 bytes (4096 * 4 = 16KB)
   * Default: 4096 (clockwork default, SC uses 16384)
   */
  numControlBusChannels: 4096,
  /**
   * Audio buffer length in samples (AudioWorklet quantum)
   *
   * FIXED at 128 (WebAudio API spec - cannot be changed)
   * Unlike SuperCollider (configurable 32/64/128), AudioWorklet has a fixed quantum.
   * Overriding this value will cause initialization to fail.
   *
   * Default: 128
   */
  bufLength: 128,
  /**
   * Real-time memory pool size in kilobytes
   * AllocPool for synthesis-time allocations (UGen memory, etc.)
   * This is the largest single allocation from WASM heap
   * Memory: realTimeMemorySize * 1024 bytes (8192 * 1024 = 8MB)
   * Default: 8192 KB (8MB, matching Sonic Pi and SuperCollider defaults)
   */
  realTimeMemorySize: 8192,
  /**
   * Number of random number generators
   * Each synth can have its own RNG for reproducible randomness
   * Default: 64 (matching SuperCollider default)
   */
  numRGens: 64,
  /**
   * Clock source mode
   * false = Externally clocked (driven by AudioWorklet process() callback)
   * true = Internally clocked (not applicable in WebAudio context)
   * Note: In SC terminology, this is "NRT mode" but we're still doing real-time audio
   * Default: false (clockwork is always externally clocked by AudioWorklet)
   */
  realTime: false,
  /**
   * Memory locking (mlock)
   * Not applicable in WebAssembly/browser environment
   * Default: false
   */
  memoryLocking: false,
  /**
   * Auto-load SynthDefs from disk
   * 0 = don't auto-load (synths sent via /d_recv)
   * 1 = auto-load from plugin path
   * Default: 0 (clockwork loads synthdefs via network)
   */
  loadGraphDefs: 0,
  /**
   * Preferred sample rate (if not specified, uses AudioContext.sampleRate)
   * Common values: 44100, 48000, 96000
   * Default: 0 (use AudioContext default, typically 48000)
   */
  preferredSampleRate: 0,
  /**
   * Debug verbosity level
   * 0 = normal (default), 1+ = increasingly verbose. SC uses negative values for quieter modes but clockwork clamps to 0-4.
   * Default: 0
   */
  verbosity: 0
};
function validateScsynthOptions(opts) {
  const numericRules = [
    ["numBuffers", 1, 65535],
    ["maxNodes", 1],
    ["maxGraphDefs", 1],
    ["maxWireBufs", 1],
    ["numAudioBusChannels", 1],
    ["numInputBusChannels", 0],
    ["numOutputBusChannels", 1, 128],
    ["numControlBusChannels", 1],
    ["realTimeMemorySize", 1],
    ["numRGens", 1],
    ["preferredSampleRate", 0, 384e3],
    ["verbosity", 0, 4]
  ];
  for (const [name, min, max] of numericRules) {
    const v = opts[name];
    if (typeof v !== "number" || !Number.isFinite(v)) {
      throw new Error(`scsynthOptions.${name} must be a finite number, got: ${v}`);
    }
    if (v < min) throw new Error(`scsynthOptions.${name} must be >= ${min}, got: ${v}`);
    if (max !== void 0 && v > max) {
      throw new Error(`scsynthOptions.${name} must be <= ${max}, got: ${v}`);
    }
  }
  if (opts.bufLength !== 128) {
    throw new Error(
      `scsynthOptions.bufLength must be 128 (WebAudio API constraint), got: ${opts.bufLength}`
    );
  }
  for (const name of ["realTime", "memoryLocking"]) {
    if (typeof opts[name] !== "boolean") {
      throw new Error(`scsynthOptions.${name} must be a boolean, got: ${typeof opts[name]}`);
    }
  }
  if (opts.loadGraphDefs !== 0 && opts.loadGraphDefs !== 1) {
    throw new Error(`scsynthOptions.loadGraphDefs must be 0 or 1, got: ${opts.loadGraphDefs}`);
  }
  if (opts.preferredSampleRate !== 0 && opts.preferredSampleRate < 8e3) {
    throw new Error(
      `scsynthOptions.preferredSampleRate must be 0 (auto) or >= 8000, got: ${opts.preferredSampleRate}`
    );
  }
}
function encodeScsynthOptions(o, ctx = {}) {
  const buf = new ArrayBuffer(18 * 4);
  const u32 = new Uint32Array(buf);
  u32[0] = o.numBuffers ?? 1024;
  u32[1] = o.maxNodes ?? 1024;
  u32[2] = o.maxGraphDefs ?? 1024;
  u32[3] = o.maxWireBufs ?? 64;
  u32[4] = o.numAudioBusChannels ?? 128;
  u32[5] = o.numInputBusChannels ?? 0;
  u32[6] = o.numOutputBusChannels ?? 0;
  u32[7] = o.numControlBusChannels ?? 4096;
  u32[8] = o.bufLength ?? 128;
  u32[9] = o.realTimeMemorySize ?? 16384;
  u32[10] = o.numRGens ?? 64;
  u32[11] = o.realTime ? 1 : 0;
  u32[12] = o.memoryLocking ? 1 : 0;
  u32[13] = o.loadGraphDefs ?? 0;
  u32[14] = o.preferredSampleRate ?? 0;
  u32[15] = o.verbosity ?? 0;
  u32[17] = ctx.mode === "postMessage" ? 1 : 0;
  return buf;
}

// js/supersonic.js
var RT_ARENA_HEADROOM = 16 * 1024 * 1024;
var BUFFERS_INIT = 4 * 1024 * 1024;
var BUFFERS_MAX = 768 * 1024 * 1024;
function validateBufferCommand(address, args) {
  const int = (i, msg) => {
    if (!Number.isFinite(args[i])) throw new Error(msg);
  };
  const str = (i, msg) => {
    if (typeof args[i] !== "string") throw new Error(msg);
  };
  const blob = (i, msg) => {
    const v = args[i];
    if (!(v instanceof Uint8Array || v instanceof ArrayBuffer)) throw new Error(msg);
  };
  switch (address) {
    case "/b_alloc":
      int(0, "/b_alloc requires a buffer number");
      int(1, "/b_alloc requires a frame count");
      break;
    case "/b_allocRead":
      int(0, "/b_allocRead requires a buffer number");
      str(1, "/b_allocRead requires a file path");
      break;
    case "/b_allocReadChannel":
      int(0, "/b_allocReadChannel requires a buffer number");
      str(1, "/b_allocReadChannel requires a file path");
      break;
    case "/b_allocFile":
      int(0, "/b_allocFile requires a buffer number");
      blob(1, "/b_allocFile requires audio file data as blob");
      break;
  }
}
var BUFFER_ALLOC_COMMANDS = /* @__PURE__ */ new Set([
  "/b_alloc",
  "/b_allocRead",
  "/b_allocReadChannel",
  "/b_allocFile"
]);
var looksLikePathOrURL = (s) => s.includes("/") || s.includes("\\") || s.startsWith("http") || s.endsWith(".scsyndef");
var SuperSonic = class extends Clockwork {
  /**
   * The metrics SuperSonic reports: clockwork's, plus scsynth's own.
   *
   * Overriding the static form matters because callers inspect what a product
   * reports without booting one — the suite does exactly that.
   */
  static getMetricsSchema() {
    return Clockwork.mergeGuestMetrics(scsynthProfile);
  }
  #synthdefBaseURL;
  #sampleBaseURL;
  #bufferManager = null;
  #buffersInit;
  #buffersMax;
  #numBuffers;
  #scsynthOptions;
  #rewriter = null;
  #bufferQueue = Promise.resolve();
  /*
   * The synthdefs this client has loaded, name → bytes.
   *
   * TAU USED TO KEEP THIS and should never have. It watched for
   * /d_recv, /d_free and /d_freeAll going past — verbs it was handed by one
   * engine — and kept a copy against a device switch, which asked clockwork
   * to know which of a guest's messages carry state worth keeping. That went
   * on 2026-08-31 with the rest of the definition cache, on the understanding
   * that restore across a rebuild is the client's job. Only the buffer half
   * of that landed; this is the other half.
   *
   * The bytes are kept, not just the names, because restoring means sending
   * the definition again — a name alone cannot be replayed. They are the same
   * blobs the caller already handed over, so this costs one reference each.
   */
  #loadedSynthDefs = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    const scOpts = {
      ...defaultScsynthOptions,
      ...options.worldOptions,
      ...options.scsynthOptions
    };
    validateScsynthOptions(scOpts);
    const wasmBase = options.wasmBaseURL || (options.baseURL ? `${options.baseURL}wasm/` : null);
    const wasmUrl = options.wasmUrl || (wasmBase ? `${wasmBase}scsynth-nrt.wasm` : void 0);
    const bufInit = options.bufferPoolSize ?? BUFFERS_INIT;
    const bufMax = options.maxBufferMemory ?? BUFFERS_MAX;
    const memory = { ...options.memory };
    const rtBytes = scOpts.realTimeMemorySize ?? 8192;
    memory.memArenaSize = memory.memArenaSize ?? Math.max(MemoryLayout.memArenaSize, rtBytes * 1024 + RT_ARENA_HEADROOM);
    memory.inboxSize = memory.inboxSize ?? bufInit;
    memory.maxInboxSize = memory.maxInboxSize ?? bufMax;
    super({
      dsp: scsynthProfile,
      ...options,
      memory,
      // Opaque to clockwork; this class encodes it in encodeGuestConfig.
      guestOptions: { ...scOpts },
      // What clockwork needs in its OWN words: the channels it must open on
      // the audio graph, and the channels it must read from the device.
      audio: {
        outputChannels: scOpts.numOutputBusChannels,
        inputChannels: scOpts.numInputBusChannels
      },
      ...wasmUrl ? { wasmUrl } : {}
    });
    this.#scsynthOptions = { ...scOpts };
    this.#buffersInit = bufInit;
    this.#buffersMax = bufMax;
    this.#numBuffers = scOpts.numBuffers;
    this.on("ready", () => {
      const windowBytes = this.bufferConstants?.SHM_WINDOW_SIZE;
      if (!windowBytes) return;
      const mirrorMax = Math.floor((windowBytes - NODE_TREE_HEADER_SIZE) / NODE_TREE_ENTRY_SIZE);
      if (scOpts.maxNodes > mirrorMax) {
        const needed = NODE_TREE_HEADER_SIZE + scOpts.maxNodes * NODE_TREE_ENTRY_SIZE;
        console.warn(
          `SuperSonic: maxNodes (${scOpts.maxNodes}) exceeds NODE_TREE_MIRROR_MAX_NODES (${mirrorMax}). Nodes beyond it play normally but will not appear in getTree(); droppedCount counts them. Rebuild with -DCLOCKWORK_WINDOW_BYTES=${needed} to see them all.`
        );
      }
    });
    this.#sampleBaseURL = options.sampleBaseURL || (options.baseURL ? `${options.baseURL}samples/` : null);
    this.#synthdefBaseURL = options.synthdefBaseURL || (options.baseURL ? `${options.baseURL}synthdefs/` : null);
  }
  /**
   * Load one synthdef: a bare name, a path or URL, or the bytes themselves.
   *
   * A bare name is resolved against synthdefBaseURL — that resolution is the
   * whole reason this method exists rather than callers using send() directly.
   */
  async loadSynthDef(source) {
    let bytes;
    if (typeof source === "string") {
      const path = looksLikePathOrURL(source) ? source : (() => {
        if (!this.#synthdefBaseURL) throw new Error("synthdefBaseURL not configured.");
        return `${this.#synthdefBaseURL}${source}.scsyndef`;
      })();
      const pathName = (path.split("/").pop() || path).replace(/\.scsyndef$/i, "");
      const buf = await this.assetLoader.fetch(path, { type: "synthdef", name: pathName });
      bytes = new Uint8Array(buf);
    } else if (source instanceof ArrayBuffer) {
      bytes = new Uint8Array(source);
    } else if (ArrayBuffer.isView(source)) {
      bytes = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
    } else if (typeof Blob !== "undefined" && source instanceof Blob) {
      bytes = new Uint8Array(await source.arrayBuffer());
    } else {
      throw new Error(
        "loadSynthDef source must be a name, path/URL string, ArrayBuffer, Uint8Array, or File/Blob"
      );
    }
    const name = scsynthProfile.nameOf(bytes);
    if (!name) {
      throw new Error("Could not extract synthdef name from the data. Make sure it is a valid .scsyndef file.");
    }
    await this.send(scsynthProfile.defineVerb, bytes);
    return { name, size: bytes.length };
  }
  /**
   * The synthdefs loaded through this client, as a Map of name → bytes.
   *
   * Live, not a copy: `.has(name)` and `.size` are what callers and the suite
   * ask, and handing back a clone on every access would make a hot path out of
   * a bookkeeping read.
   */
  get loadedSynthDefs() {
    return this.#loadedSynthDefs;
  }
  /** Several, in parallel. Returns their names in the order given. */
  async loadSynthDefs(names) {
    return Promise.all(names.map((n) => this.loadSynthDef(n)));
  }
  // ── Samples ──────────────────────────────────────────────────────────────
  //
  // Clockwork has no idea what a sample is. It reserved a region and will
  // move opaque bytes into it on request; everything below — decoding,
  // interleaving, guard frames, the bufnum table — is what scsynth means by a
  // buffer, so it lives here.
  /**
   * The buffer manager, built on first use.
   *
   * Lazily, because it needs a booted engine: the audio context does the
   * decoding and the guest region does not exist until memory is initialised.
   */
  #buffers() {
    if (this.#bufferManager) return this.#bufferManager;
    const pool = this.inbox();
    this.#bufferManager = new BufferManager({
      clockwork: this,
      mode: this.mode,
      audioContext: this.audioContext,
      sharedBuffer: this.sharedBuffer,
      wasmMemory: this.wasmMemory,
      // The whole inbox: nothing is reserved ahead of the pool.
      bufferPoolConfig: {
        start: pool.offset,
        size: this.#buffersInit,
        maxSize: this.#buffersMax
      },
      maxBufferMemory: this.#buffersMax,
      assetLoader: this.assetLoader,
      sampleBaseURL: this.#sampleBaseURL,
      maxBuffers: this.#numBuffers,
      onBufferPoolGrowth: (info) => this.emit("buffer:pool:grown", info)
    });
    this.#rewriter = new OSCRewriter({
      bufferManager: this.#bufferManager,
      getDefaultSampleRate: () => this.audioContext?.sampleRate || 44100
    });
    this.on("in:osc", ({ oscData }) => {
      let msg;
      try {
        msg = decodePacket(oscData);
      } catch {
        return;
      }
      const [address, ...args] = msg;
      if (address === "/supersonic/buffer/allocated") this.#bufferManager?.handleBufferAllocated(args);
      else if (address === "/supersonic/buffer/freed") this.#bufferManager?.handleBufferFreed(args);
    });
    return this.#bufferManager;
  }
  /**
   * scsynth's config block, in the byte layout its C++ reads.
   *
   * Eighteen slots, seventeen of which are scsynth's own fields. Clockwork
   * wrote them itself until 2026-08-31 — every field name and every index
   * hardcoded in a guest-agnostic worklet — which meant no other guest could
   * be configured without editing it. Clockwork reserves the region and
   * copies these bytes; only this side knows what they say.
   */
  encodeGuestConfig(ctx) {
    return encodeScsynthOptions(this.#scsynthOptions, ctx);
  }
  /**
   * Send, intercepting the verbs that must be answered client-side.
   *
   * They are queued rather than sent: rewriting is asynchronous — it may
   * fetch and decode a file — and two allocations racing would interleave
   * their pointers. The queue keeps them in the order the caller wrote them.
   */
  send(address, ...args) {
    if (address === scsynthProfile.defineVerb) {
      const blob = args.find((a) => a instanceof ArrayBuffer || ArrayBuffer.isView(a));
      if (blob) {
        const bytes = blob instanceof ArrayBuffer ? new Uint8Array(blob) : new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
        const name = scsynthProfile.nameOf(bytes);
        if (name) this.#loadedSynthDefs.set(name, bytes);
      }
    } else if (address === scsynthProfile.forgetVerb) {
      const name = args.find((a) => typeof a === "string");
      if (name) this.#loadedSynthDefs.delete(name);
    } else if (address === scsynthProfile.forgetAllVerb) {
      this.#loadedSynthDefs.clear();
    }
    if (!BUFFER_ALLOC_COMMANDS.has(address)) return super.send(address, ...args);
    const normalized = args.map((a) => a instanceof ArrayBuffer ? new Uint8Array(a) : a);
    validateBufferCommand(address, normalized);
    this.#bufferQueue = this.#bufferQueue.then(async () => {
      this.#buffers();
      const { packet } = await this.#rewriter.rewritePacket([address, ...normalized]);
      return super.send(packet[0], ...packet.slice(1));
    }).catch((error) => {
      console.error(`[SuperSonic] ${address} failed:`, error);
      this.emit?.("error", error);
    });
    return void 0;
  }
  /**
   * Values for the metrics scsynth_profile declares — flat, by declared name.
   *
   * Clockwork used to be handed nested `bufferPoolStats` objects and know
   * how to unpack them, which put scsynth's shapes inside guest-agnostic
   * code. It takes declared names and nothing else now.
   */
  clientMetrics() {
    const stats = this.#bufferManager?.getStats();
    const growth = this.#bufferManager?.getGrowthStats();
    return {
      bufferPoolUsedBytes: stats?.used?.size ?? 0,
      bufferPoolAvailableBytes: stats?.available ?? 0,
      bufferPoolAllocations: stats?.used?.count ?? 0,
      bufferPoolTotalCapacity: growth?.totalCapacity ?? 0,
      bufferPoolMaxCapacity: growth?.maxCapacity ?? 0,
      bufferPoolGrowthCount: growth?.growthCount ?? 0,
      bufferPoolPoolCount: growth?.poolCount ?? 0,
      loadedSynthDefs: this.#loadedSynthDefs.size
    };
  }
  /**
   * Put the sample buffers back after a reload.
   *
   * The frames themselves are still in guest memory — a reload rebuilds the
   * engine, not the region — so this only has to hand the engine the pointers
   * again. In postMessage mode a buffer that came from a file is reloaded
   * from it instead, because the client's pool there is bookkeeping and the
   * worklet's heap went with the engine.
   */
  async restoreClientState() {
    for (const [name, bytes] of this.#loadedSynthDefs) {
      try {
        await super.send(scsynthProfile.defineVerb, bytes);
      } catch (e) {
        console.error(`[SuperSonic] synthdef ${name} did not survive the reload:`, e);
      }
    }
    const buffers = this.#bufferManager?.getAllocatedBuffers() || [];
    for (const buf of buffers) {
      try {
        if (this.mode === "postMessage" && buf.source?.type === "file") {
          await this.loadSample(
            buf.bufnum,
            buf.source.path,
            buf.source.startFrame || 0,
            buf.source.numFrames || 0
          );
        } else {
          await this.send(
            "/b_allocPtr",
            buf.bufnum,
            buf.laneOffset,
            buf.numFrames,
            buf.numChannels,
            buf.sampleRate,
            crypto.randomUUID()
          );
        }
      } catch (e) {
        console.error(`[SuperSonic] buffer ${buf.bufnum} did not survive the reload:`, e);
      }
    }
  }
  /**
   * Full teardown, which forgets what was loaded.
   *
   * reset() is shutdown + init, so the engine that comes back has been given
   * nothing and this client must not claim otherwise. reload() does NOT come
   * through here — it partially tears down and calls restoreClientState(),
   * which needs the record intact to put the definitions back.
   */
  async shutdown(...args) {
    this.#loadedSynthDefs.clear();
    return super.shutdown(...args);
  }
  /** Settle any queued buffer commands — tests and shutdown both need this. */
  drainBufferQueue() {
    return this.#bufferQueue;
  }
  /**
   * Sync, after the queued buffer commands have actually gone out.
   *
   * Interception makes those commands asynchronous, so a caller that writes
   * `/b_allocFile` then `sync()` would otherwise pass the barrier before the
   * allocation had been sent — the barrier would be telling the truth about
   * an engine that had not yet been asked. Draining first is what makes the
   * sequence mean what it reads like.
   */
  async sync(...args) {
    await this.#bufferQueue;
    return super.sync(...args);
  }
  /**
   * Load audio into a buffer number.
   *
   * `source` may be a path or URL resolved against sampleBaseURL, raw bytes,
   * or a File/Blob. The frames are decoded, staged into our slice of guest
   * memory, and the engine is handed the pointer — the bytes never ride OSC.
   */
  async loadSample(bufnum, source, startFrame = 0, numFrames = 0) {
    const buffers = this.#buffers();
    let info;
    if (typeof source === "string") {
      info = await buffers.prepareFromFile({ bufnum, path: source, startFrame, numFrames });
    } else if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
      info = await buffers.prepareFromBlob({ bufnum, blob: source, startFrame, numFrames });
    } else if (typeof Blob !== "undefined" && source instanceof Blob) {
      info = await buffers.prepareFromBlob({
        bufnum,
        blob: await source.arrayBuffer(),
        startFrame,
        numFrames
      });
    } else {
      throw new Error("loadSample source must be a path/URL, ArrayBuffer, TypedArray, or Blob");
    }
    await this.send(
      "/b_allocPtr",
      bufnum,
      info.laneOffset,
      info.numFrames,
      info.numChannels,
      info.sampleRate,
      info.uuid
    );
    await info.allocationComplete;
    const { numFrames: frames, numChannels: channels, sampleRate: sr } = info;
    return {
      bufnum,
      hash: info.hash,
      source: typeof source === "string" ? source : null,
      numFrames: frames,
      numChannels: channels,
      sampleRate: sr,
      duration: sr > 0 ? frames / sr : 0
    };
  }
  /** Allocate an empty buffer: the same path, with no material to decode. */
  async allocSample(bufnum, numFrames, numChannels = 1, sampleRate = null) {
    const buffers = this.#buffers();
    const info = await buffers.prepareEmpty({ bufnum, numFrames, numChannels, sampleRate });
    await this.send(
      "/b_allocPtr",
      bufnum,
      info.laneOffset,
      info.numFrames,
      info.numChannels,
      info.sampleRate,
      info.uuid
    );
    await info.allocationComplete;
    return {
      bufnum,
      numFrames: info.numFrames,
      numChannels: info.numChannels,
      sampleRate: info.sampleRate
    };
  }
  /** What is loaded, for a client that wants to show it. */
  // ── The node tree ─────────────────────────────────────────────────────────
  //
  // scsynth publishes its tree into the window clockwork reserves. The host
  // knows only that the window's first word is a version stamp; the shape of
  // the rest is ours, so the parsing is here rather than there.
  /**
   * What getTree() and getRawTree() hand back, described for a consumer that
   * builds a UI or an inspector from the shape rather than from reading this
   * file. Static, because the shape is a property of this class, not of any
   * one engine.
   *
   * Kept honest against the parser, not against intent: an earlier version
   * said `id` was a number when getTree() gives a node its UUID whenever it
   * has one, and left out every v2 field the parser produces. schema.spec.mjs
   * now compares these against a real tree, so the two cannot drift apart
   * silently again.
   */
  static getTreeSchema() {
    return {
      nodeCount: { type: "number", description: "Nodes present in the mirror" },
      version: { type: "number", description: "Increments on any change; watch it to know when to re-read" },
      droppedCount: { type: "number", description: "Nodes beyond the mirror's capacity, absent below" },
      root: {
        type: "object",
        nullable: true,
        description: "The root group, or null before the engine has published one",
        schema: {
          id: { type: ["uuid", "number"], description: "The node's UUID (16 bytes) when it has one, else its numeric id" },
          type: { type: "string", values: ["group", "synth"], description: "Group or synth" },
          defName: { type: "string", description: "Synthdef name; empty for a group" },
          children: { type: "array", description: "Child nodes in sibling order (recursive)", itemSchema: "(self)" }
        }
      }
    };
  }
  static getRawTreeSchema() {
    return {
      nodeCount: { type: "number", description: "Nodes present in the mirror" },
      version: { type: "number", description: "Increments on any change; watch it to know when to re-read" },
      droppedCount: { type: "number", description: "Nodes beyond the mirror's capacity, absent below" },
      nodes: {
        type: "array",
        description: "Every node as the mirror holds it, with its linkage intact",
        itemSchema: {
          id: { type: "number", nullable: true, description: "Numeric node id; null for a row the engine surface cannot address" },
          parentId: { type: "number", description: "Parent node id; -1 for the root" },
          isGroup: { type: "boolean", description: "True for a group, false for a synth" },
          prevId: { type: "number", description: "Previous sibling; -1 if none" },
          nextId: { type: "number", description: "Next sibling; -1 if none" },
          headId: { type: "number", description: "First child (groups); -1 if empty" },
          defName: { type: "string", description: "Synthdef name; empty for a group" },
          uuid: { type: "uuid", nullable: true, description: "16-byte UUID, or null when the node has none" },
          parentUuid: { type: "uuid", nullable: true, description: "Parent's UUID, or null" },
          outPeak: { type: "number", description: "Peak of the node's output over the last block" },
          synthCount: { type: "number", description: "Synths under this node, itself included" },
          listens: { type: "boolean", description: "Whether the node subscribes to input" }
        }
      }
    };
  }
  getRawTree() {
    const w = this.readWindow();
    if (!w) return { nodeCount: 0, version: 0, droppedCount: 0, nodes: [] };
    return parseNodeTree(w.buffer, w.offset, w.size);
  }
  getTree() {
    const raw = this.getRawTree();
    const byId = /* @__PURE__ */ new Map();
    let rootRaw = null;
    for (const rawNode of raw.nodes) {
      const tree = {
        id: rawNode.uuid || rawNode.id,
        type: rawNode.isGroup ? "group" : "synth",
        defName: rawNode.defName,
        children: []
      };
      byId.set(rawNode.id, { raw: rawNode, tree });
      if (rawNode.parentId === -1) rootRaw = rawNode;
    }
    for (const { raw: groupRaw, tree: groupTree } of byId.values()) {
      if (!groupRaw.isGroup) continue;
      const seen = /* @__PURE__ */ new Set();
      for (let id = groupRaw.headId; id !== -1 && !seen.has(id); ) {
        seen.add(id);
        const child = byId.get(id);
        if (!child) break;
        groupTree.children.push(child.tree);
        id = child.raw.nextId;
      }
    }
    return {
      nodeCount: raw.nodeCount,
      version: raw.version,
      droppedCount: raw.droppedCount,
      root: rootRaw ? byId.get(rootRaw.id).tree : null
    };
  }
  getLoadedBuffers() {
    const buffers = this.#bufferManager?.getAllocatedBuffers() || [];
    return buffers.map(({ bufnum, numFrames, numChannels, sampleRate, source, hash }) => ({
      bufnum,
      hash: hash || null,
      source: source?.path || source?.name || null,
      numFrames,
      numChannels,
      sampleRate,
      duration: sampleRate > 0 ? numFrames / sampleRate : 0
    }));
  }
  /** Read a file's shape without loading it into the engine. */
  async sampleInfo(source, startFrame = 0, numFrames = 0) {
    const src = typeof Blob !== "undefined" && source instanceof Blob ? await source.arrayBuffer() : source;
    return this.#buffers().sampleInfo({ source: src, startFrame, numFrames });
  }
};
var osc2 = SuperSonic.osc;
var supersonic_default = SuperSonic;
export {
  OscChannel,
  SuperSonic,
  supersonic_default as default,
  osc2 as osc
};
