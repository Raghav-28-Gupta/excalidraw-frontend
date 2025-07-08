import { initDraw } from "@/draw";
import { useEffect, useRef } from "react";

export function Canvas({roomId, socket} : {roomId : string, socket: WebSocket}) {
     const canvasRef = useRef<HTMLCanvasElement>(null);

     useEffect(() => {
          if(canvasRef.current) {
               const canvas = canvasRef.current;
               initDraw(canvas, roomId, socket);
          }
     }, [canvasRef]);
     
     return <div>
          <canvas ref={canvasRef} width={2000} height={1000}></canvas>
     </div>
}