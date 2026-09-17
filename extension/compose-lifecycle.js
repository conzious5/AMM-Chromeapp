(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AMMVoiceComposeLifecycle = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function createComposeLifecycle(options) {
    const statesByCompose = new WeakMap();
    const statesByIdentity = new Map();
    const liveStates = new Set();
    const isConnected = options.isConnected || ((compose) => Boolean(compose?.isConnected));

    function register(compose, state, identity) {
      state.compose = compose;
      state.composeIdentity = identity;
      statesByCompose.set(compose, state);
      liveStates.add(state);
      if (identity) statesByIdentity.set(identity, state);
      return state;
    }

    function stateFor(compose) {
      return statesByCompose.get(compose) || null;
    }

    function ensure(compose) {
      if (!compose || !isConnected(compose)) return null;
      const identity = options.identityFor?.(compose) || "";
      let state = stateFor(compose);

      if (!state && identity) {
        const recoverable = statesByIdentity.get(identity);
        if (recoverable && !isConnected(recoverable.compose)) {
          state = register(compose, recoverable, identity);
          options.onRebind?.(state, compose);
        }
      }

      if (!state) state = register(compose, options.createState(compose), identity);
      if (!options.controlsAttached(compose, state)) options.attachControls(compose, state);
      return state;
    }

    function cleanupDisconnected() {
      for (const state of [...liveStates]) {
        if (isConnected(state.compose)) continue;
        liveStates.delete(state);
        if (state.composeIdentity && statesByIdentity.get(state.composeIdentity) === state) statesByIdentity.delete(state.composeIdentity);
        options.onCleanup?.(state);
      }
    }

    function reconcile(composes) {
      const states = [];
      for (const compose of new Set(composes || [])) {
        const state = ensure(compose);
        if (state) states.push(state);
      }
      cleanupDisconnected();
      return states;
    }

    return { ensure, reconcile, cleanupDisconnected, stateFor, liveStateCount: () => liveStates.size };
  }

  return { createComposeLifecycle };
});
