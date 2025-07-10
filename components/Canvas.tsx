import { initDraw } from "@/draw";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, Pencil, RectangleHorizontalIcon, Eraser} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rectangle" | "pencil" | "eraser";

export function Canvas({
     roomId,
     socket,
}: {
     socket: WebSocket;
     roomId: string;
}) {
     const canvasRef = useRef<HTMLCanvasElement>(null);
     const [game, setGame] = useState<Game>();
     const [selectedTool, setSelectedTool] = useState<Tool>("circle");

     useEffect(() => {
          // // @ts-ignore
          // window.selectedTool = selectedTool   // bad pratice
          game?.setTool(selectedTool);
     }, [selectedTool, game]);


     useEffect(() => {
          if (canvasRef.current) {
               const g = new Game(canvasRef.current, roomId, socket);
               setGame(g);

               return() => {
                    g.destroy();
               }
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
     selectedTool: Tool;
     setSelectedTool: (s: Tool) => void;
}) {
     return (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
               <div className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm border border-gray-700 rounded-xl px-4 py-2 shadow-lg">
                    <IconButton
                         activated={selectedTool === "pencil"}
                         icon={<Pencil size={20} />}
                         onClick={() => setSelectedTool("pencil")}
                    />
                    <div className="w-px h-6 bg-gray-600" />
                    <IconButton
                         activated={selectedTool === "rectangle"}
                         icon={<RectangleHorizontalIcon size={20} />}
                         onClick={() => setSelectedTool("rectangle")}
                    />
                    <div className="w-px h-6 bg-gray-600" />
                    <IconButton
                         activated={selectedTool === "circle"}
                         icon={<Circle size={20} />}
                         onClick={() => setSelectedTool("circle")}
                    />
                    <div className="w-px h-6 bg-gray-600" />
                    <IconButton
                         activated={selectedTool === "eraser"}
                         icon={<Eraser size={20} />}
                         onClick={() => setSelectedTool("eraser")}
                    />
               </div>
          </div>
     );
}
