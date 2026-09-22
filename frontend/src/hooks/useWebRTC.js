// useWebRTC.js — Hook exposing the shared real-time calling engine.
//
// This is a thin wrapper over the singleton Zustand call store created in
// lib/callSocket.js, so every component (ChatHeader, ChatContainer, overlays,
// CallLayer) reads and mutates the SAME call state. It also attaches the
// Socket.io signaling listeners once the auth socket is available.
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import {
  useCallStore,
  initCallListeners,
  startCall,
  acceptCall,
  rejectCall,
  endCall,
  toggleMute,
  toggleCamera,
  resetToIdle,
} from "../lib/callSocket";

export function useWebRTC() {
  const socket = useAuthStore((state) => state.socket);
  const call = useCallStore();

  // Attach the call listeners whenever the (singleton) auth socket is live.
  useEffect(() => {
    if (socket) initCallListeners();
  }, [socket]);

  return {
    ...call,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
    resetToIdle,
  };
}
