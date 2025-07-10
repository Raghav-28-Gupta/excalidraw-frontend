import { Tool } from "@/components/Canvas";
import { getShapes } from "./http";
import rough from "roughjs"

type Shape = {
     type: "rectangle";
     x: number;
     y: number;
     width: number;
     height: number
} | {
     type: "circle";
     centreX: number;
     centreY: number;
     radius: number;
} | {
     type: "pencil";
     points: { x: number; y: number }[];
}

export class Game {
     private canvas: HTMLCanvasElement;
     private ctx: CanvasRenderingContext2D;
     private existingShapes: Shape[];
     private roomId: string;
     private clicked: boolean;
     private StartX = 0;
     private StartY = 0;
     private selectedTool: Tool = "circle";
     private pencilPoints: { x: number; y: number }[] = [];
     private rc: ReturnType<typeof rough.canvas>;

     socket: WebSocket;

     constructor(canvas:HTMLCanvasElement, roomId: string, socket: WebSocket) {
          this.canvas = canvas;
          this.ctx = canvas.getContext('2d')!;   //By writing !, you tell TypeScript: "I am sure this is not null here."
          this.rc = rough.canvas(this.canvas);
          this.existingShapes = [];
          this.roomId = roomId;
          this.socket = socket;
          this.clicked = false;
          this.init();
          this.initHandlers();
          this.initMouseHandlers();
     }

     destroy() {
          this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
          this.canvas.removeEventListener("mouseup", this.mouseUpHandler);         
          this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
     }

     setTool(tool: "circle" | "rectangle" | "pencil"){
          this.selectedTool = tool;
     }

     async init() {
          this.existingShapes = await getShapes(this.roomId);
          this.clearCanvas();
     }

     initHandlers() {
          this.socket.onmessage = (event) => {
               const message = JSON.parse(event.data);
               if(message.type == "chat") {
                    const parsedShape = JSON.parse(message.message);
                    this.existingShapes.push(parsedShape.shape);
                    this.clearCanvas();
               }
          }
     }

     clearCanvas() {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.fillStyle = "rgba(0, 0, 0)";
          this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

          for (const shape of this.existingShapes) {
               if (shape.type === "rectangle") {
                    this.rc.rectangle(shape.x, shape.y, shape.width, shape.height, {
                    stroke: "white",
               });
               } else if (shape.type === "circle") {
                    this.rc.circle(shape.centreX, shape.centreY, shape.radius * 2, {
                    stroke: "white",
               });
               } else if (shape.type === "pencil") {
                    const points = shape.points.map((p) => [p.x, p.y]);
                    // @ts-ignore
                    this.rc.linearPath(points, { stroke: "white" });
               }
          }
     }

     
     mouseDownHandler = (e: MouseEvent) => {
          this.clicked = true;
          this.StartX = e.clientX;
          this.StartY = e.clientY;

          if (this.selectedTool === "pencil") {
               this.pencilPoints = [{ x: this.StartX, y: this.StartY }];
          }
     }
     
     mouseUpHandler = (e: MouseEvent) => {
          console.log("Mouse up event fired");
          this.clicked = false;
          const width = e.clientX - this.StartX;
          const height = e.clientY - this.StartY;
          // @ts-ignore
          let shape: Shape | null = null;
          if (this.selectedTool === "rectangle") {
               shape = {
                    type: "rectangle",
                    x: this.StartX,
                    y: this.StartY,
                    height,
                    width
               }
          } else if (this.selectedTool === "circle") {
               const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
               shape = {
                    type: "circle",
                    radius: radius,
                    centreX: this.StartX + radius,
                    centreY: this.StartY + radius,
               }
          } else if(this.selectedTool === "pencil") {
               shape = {
                    type: "pencil",
                    points: this.pencilPoints,
               };
               // this.rc.linearPath(
               // this.pencilPoints.map((p) => [p.x, p.y]),
               //      { stroke: "white" }
               // );
          }

          if (!shape) {
               return;
          }

          this.existingShapes.push(shape);
          console.log("Before WebSocket send check", this.socket.readyState);
          if (this.socket.readyState === WebSocket.OPEN) {
               console.log("data sending")
               this.socket.send(JSON.stringify({
                    type: "chat",
                    message: JSON.stringify({shape}),
                    roomId: this.roomId
               }));
               console.log("data sent")
          } else {
               console.warn("WebSocket not ready, state:", this.socket.readyState);
          }
     }

     mouseMoveHandler = (e: MouseEvent) => {
          if(this.clicked) {
               const width = e.clientX - this.StartX;
               const height = e.clientY - this.StartY;
               this.clearCanvas();
               if (this.selectedTool === "rectangle") {
                    this.rc.rectangle(this.StartX, this.StartY, width, height, {
                         stroke: "white",
                    });
               } else if (this.selectedTool === "circle") {
                    const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
                    const centreX = this.StartX + width / 2;
                    const centreY = this.StartY + height / 2;
                    this.rc.circle(centreX, centreY, radius * 2, {
                         stroke: "white",
                    });
               } else if(this.selectedTool === "pencil") {
                    this.pencilPoints.push({ x: e.clientX, y: e.clientY });
                    this.clearCanvas();
                    this.rc.linearPath(
                    this.pencilPoints.map((p) => [p.x, p.y]),
                         { stroke: "white" }
                    );
               }
          }
     }
     

     initMouseHandlers() {
          // Note: Arrow functions do not have their own `this`, so they "capture" the `this` value from the surrounding context (the Game class instance)
          // while Normal functions have their own `this`, which (in event listeners) refers to the DOM element (canvas), not your Game instance.
          // So `this.clicked` is undefined or causes a TypeScript error, because canvas does not have a clicked property
          this.canvas.addEventListener("mousedown", this.mouseDownHandler);
          this.canvas.addEventListener("mouseup", this.mouseUpHandler);         
          this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
     }

          
}