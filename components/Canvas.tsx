import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";

type Shape = "circle" | "rectangle" | "pencil";

export function Canvas({
     roomId,
     socket,
}: {
     socket: WebSocket;
     roomId: string;
}) {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     const [selectedTool, setSelectedTool] = useState<Shape>("circle");

     useEffect(() => {
          // @ts-ignore
          window.selectedTool = selectedTool   // bad pratice
     }, [selectedTool]);

     useEffect(() => {
     if (canvasRef.current) {
          initDraw(canvasRef.current, roomId, socket);
     }
     }, [canvasRef]);

     return (
     <div
          style={{
               height: "100vh",
               overflow: "hidden",
          }}
     >
          <canvas
               ref={canvasRef}
               width={window.innerWidth}
               height={window.innerHeight}
          ></canvas>
          <TopBar selectedTool={selectedTool} setSelectedTool={setSelectedTool}/>
     </div>
     );
}

function TopBar({
     selectedTool,
     setSelectedTool,
}: {
     selectedTool: Shape;
     setSelectedTool: (s: Shape) => void;
}) {
     return (
     <div
          style={{
          position: "fixed",
          top: 10,
          left: 10,
          }}
     >
          <div className="flex gap-2">
          <IconButton
               activated={selectedTool === "pencil"}
               icon={<Pencil />}
               onClick={() => setSelectedTool("pencil")}
          ></IconButton>
          <IconButton
               activated={selectedTool === "rectangle"}
               icon={<RectangleHorizontalIcon />}
               onClick={() => setSelectedTool("rectangle")}
          ></IconButton>
          <IconButton
               activated={selectedTool === "circle"}
               icon={<Circle />}
               onClick={() => setSelectedTool("circle")}
          ></IconButton>
          </div>
     </div>
     );
}
