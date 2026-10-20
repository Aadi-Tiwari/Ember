import { Flame, MessageCircle, Mic, MousePointer2, ScanFace } from "lucide-react";

export default function ConnectionArt() {
  return <div className="connection-art" aria-hidden="true">
    <div className="connection-ring ring-outer" /><div className="connection-ring ring-inner" />
    <div className="connection-center"><Flame size={35} strokeWidth={1.4} /></div>
    <span className="connection-node node-activity"><MousePointer2 size={20} /></span>
    <span className="connection-node node-face"><ScanFace size={22} /></span>
    <span className="connection-node node-voice"><Mic size={20} /></span>
    <span className="connection-node node-chat"><MessageCircle size={20} /></span>
    <span className="connection-dot dot-one" /><span className="connection-dot dot-two" />
  </div>;
}
