import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/**
 * Polyfill for the window.storage API that Claude artifacts provide natively.
 * Backed by the browser's localStorage so the app works standalone.
 *
 * Note: everything is stored locally in *this browser* — there's no "shared"
 * multi-user storage outside of Claude.ai, so the `shared` flag is accepted
 * for API compatibility but both shared and personal data live in the same
 * localStorage on this device.
 */
const PREFIX = "formulary:";

function readAll() {
  try {
    const raw = localStorage.getItem(PREFIX + "__data__");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(PREFIX + "__data__", JSON.stringify(data));
}

window.storage = {
  async get(key) {
    const data = readAll();
    if (!(key in data)) {
      throw new Error(`Key "${key}" not found`);
    }
    return { key, value: data[key], shared: false };
  },

  async set(key, value) {
    const data = readAll();
    data[key] = value;
    writeAll(data);
    return { key, value, shared: false };
  },

  async delete(key) {
    const data = readAll();
    const existed = key in data;
    delete data[key];
    writeAll(data);
    return { key, deleted: existed, shared: false };
  },

  async list(prefix) {
    const data = readAll();
    const keys = Object.keys(data).filter((k) => !prefix || k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
