import { Tool } from "@/components/Canvas";
import { getShapes } from "./http";
import rough from "roughjs"

type Shape = {
     id: string;
     type: "rectangle";
     x: number;
     y: number;
     width: number;
     height: number
} | {
     id: string;
     type: "circle";
     centreX: number;
     centreY: number;
     radius: number;
} | {
     id: string;
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
     private lastMoveTime = 0;
     private moveThrottle = 16; // ~60fps  -> Thanks AI!

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
               } else if(message.type == "erase") {
                    const parsedMessage = JSON.parse(message.message);
                    const shapesToErase = parsedMessage.shapesToErase;
                    
                    // Remove the erased shapes from local array
                    this.existingShapes = this.existingShapes.filter(existingShape => {
                         return !shapesToErase.some((eraseShape: Shape) => 
                              this.areShapesEqual(existingShape, eraseShape)
                         );
                    });
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
          // Convert to canvas coordinates
          const rect = this.canvas.getBoundingClientRect();
          this.StartX = e.clientX - rect.left;
          this.StartY = e.clientY - rect.top;

          if (this.selectedTool === "pencil") {
               this.pencilPoints = [{ x: this.StartX, y: this.StartY }];
          }
     }
     
     mouseUpHandler = (e: MouseEvent) => {
          console.log("Mouse up event fired");
          this.clicked = false;
          // Convert to canvas coordinates
          const rect = this.canvas.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;
          const width = mouseX - this.StartX;
          const height = mouseY - this.StartY;

          if (this.selectedTool === "eraser") {
               const cursorX = mouseX;
               const cursorY = mouseY;

               // Find shapes that will be erased
               const shapesToErase = this.existingShapes.filter((shape) => {
                    return (
                    this.isPointNearRect(cursorX, cursorY, shape) ||
                    this.isPointNearCircle(cursorX, cursorY, shape) ||
                    this.isPointNearPencil(cursorX, cursorY, shape)
                    );
               });

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
                    
                    // Sending erase action to backend and other clients to delete their entries from the table
                    if (this.socket.readyState === WebSocket.OPEN) {
                         this.socket.send(JSON.stringify({
                              type: "erase",
                              message: JSON.stringify({ shapesToErase }),
                              roomId: this.roomId
                         }));
                    }
               }
               return;
          }

          // @ts-ignore
          let shape: Shape | null = null;
          if (this.selectedTool === "rectangle") {
               shape = {
                    id: crypto.randomUUID(),
                    type: "rectangle",
                    x: this.StartX,
                    y: this.StartY,
                    height,
                    width
               }
          } else if (this.selectedTool === "circle") {
               const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
               shape = {
                    id: crypto.randomUUID(),
                    type: "circle",
                    radius: radius,
                    centreX: this.StartX + width / 2,
                    centreY: this.StartY + height / 2,
               }
          } else if(this.selectedTool === "pencil") {
               shape = {
                    id: crypto.randomUUID(),
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
          // Throttle mouse move events to ~60fps to reduce jittering
          const now = Date.now();
          if (now - this.lastMoveTime < this.moveThrottle) {
               return;
          }
          this.lastMoveTime = now;

          if(this.clicked && this.selectedTool !== "eraser") {
               // Converting to canvas coordinates
               const rect = this.canvas.getBoundingClientRect();
               const mouseX = e.clientX - rect.left;
               const mouseY = e.clientY - rect.top;
               
               if (this.selectedTool === "pencil") {
                    this.pencilPoints.push({ x: mouseX, y: mouseY });
                    this.rc.linearPath(
                         this.pencilPoints.map((p) => [p.x, p.y]),
                         { stroke: "white" }
                    );
               } else {
                    const width = mouseX - this.StartX;
                    const height = mouseY - this.StartY;
                    
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
                    }
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

     areShapesEqual(shape1: Shape, shape2: Shape): boolean {
          return shape1.id === shape2.id;
     }

}

