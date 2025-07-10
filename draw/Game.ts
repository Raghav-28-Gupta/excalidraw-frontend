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

     // Zoom Implementation
     private scale = 1;
     private offsetX = 0;
     private offsetY = 0;
     private minScale = 0.2;
     private maxScale = 10;


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
          this.canvas.removeEventListener("wheel", this.handleWheel);
     }

     setTool(tool: "circle" | "rectangle" | "pencil" | "eraser"){
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
          this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any transform
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

          // Apply zoom and pan
          this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

          // Draw background
          this.ctx.fillStyle = "black";
          this.ctx.fillRect(0, 0, this.canvas.width / this.scale, this.canvas.height / this.scale);


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

          if (this.selectedTool === "eraser") {
               const cursorX = e.clientX;
               const cursorY = e.clientY;

               const newShapes = this.existingShapes.filter((shape) => {
                    return !(
                    this.isPointNearRect(cursorX, cursorY, shape) ||
                    this.isPointNearCircle(cursorX, cursorY, shape) ||
                    this.isPointNearPencil(cursorX, cursorY, shape)
                    );
               });

               if (newShapes.length !== this.existingShapes.length) {
                    this.existingShapes = newShapes;
                    this.clearCanvas();
               }
               return;
          }

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
          this.canvas.addEventListener("wheel", this.handleWheel, { passive: false });
     }

     handleWheel = (e: WheelEvent) => {
          e.preventDefault();
          const zoomSensitivity = 0.1;
          const mouseX = e.offsetX;
          const mouseY = e.offsetY;

          const direction = e.deltaY > 0 ? -1 : 1;
          const zoomFactor = 1 + direction * zoomSensitivity;

          const newScale = this.scale * zoomFactor;
          if (newScale < this.minScale || newScale > this.maxScale) return;

          // Adjust offset to zoom around mouse
          this.offsetX = mouseX - ((mouseX - this.offsetX) * zoomFactor);
          this.offsetY = mouseY - ((mouseY - this.offsetY) * zoomFactor);

          this.scale = newScale;
          this.clearCanvas();
     };


     isPointNearRect(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "rectangle") return false;
          return (
          px >= shape.x &&
          px <= shape.x + shape.width &&
          py >= shape.y &&
          py <= shape.y + shape.height
          );
     }

     isPointNearCircle(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "circle") return false;
          const dx = px - shape.centreX;
          const dy = py - shape.centreY;
          return Math.sqrt(dx * dx + dy * dy) <= shape.radius;
     }

     isPointNearPencil(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "pencil") return false;
          for (let point of shape.points) {
          const dx = px - point.x;
          const dy = py - point.y;
          if (Math.sqrt(dx * dx + dy * dy) <= 10) return true;
          }
          return false;
     }

}

