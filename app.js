// For interactive documentation and code auto-completion in editor
/** @typedef {import('pear-interface')} */

/* global Pear */
import Hyperswarm from "hyperswarm"; // Module for P2P networking and connecting peers
import crypto from "hypercore-crypto"; // Cryptographic functions for generating the key in app
import b4a from "b4a";
import { onRemoteStroke } from "./board.js"; // Module for buffer-to-string and vice-versa conversions
const { teardown, updates } = Pear; // Functions for cleanup and updates

export const swarm = new Hyperswarm();

teardown(() => swarm.destroy());
updates(() => Pear.reload());

swarm.on("connection", (peer) => {
  peer.on("data", (msg) => {
    let normalMsg = JSON.parse(b4a.toString(msg));
    onRemoteStroke(normalMsg.type, normalMsg.data);
  });
  peer.on("error", (e) => console.log(`Connection error: ${e}`));
});

swarm.on("update", () => {
  document.querySelector("#canvas-room-size").textContent =
    swarm.connections.size + 1;
});

const createCanvas = async () => {
  const topicBuffer = crypto.randomBytes(32);
  joinSwarm(topicBuffer);
};

const joinCanvas = async () => {
  const key = document.querySelector("#joinInput").value;
  const topicBuffer = b4a.from(key, "hex");
  joinSwarm(topicBuffer);
};

const joinSwarm = async (topicBuffer) => {
  document.querySelector("#joinInput").value = "";
  document.querySelector("#landing").classList.add("hidden");
  document.querySelector("#loading").classList.remove("hidden");

  const discovery = swarm.join(topicBuffer, { client: true, server: true });
  await discovery.flushed();

  const topic = b4a.toString(topicBuffer, "hex");
  document.querySelector("#canvas-room-key").innerText = topic;
  document.querySelector("#loading").classList.add("hidden");
  document.querySelector(".whiteboard-wrapper").classList.remove("hidden");
};

document.querySelector("#createRoom").addEventListener("click", createCanvas);
document.querySelector("#joinBtn").addEventListener("click", joinCanvas);
