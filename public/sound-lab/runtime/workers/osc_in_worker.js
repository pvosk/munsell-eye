(() => {
  // clockwork/js/lib/metrics_offsets.js
  var OSC_IN_DROPPED_MESSAGES = 13;
  var METRICS_RESERVED = 50;
  var SAB_METRICS_COUNT = METRICS_RESERVED + 1;
  var GUEST_METRICS_BASE = 69;
  var GUEST_METRICS_COUNT = 32;
  var MERGED_ARRAY_SIZE = GUEST_METRICS_BASE + GUEST_METRICS_COUNT;

  // clockwork/js/lib/control_offsets.js
  var OUT_HEAD = 8;
  var OUT_TAIL = 12;
  function calculateOutControlIndices(ringBufferBase, CONTROL_START) {
    const base = ringBufferBase + CONTROL_START;
    return {
      OUT_HEAD: (base + OUT_HEAD) / 4,
      OUT_TAIL: (base + OUT_TAIL) / 4
    };
  }

  // clockwork/js/lib/osc_classifier.js
  var NTP_EPOCH_OFFSET = 2208988800;
  function getCurrentNTPFromPerformance() {
    return (performance.timeOrigin + performance.now()) / 1e3 + NTP_EPOCH_OFFSET;
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

  // clockwork/js/lib/sab_worker_loop.js
  function runSabWorker(config) {
    const {
      name,
      calculateControlIndices,
      headIndex,
      // (CONTROL_INDICES) => int32 array index for head
      tailIndex,
      // (CONTROL_INDICES) => int32 array index for tail
      readMessages,
      // (ctx) => array of results (empty if none)
      postResults,
      // (results) => void — sends results to main thread
      initMetrics = true,
      onInit,
      // optional (ctx) => void — runs after ring buffer setup
      extraHandlers
      // optional { [type]: (data, ctx) => void }
    } = config;
    const ctx = {
      sharedBuffer: null,
      ringBufferBase: null,
      bufferConstants: null,
      atomicView: null,
      dataView: null,
      uint8View: null,
      metricsView: null,
      CONTROL_INDICES: {},
      // This worker's way into the rings: the engine's own C, running on
      // this worker's own stack. See js/lib/wasm_client.js.
      client: null
    };
    let running = false;
    async function initRingBuffer(buffer, base, constants, wasmModule, wasmMemory) {
      ctx.sharedBuffer = buffer;
      ctx.ringBufferBase = base;
      ctx.bufferConstants = constants;
      ctx.atomicView = new Int32Array(buffer);
      ctx.dataView = new DataView(buffer);
      ctx.uint8View = new Uint8Array(buffer);
      ctx.CONTROL_INDICES = calculateControlIndices(base, constants.CONTROL_START);
      if (initMetrics) {
        const metricsBase = base + constants.METRICS_START;
        ctx.metricsView = new Uint32Array(buffer, metricsBase, constants.METRICS_SIZE / 4);
      }
      if (wasmModule && wasmMemory) {
        ctx.client = await WasmClient.open({
          wasmModule,
          wasmMemory,
          ringBufferBase: base,
          bufferConstants: constants,
          label: name
        });
      }
      await onInit?.(ctx);
    }
    function waitLoop() {
      const hIdx = headIndex(ctx.CONTROL_INDICES);
      const tIdx = tailIndex ? tailIndex(ctx.CONTROL_INDICES) : -1;
      let lastHead = -1;
      while (running) {
        try {
          const currentHead = Atomics.load(ctx.atomicView, hIdx);
          const idle = tIdx >= 0 ? currentHead === Atomics.load(ctx.atomicView, tIdx) : currentHead === lastHead;
          if (idle) {
            Atomics.wait(ctx.atomicView, hIdx, currentHead);
          }
          lastHead = Atomics.load(ctx.atomicView, hIdx);
          const results = readMessages(ctx);
          if (results && results.length > 0) {
            postResults(results);
          }
        } catch (error) {
          console.error(`[${name}] Error in wait loop:`, error);
          self.postMessage({ type: "error", error: error.message });
          Atomics.wait(ctx.atomicView, 0, ctx.atomicView[0], 10);
        }
      }
    }
    function start() {
      if (!ctx.sharedBuffer) {
        console.error(`[${name}] Cannot start - not initialized`);
        return;
      }
      if (running) {
        if (true) console.warn(`[${name}] Already running`);
        return;
      }
      running = true;
      waitLoop();
    }
    function stop() {
      running = false;
    }
    self.addEventListener("message", async (event) => {
      const { data } = event;
      try {
        if (extraHandlers?.[data.type]) {
          extraHandlers[data.type](data, ctx);
          return;
        }
        switch (data.type) {
          case "init":
            if (data.sharedBuffer) {
              await initRingBuffer(
                data.sharedBuffer,
                data.ringBufferBase,
                data.bufferConstants,
                data.wasmModule,
                data.wasmMemory
              );
            }
            self.postMessage({ type: "initialized" });
            break;
          case "start":
            if (ctx.sharedBuffer) start();
            break;
          case "stop":
            stop();
            break;
          default:
            if (true) console.warn(`[${name}] Unknown message type:`, data.type);
        }
      } catch (error) {
        console.error(`[${name}] Error:`, error);
        self.postMessage({ type: "error", error: error.message });
      }
    });
    if (true) console.log(`[${name}] Script loaded`);
  }

  // clockwork/js/workers/osc_in_worker.js
  var lastSequenceReceived = -1;
  function readOscMessages(ctx) {
    const { client, metricsView } = ctx;
    if (!client) return [];
    const messages = [];
    client.poll((bytes, origin, route, sequence) => {
      if (lastSequenceReceived >= 0) {
        const expectedSeq = lastSequenceReceived + 1 & 4294967295;
        if (sequence !== expectedSeq) {
          const dropped = sequence - expectedSeq + 4294967296 & 4294967295;
          if (dropped < 1e3) {
            console.error("[OSCInWorker] Detected", dropped, "dropped messages (expected seq", expectedSeq, "got", sequence, ")");
            if (metricsView) Atomics.add(metricsView, OSC_IN_DROPPED_MESSAGES, dropped);
          }
        }
      }
      lastSequenceReceived = sequence;
      messages.push({
        oscData: bytes.slice(),
        sequence,
        timestamp: getCurrentNTPFromPerformance()
      });
    });
    return messages;
  }
  runSabWorker({
    name: "OSCInWorker",
    calculateControlIndices: calculateOutControlIndices,
    headIndex: (idx) => idx.OUT_HEAD,
    tailIndex: (idx) => idx.OUT_TAIL,
    readMessages: readOscMessages,
    postResults: (messages) => self.postMessage({ type: "messages", messages })
  });
})();
