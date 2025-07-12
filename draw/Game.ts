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

     // Infinite canvas properties
     private offsetX = 0;
     private offsetY = 0;
     private isPanning = false;
     private panStartX = 0;
     private panStartY = 0;
     private panStartOffsetX = 0;
     private panStartOffsetY = 0;

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
          this.canvas.removeEventListener("wheel", this.wheelHandler);
          this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
     }

     setTool(tool: "circle" | "rectangle" | "pencil" | "eraser"){
          this.selectedTool = tool;
     }

     // Converting screen coordinates to world coordinates
     private screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
          return {
               x: screenX - this.offsetX,
               y: screenY - this.offsetY
          };
     }

     // Converting world coordinates to screen coordinates
     private worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
          return {
               x: worldX + this.offsetX,
               y: worldY + this.offsetY
          };
     }

     // Get mouse position relative to canvas
     private getMousePosition(e: MouseEvent): { x: number; y: number } {
          const rect = this.canvas.getBoundingClientRect();
          return {
               x: e.clientX - rect.left,
               y: e.clientY - rect.top
          };
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

          // Save current transformation
          this.ctx.save();
          // Apply translation for infinite canvas
          this.ctx.translate(this.offsetX, this.offsetY);

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

          // Restore transformation
          this.ctx.restore();
     }

     
     mouseDownHandler = (e: MouseEvent) => {
          const mousePos = this.getMousePosition(e);
          
          // Check if middle mouse button or Ctrl key is held for panning
          if (e.button === 1 || e.ctrlKey || e.metaKey) {
               this.isPanning = true;
               this.panStartX = mousePos.x;
               this.panStartY = mousePos.y;
               this.panStartOffsetX = this.offsetX;
               this.panStartOffsetY = this.offsetY;
               this.canvas.style.cursor = 'grabbing';
               return;
          }

          this.clicked = true;
          // Converting to world coordinates
          const worldPos = this.screenToWorld(mousePos.x, mousePos.y);
          this.StartX = worldPos.x;
          this.StartY = worldPos.y;

          if (this.selectedTool === "pencil") {
               this.pencilPoints = [{ x: this.StartX, y: this.StartY }];
          }
     }
     
     mouseUpHandler = (e: MouseEvent) => {
          if (this.isPanning) {
               this.isPanning = false;
               this.canvas.style.cursor = 'default';
               return;
          }

          console.log("Mouse up event fired");
          this.clicked = false;
          
          const mousePos = this.getMousePosition(e);
          const worldPos = this.screenToWorld(mousePos.x, mousePos.y);
          const width = worldPos.x - this.StartX;
          const height = worldPos.y - this.StartY;

          if (this.selectedTool === "eraser") {
               const cursorX = worldPos.x;
               const cursorY = worldPos.y;

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

          const mousePos = this.getMousePosition(e);

          // Handle panning
          if (this.isPanning) {
               const deltaX = mousePos.x - this.panStartX;
               const deltaY = mousePos.y - this.panStartY;
               this.offsetX = this.panStartOffsetX + deltaX;
               this.offsetY = this.panStartOffsetY + deltaY;
               this.clearCanvas();
               return;
          }

          if(this.clicked && this.selectedTool !== "eraser") {
               const worldPos = this.screenToWorld(mousePos.x, mousePos.y);
               
               if (this.selectedTool === "pencil") {
                    this.pencilPoints.push({ x: worldPos.x, y: worldPos.y });
                    
                    // Save current transformation
                    this.ctx.save();
                    this.ctx.translate(this.offsetX, this.offsetY);
                    
                    this.rc.linearPath(
                         this.pencilPoints.map((p) => [p.x, p.y]),
                         { stroke: "white" }
                    );
                    
                    // Restore transformation
                    this.ctx.restore();
               } else {
                    const width = worldPos.x - this.StartX;
                    const height = worldPos.y - this.StartY;
                    
                    this.clearCanvas();
                    
                    // Save current transformation
                    this.ctx.save();
                    this.ctx.translate(this.offsetX, this.offsetY);
                    
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
                    
                    // Restore transformation
                    this.ctx.restore();
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
          this.canvas.addEventListener("wheel", this.wheelHandler);
          this.canvas.addEventListener("contextmenu", this.preventContextMenu);
     }

     wheelHandler = (e: WheelEvent) => {
          e.preventDefault();
          
          // Pan with wheel
          const panSpeed = 1;
          this.offsetX -= e.deltaX * panSpeed;
          this.offsetY -= e.deltaY * panSpeed;
          
          this.clearCanvas();
     }

     preventContextMenu = (e: Event) => {
          e.preventDefault();
     }

     isPointNearRect(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "rectangle") return false;
          // Increase precision: shrink hitbox for small rectangles
          const minSize = 8; // px
          const x0 = shape.x;
          const x1 = shape.x + Math.max(shape.width, minSize);
          const y0 = shape.y;
          const y1 = shape.y + Math.max(shape.height, minSize);
          return (
               px >= x0 &&
               px <= x1 &&
               py >= y0 &&
               py <= y1
          );
     }

     isPointNearCircle(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "circle") return false;
          // Increase precision: shrink hitbox for small circles
          const minRadius = 6; // px
          const effectiveRadius = Math.max(shape.radius, minRadius);
          const dx = px - shape.centreX;
          const dy = py - shape.centreY;
          return Math.sqrt(dx * dx + dy * dy) <= effectiveRadius;
     }

     isPointNearPencil(px: number, py: number, shape: Shape): boolean {
          if (shape.type !== "pencil") return false;
          // Increase precision: shrink hitbox for pencil strokes
          const precision = 5; // px
          for (let point of shape.points) {
               const dx = px - point.x;
               const dy = py - point.y;
               if (Math.sqrt(dx * dx + dy * dy) <= precision) return true;
          }
          return false;
     }

     areShapesEqual(shape1: Shape, shape2: Shape): boolean {
          return shape1.id === shape2.id;
     }

     // Public methods for external control of infinite canvas
     public pan(deltaX: number, deltaY: number) {
          this.offsetX += deltaX;
          this.offsetY += deltaY;
          this.clearCanvas();
     }

     public resetView() {
          this.offsetX = 0;
          this.offsetY = 0;
          this.clearCanvas();
     }

     public getViewport() {
          return {
               offsetX: this.offsetX,
               offsetY: this.offsetY,
               width: this.canvas.width,
               height: this.canvas.height
          };
     }
}

