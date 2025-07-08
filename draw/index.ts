import axios from "axios";


type Shape = {
     type: "rect";
     x: number;
     y: number;
     width: number;
     height: number
} | {
     type: "circle";
     centreX: number;
     centreY: number;
     radius: number;
}


export function initDraw(canvas:HTMLCanvasElement) {
     const ctx = canvas.getContext('2d');
     if(!ctx) return;

     let existingShapes: Shape[] = [];

     ctx.fillStyle = "rgba(0, 0, 0)";
     ctx.fillRect(0, 0, canvas.width, canvas.height);

     let clicked = false;
     let StartX = 0;
     let StartY = 0;
     canvas.addEventListener("mousedown", (e) => {
          clicked = true;
          StartX = e.clientX;
          StartY = e.clientY;
     })
     canvas.addEventListener("mouseup", (e) => {
          clicked = false;
          const width = e.clientX - StartX;
          const height = e.clientY - StartY;
          existingShapes.push({
               type: "rect",
               x: StartX,
               y: StartY,
               width, 
               height
          });
     })
     canvas.addEventListener("mousemove", (e) => {
          if(clicked) {
               const width = e.clientX - StartX;
               const height = e.clientY - StartY;
               clearCanvas(existingShapes, canvas, ctx);
               ctx.strokeStyle = "rgba(255, 255, 255)";
               ctx.strokeRect(StartX, StartY, width, height);
          }
     })
}


function clearCanvas(existingShapes: Shape[], canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
     ctx.clearRect(0, 0, canvas.width, canvas.height);
     ctx.fillStyle = "rgba(0, 0, 0)";
     ctx.fillRect(0, 0, canvas.width, canvas.height);

     existingShapes.map((shape) => {
          if(shape.type === "rect") {
               ctx.strokeStyle = "rgba(255, 255, 255)";
               ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
          }
     })
}


function getShapes(roomId:string) {
     axios.get
}