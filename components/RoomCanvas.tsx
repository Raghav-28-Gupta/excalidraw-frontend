"use client";
import { WS_URL } from "@/config";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
  console.log("Attempting WebSocket connection...");
  const ws = new WebSocket(
    `${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFjZTAzNzM1LTBkZWMtNDhmMC05ZDI2LWQyYzJlMDQ2MDBmNCIsImlhdCI6MTc1MTk5MDU1MH0.laD4WyfM0XOCUmuGY9QXq4s9VGHFoe2azas754fNprg`
  );

  ws.onopen = () => {
    console.log("WebSocket opened!");
    setSocket(ws);
    setIsOpen(true);
    const data = JSON.stringify({
      type: "join_room",
      roomId,
    });
    ws.send(data);
  };

  ws.onclose = (event) => {
    console.warn("WebSocket closed", event);
    setIsOpen(false);
    setSocket(null);
  };

  ws.onerror = (err) => {
    console.error("WebSocket error", err);
    setIsOpen(false);
    setSocket(null);
  };

  return () => {
    ws.close();
  };
}, [roomId]);

  if (!socket || !isOpen) {
    return <div>Connecting to server....</div>;
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}