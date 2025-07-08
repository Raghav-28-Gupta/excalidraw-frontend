"use client"
import { WS_URL } from "@/config";
import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({roomId} : {roomId : string}) {
     const [socket, setSocket] = useState<WebSocket | null>(null);

     useEffect(() => {
          const ws = new WebSocket(WS_URL);
          ws.onopen = () => {
               setSocket(ws);
          }

     }, [])


     if(!socket) {
          return <div>
               Connecting to server...
          </div>
     }

     return <div>
          <Canvas roomId={roomId}/>
     </div>
}