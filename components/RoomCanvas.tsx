"use client"
import { WS_URL } from "@/config";
import { useEffect, useRef, useState } from "react";
import { Canvas } from "./Canvas";

export function RoomCanvas({roomId} : {roomId : string}) {
     const [socket, setSocket] = useState<WebSocket | null>(null);

     useEffect(() => {
          const ws = new WebSocket(`${WS_URL}?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjFjZTAzNzM1LTBkZWMtNDhmMC05ZDI2LWQyYzJlMDQ2MDBmNCIsImlhdCI6MTc1MTk5MDU1MH0.laD4WyfM0XOCUmuGY9QXq4s9VGHFoe2azas754fNprg`);
          
          ws.onopen = () => {
               setSocket(ws);
               const data = JSON.stringify({
                    type: "join_room",
                    roomId
               });
               console.log(data);
               ws.send(data);
          }

          ws.onerror = (err) => {
               console.error("WebSocket error:", err);
          };

     }, [])

     if(!socket) {
          return <div>
               Connecting to server...
          </div>
     }

     return <div>
          <Canvas roomId={roomId} socket={socket}/>
     </div>
}