// CallLayer.jsx — Mounts the real-time call overlays for the whole app.
//
// Uses the shared WebRTC engine (hooks/useWebRTC) and renders the voice/video
// call and incoming-call overlays globally, so an incoming call can ring even
// when no conversation is currently open. position: fixed overlays are safe to
// render from anywhere in the tree.
import { useWebRTC } from "../hooks/useWebRTC";
import VoiceCallOverlay from "./VoiceCallOverlay";
import VideoCallOverlay from "./VideoCallOverlay";
import IncomingCallOverlay from "./IncomingCallOverlay";

function CallLayer() {
  const call = useWebRTC();

  const isVoice =
    call.status !== "idle" &&
    call.status !== "incoming" &&
    call.callType === "voice";
  const isVideo =
    call.status !== "idle" &&
    call.status !== "incoming" &&
    call.callType === "video";

  return (
    <>
      <IncomingCallOverlay
        isOpen={call.status === "incoming"}
        call={call}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
      />
      <VoiceCallOverlay
        isOpen={isVoice}
        call={call}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
      />
      <VideoCallOverlay
        isOpen={isVideo}
        call={call}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onToggleCamera={call.toggleCamera}
      />
    </>
  );
}

export default CallLayer;
