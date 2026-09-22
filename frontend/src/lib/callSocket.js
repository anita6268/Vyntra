// callSocket.js — Real-time 1-to-1 voice/video calling engine.
//
// Reuses the SINGLE existing Socket.io connection (from useAuthStore.socket)
// for WebRTC signaling. No fake connections: media is only ever shown once
// ICE candidates connect, the remote description is exchanged, and remote
// tracks actually arrive.
import { create } from "zustand";
import { useAuthStore } from "../store/useAuthStore";
import toast from "react-hot-toast";
import { axiosInstance } from "./axios";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "./premiumFeatures";
import { promptUpgrade } from "./premiumGating";

// ICE configuration is fetched from the backend (GET /api/calls/ice-config) so
// that TURN credentials are never hardcoded in the frontend bundle. Falls back
// to STUN-only when the endpoint is unavailable or TURN is not configured.
const FALLBACK_STUN = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

let iceConfigCache = null;

// Fetch the authenticated ICE config (STUN + optional TURN) from the backend.
// Cached for the lifetime of the module so we only hit the endpoint once.
async function fetchIceConfig() {
  if (iceConfigCache) return iceConfigCache;
  try {
    const res = await axiosInstance.get("/calls/ice-config");
    if (res.data?.iceServers?.length) {
      iceConfigCache = { iceServers: res.data.iceServers };
      return iceConfigCache;
    }
  } catch {
    // Non-fatal: fall back to STUN-only below.
  }
  iceConfigCache = FALLBACK_STUN;
  if (import.meta.env.DEV) {
    console.warn("[ICE] Falling back to STUN-only (ice-config fetch failed).");
  }
  return FALLBACK_STUN;
}

// Eagerly warm the cache at module load (fire-and-forget).
fetchIceConfig().catch(() => {});

// Ensure the ICE config is loaded before creating a peer connection.
async function ensureIceConfig() {
  return iceConfigCache || fetchIceConfig();
}

// Module-level WebRTC state (one peer connection per session → prevents
// duplicate peer connections).
let pc = null;
let localStream = null;
let pendingOffer = null; // incoming offer awaiting Accept
let pendingCandidates = []; // ICE candidates that arrive before a remote description
let durationTimer = null;
let myCallId = null;
let attachedSocket = null;
let resetTimer = null;

// Call-history persistence (fire-and-forget REST). One record is created per
// placed call (caller side) and finalized once the call ends. Never blocks the
// signaling path.
let historyRecordId = null;

const ACTIVE_STATUSES = new Set(["outgoing", "ringing", "connecting", "incoming", "connected"]);
const isActive = (status) => ACTIVE_STATUSES.has(status);

const getSocket = () => useAuthStore.getState().socket;
const getAuth = () => useAuthStore.getState().authUser;

// ── Reactive call state (shared across every component via existing Zustand) ─
export const useCallStore = create(() => ({
  status: "idle", // idle|ringing|connecting|incoming|connected|rejected|busy|missed|ended|error
  callType: null, // "voice" | "video"
  peer: null, // { id, fullName, profilePic }
  callId: null,
  duration: 0,
  isMuted: false,
  isCameraOff: false,
  errorMessage: null,
  localStream: null,
  remoteStream: null,
}));

const setState = (partial) => useCallStore.setState(partial);

// ── Media helpers ───────────────────────────────────────────────────────────
function acquireMedia(callType) {
  const constraints =
    callType === "video"
      ? { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { audio: true };
  return navigator.mediaDevices.getUserMedia(constraints);
}

function handleMediaError(err, callType) {
  const name = err?.name;
  let message = "Couldn't access your camera or microphone.";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    message = "Microphone/camera permission was denied. Allow access and try again.";
  } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    message = "No microphone or camera was found on this device.";
  } else if (name === "NotReadableError") {
    message = "Your camera/microphone is in use by another app.";
  } else if (name === "OverconstrainedError") {
    message = "The requested camera/microphone settings couldn't be satisfied.";
  }
  toast.error(message);
  setState({ status: "error", callType, errorMessage: message });
  setTimeout(resetToIdle, 3500);
}

// ── Peer connection helpers ─────────────────────────────────────────────────
function ensurePeerConnection() {
  if (pc) return pc;
  pc = new RTCPeerConnection(iceConfigCache || FALLBACK_STUN);

  pc.onicecandidate = (event) => {
    if (!event.candidate || !myCallId) return;
    const peer = useCallStore.getState().peer;
    if (peer) {
      getSocket()?.emit("call:ice-candidate", {
        callId: myCallId,
        targetId: peer.id,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) setState({ remoteStream: stream });
    // We only claim "connected" once remote media actually arrives.
    if (useCallStore.getState().status === "connecting") {
      setState({ status: "connected" });
    }
  };

  pc.onconnectionstatechange = () => {
    if (!pc) return;
    const state = pc.connectionState;
    if (state === "connected") {
      startDuration();
      if (["connecting", "ringing"].includes(useCallStore.getState().status)) {
        setState({ status: "connected" });
      }
    } else if (state === "failed") {
      toast.error("Call connection failed");
      endCall();
    }
  };

  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }
  return pc;
}

async function flushPendingCandidates() {
  const list = pendingCandidates;
  pendingCandidates = [];
  for (const candidate of list) {
    try {
      await pc.addIceCandidate(candidate);
    } catch {
      /* ignore individual failures */
    }
  }
}

function startDuration() {
  if (durationTimer) clearInterval(durationTimer);
  const start = Date.now();
  durationTimer = setInterval(() => {
    setState({ duration: Math.floor((Date.now() - start) / 1000) });
  }, 1000);
}

function endAndCleanup() {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    pc = null;
  }
  pendingCandidates = [];
  pendingOffer = null;
  myCallId = null;
}

// ── Call-history persistence (fire-and-forget REST) ─────────────────────────
// Create a placeholder record at the moment a call is placed (caller side only).
async function createHistory(callType, receiverId) {
  historyRecordId = null;
  if (!receiverId) return;
  try {
    const res = await axiosInstance.post("/calls", {
      callId: myCallId,
      receiverId,
      callType,
      status: "cancelled",
      startedAt: new Date().toISOString(),
    });
    historyRecordId = res.data?._id || null;
  } catch {
    historyRecordId = null; // non-fatal — calling still proceeds
  }
}

// Finalize the placeholder once the call ends. Idempotent & non-fatal.
async function finalizeHistory(status, duration) {
  const id = historyRecordId;
  historyRecordId = null;
  if (!id) return;
  try {
    await axiosInstance.put(`/calls/${id}`, {
      status,
      endedAt: new Date().toISOString(),
      duration: Math.max(0, Math.round(duration || 0)),
    });
  } catch {
    /* ignore — history is best-effort */
  }
}

// ── Public actions ──────────────────────────────────────────────────────────
export async function startCall(callType, contact) {
  if (!contact?._id) return;
  if (!canUsePremiumFeature(PREMIUM_FEATURES.HD_CALLS)) {
    const message =
      callType === "video"
        ? "HD Video Calls are available with Vyntra Pro."
        : "HD Voice Calls are available with Vyntra Pro.";
    promptUpgrade(message, PREMIUM_FEATURES.HD_CALLS);
    return;
  }
  const current = useCallStore.getState();
  if (isActive(current.status)) {
    toast.error("You're already in a call");
    return;
  }
  const socket = getSocket();
  if (!socket) {
    toast.error("You're offline");
    return;
  }
  if (!getAuth()) return;

  // Acquire media first so permission errors surface before any signaling.
  let stream;
  try {
    stream = await acquireMedia(callType);
  } catch (err) {
    handleMediaError(err, callType);
    return;
  }

  const callId = `${getAuth()._id}-${Date.now()}`;
  myCallId = callId;
  localStream = stream;

  setState({
    status: "ringing",
    callType,
    callId,
    duration: 0,
    isMuted: false,
    isCameraOff: false,
    errorMessage: null,
    localStream: stream,
    remoteStream: null,
    peer: {
      id: contact._id,
      fullName: contact.fullName || "Contact",
      profilePic: contact.profilePic || contact.image || "/avatar.png",
    },
  });

  await ensureIceConfig();
  const peerConnection = ensurePeerConnection();
  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("call:offer", {
      callId,
      targetId: contact._id,
      callType,
      offer: peerConnection.localDescription,
    });
    // Persist a placeholder history record (caller side). Fire-and-forget so it
    // never delays the offer above.
    createHistory(callType, contact._id);
  } catch {
    toast.error("Couldn't start the call");
    endCall();
  }
}

export async function acceptCall() {
  const current = useCallStore.getState();
  if (current.status !== "incoming") return;

  let stream;
  try {
    stream = await acquireMedia(current.callType);
  } catch (err) {
    // Decline honestly so the caller isn't left ringing forever.
    getSocket()?.emit("call:rejected", {
      callId: myCallId,
      targetId: current.peer?.id,
      reason: "declined",
    });
    endAndCleanup();
    handleMediaError(err, current.callType);
    return;
  }

  localStream = stream;
  setState({ localStream: stream, status: "connecting", isMuted: false, isCameraOff: false });

  const socket = getSocket();
  await ensureIceConfig();
  const peerConnection = ensurePeerConnection();
  try {
    if (pendingOffer) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      await flushPendingCandidates();
    }
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    if (socket) {
      socket.emit("call:accepted", { callId: myCallId, targetId: current.peer.id });
      socket.emit("call:answer", {
        callId: myCallId,
        targetId: current.peer.id,
        answer: peerConnection.localDescription,
      });
    }
  } catch {
    toast.error("Couldn't join the call");
    endCall();
  }
}

export function rejectCall() {
  const current = useCallStore.getState();
  if (current.status !== "incoming") return;
  getSocket()?.emit("call:rejected", {
    callId: myCallId,
    targetId: current.peer.id,
    reason: "declined",
  });
  endAndCleanup();
  setState({ status: "idle", localStream: null, remoteStream: null });
}

export function endCall() {
  const current = useCallStore.getState();
  if (isActive(current.status) && current.peer) {
    getSocket()?.emit("call:ended", { callId: myCallId, targetId: current.peer.id });
  }
  // Caller side finalizes the persisted record: a connected call is "completed",
  // a hang-up before connection is "missed" (the receiver missed the call).
  const wasConnected = current.status === "connected" || current.duration > 0;
  finalizeHistory(wasConnected ? "completed" : "missed", current.duration || 0);
  endAndCleanup();
  setState({ status: "idle", localStream: null, remoteStream: null });
}

export function toggleMute() {
  const current = useCallStore.getState();
  const next = !current.isMuted;
  localStream?.getAudioTracks().forEach((track) => {
    track.enabled = !next;
  });
  setState({ isMuted: next });
}

export function toggleCamera() {
  const current = useCallStore.getState();
  if (current.callType !== "video") return;
  const next = !current.isCameraOff;
  localStream?.getVideoTracks().forEach((track) => {
    track.enabled = !next;
  });
  setState({ isCameraOff: next });
}

export function resetToIdle() {
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  endAndCleanup();
  setState({
    status: "idle",
    callType: null,
    peer: null,
    callId: null,
    duration: 0,
    isMuted: false,
    isCameraOff: false,
    errorMessage: null,
    localStream: null,
    remoteStream: null,
  });
}

// ── Signaling wiring ────────────────────────────────────────────────────────
function attachCallListeners(socket) {
  socket.on("call:incoming", (data) => {
    if (!data?.callId || !data?.offer) return;
    // Never clobber an active call (the server also refuses calls to a busy user).
    if (isActive(useCallStore.getState().status)) return;
    pendingOffer = data.offer;
    myCallId = data.callId;
    setState({
      status: "incoming",
      callType: data.callType === "video" ? "video" : "voice",
      callId: data.callId,
      duration: 0,
      isMuted: false,
      isCameraOff: false,
      errorMessage: null,
      localStream: null,
      remoteStream: null,
      peer: {
        id: data.callerId,
        fullName: data.callerName || "Contact",
        profilePic: data.callerAvatar || "/avatar.png",
      },
    });
  });

  socket.on("call:accepted", (data) => {
    if (data?.callId && String(data.callId) !== String(myCallId)) return;
    // Caller side: the receiver accepted, so we're now negotiating media.
    setState({ status: "connecting" });
  });

  socket.on("call:answer", async (data) => {
    if (String(data.callId) !== String(myCallId)) return;
    try {
      const peerConnection = ensurePeerConnection();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      await flushPendingCandidates();
    } catch {
      /* ignore */
    }
  });

  socket.on("call:ice-candidate", async (data) => {
    if (String(data.callId) !== String(myCallId) || !data?.candidate) return;
    const candidate = new RTCIceCandidate(data.candidate);
    if (pc && pc.remoteDescription) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore */
      }
    } else {
      // Requirement: handle ICE candidates arriving before the remote description.
      pendingCandidates.push(candidate);
    }
  });

  socket.on("call:rejected", (data) => {
    if (String(data.callId) !== String(myCallId)) return;
    const reason = data?.reason;
    const status = reason === "offline" ? "missed" : reason === "Pro required" ? "rejected" : "rejected";
    finalizeHistory(status, 0);
    endAndCleanup();
    setState({ status, localStream: null, remoteStream: null });
    if (reason === "offline") toast.error("The person you're calling is offline");
    else if (reason === "Pro required") toast.error("HD Calls require Vyntra Pro. Upgrade to unlock calls.");
    else toast.error("The person declined your call");
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(resetToIdle, 2500);
  });

  socket.on("call:busy", (data) => {
    if (String(data.callId) !== String(myCallId)) return;
    finalizeHistory("cancelled", 0);
    endAndCleanup();
    setState({ status: "busy", localStream: null, remoteStream: null });
    toast.error("The person you're calling is already in a call");
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(resetToIdle, 2500);
  });

  socket.on("call:ended", (data) => {
    if (String(data.callId) !== String(myCallId)) return;
    const st = useCallStore.getState();
    const wasConnected = st.status === "connected" || st.duration > 0;
    finalizeHistory(wasConnected ? "completed" : "missed", st.duration || 0);
    endAndCleanup();
    setState({ status: "ended", localStream: null, remoteStream: null });
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(resetToIdle, 1500);
  });

  // Logout / browser close: tear down so no call overlay lingers. The server
  // also cleans up and notifies the peer via its own disconnect handler.
  socket.on("disconnect", resetToIdle);
}

function detachCallListeners(socket) {
  socket.off("call:incoming");
  socket.off("call:accepted");
  socket.off("call:answer");
  socket.off("call:ice-candidate");
  socket.off("call:rejected");
  socket.off("call:busy");
  socket.off("call:ended");
  socket.off("disconnect", resetToIdle);
  endAndCleanup();
}

// Attach the calling listeners to the current auth socket. Safe to call
// repeatedly; it re-attaches only if the socket instance changed (e.g. after a
// reconnect). This keeps the app's single Socket.io connection intact.
export function initCallListeners() {
  const socket = getSocket();
  if (!socket) return;
  if (attachedSocket === socket) return;
  if (attachedSocket) detachCallListeners(attachedSocket);
  attachCallListeners(socket);
  attachedSocket = socket;
}

