import { ReactNode } from "react";

export function IconButton({icon, onClick, activated} : 
     {
          icon : ReactNode, 
          onClick: () => void,
          activated: boolean
     }) {

     return <div onClick={onClick} className={`m-2 pointer rounded-full border p-2 bg-black 
               ${activated ? "text-red-400" : "text-white"} hover:bg-gray`}>
          {icon}
     </div>
}