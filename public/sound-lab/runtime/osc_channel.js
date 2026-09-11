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
  static async open({ wasmModule, wasmMemory, ringBufferBase, bufferConstants, label = "WasmClient" }) {
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
    const instance = await WebAssembly.instantiate(wasmModule, moduleImports(wasmMemory, label));
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
var OSC_OUT_MESSAGES_SENT = 9;
var OSC_OUT_BYTES_SENT = 10;
var RING_BUFFER_DIRECT_WRITE_FAILS = 26;
var METRICS_RESERVED = 50;
var SAB_METRICS_COUNT = METRICS_RESERVED + 1;
var GUEST_METRICS_BASE = 69;
var GUEST_METRICS_COUNT = 32;
var MERGED_ARRAY_SIZE = GUEST_METRICS_BASE + GUEST_METRICS_COUNT;

// clockwork/js/lib/control_offsets.js
var IN_HEAD = 0;
var IN_TAIL = 4;
var IN_SEQUENCE = 24;
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
export {
  OscChannel
};
