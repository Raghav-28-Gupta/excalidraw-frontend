import { HTTP_BACKEND } from "@/config";
import axios from "axios";

export async function getShapes(roomId:string) {
     const res = await axios.get(`${HTTP_BACKEND}/room/chat/${roomId}`);
     const messages = res.data.messages;

     const shapes = messages.map((x : {message : string}) => {
          const messageData = JSON.parse(x.message);
          const shape = messageData.shape;
          
          // Add consistent ID to shapes that don't have one (backward compatibility)
          if (!shape.id) {
               // Create a deterministic ID based on shape properties
               const shapeKey = JSON.stringify({
                    type: shape.type,
                    ...shape
               });
               // Simple hash function to create consistent ID
               let hash = 0;
               for (let i = 0; i < shapeKey.length; i++) {
                    const char = shapeKey.charCodeAt(i);
                    hash = ((hash << 5) - hash) + char;
                    hash = hash & hash; // Convert to 32-bit integer
               }
               shape.id = `legacy_${Math.abs(hash).toString(36)}`;
          }
          
          return shape;
     })

     return shapes;
}