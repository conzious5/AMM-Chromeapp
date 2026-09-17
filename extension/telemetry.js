(function (root, factory) {
  const api = factory(root.AMMVoiceCore || (typeof require === "function" ? require("./core.js") : null)); if (typeof module === "object" && module.exports) module.exports = api; root.AMMVoiceTelemetry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (core) {
  "use strict";
  class ExtensionTelemetry { async record(_name, _metadata) {} } class NoopExtensionTelemetry extends ExtensionTelemetry {}
  class MemoryExtensionTelemetry extends ExtensionTelemetry { constructor() { super(); this.events = []; } async record(name, metadata) { const event = core.sanitizeTelemetry(name, metadata); if (event) this.events.push(event); } }
  return { ExtensionTelemetry, NoopExtensionTelemetry, MemoryExtensionTelemetry };
});
