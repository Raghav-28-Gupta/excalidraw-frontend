import { HTTP_BACKEND } from "@/config";
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


export async function initDraw(canvas:HTMLCanvasElement, roomId: string, socket: WebSocket) {
     const ctx = canvas.getContext('2d');

     let existingShapes: Shape[] = await getShapes(roomId);

     if(!ctx) return;

     socket.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if(message.type == "chat") {
               const parsedShape = JSON.parse(message.message);
               existingShapes.push(parsedShape.shape);
               clearCanvas(existingShapes, canvas, ctx);
          }
     }

     clearCanvas(existingShapes, canvas, ctx);

     let clicked = false;
     let StartX = 0;
     let StartY = 0;
     canvas.addEventListener("mousedown", (e) => {
          clicked = true;
          StartX = e.clientX;
          StartY = e.clientY;
     })
     
     canvas.addEventListener("mouseup", (e) => {
          console.log("Mouse up event fired");
          clicked = false;
          const width = e.clientX - StartX;
          const height = e.clientY - StartY;
          // @ts-ignore
          const selectedTool = window.selectedTool;
          let shape: Shape | null = null;
          if (selectedTool === "rect") {
               shape = {
                    type: "rect",
                    x: StartX,
                    y: StartY,
                    height,
                    width
               }
          } else if (selectedTool === "circle") {
               const radius = Math.max(width, height) / 2;
               shape = {
                    type: "circle",
                    radius: radius,
                    centreX: StartX + radius,
                    centreY: StartY + radius,
               }
          }

          if (!shape) {
               return;
          }

        existingShapes.push(shape);
          console.log("Before WebSocket send check", socket.readyState);
          if (socket.readyState === WebSocket.OPEN) {
               console.log("data sending")
               socket.send(JSON.stringify({
                    type: "chat",
                    message: JSON.stringify({shape}),
                    roomId
               }));
               console.log("data sent")
          } else {
               console.warn("WebSocket not ready, state:", socket.readyState);
          }
     })

     

     canvas.addEventListener("mousemove", (e) => {
          if(clicked) {
               const width = e.clientX - StartX;
               const height = e.clientY - StartY;
               clearCanvas(existingShapes, canvas, ctx);
               ctx.strokeStyle = "rgba(255, 255, 255)";
               // @ts-ignore
               const selectedTool = window.selectedTool;
               if(selectedTool === "rectangle") {
                    ctx.strokeRect(StartX, StartY, width, height);
               } else if(selectedTool === "circle") {
                    ctx.beginPath();
                    const centreX = StartX + width / 2;
                    const centreY = StartY + height / 2;
                    const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
                    ctx.arc(centreX, centreY, radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.closePath();
               }
               
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
          } else if(shape.type === 'circle') {
               ctx.beginPath();
               ctx.arc(shape.centreX, shape.centreY, shape.radius, 0, Math.PI * 2);
               ctx.stroke();
               ctx.closePath(); 
          }
     })
}


async function getShapes(roomId:string) {
     const res = await axios.get(`${HTTP_BACKEND}/room/chat/${roomId}`);
     const messages = res.data.messages;

     const shapes = messages.map((x : {message : string}) => {
          const messageData = JSON.parse(x.message);
          return messageData.shape;
     })

     return shapes;
}