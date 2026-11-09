import {notFound} from "next/navigation";
import {TaskDetail} from "@/components/checklist/TaskDetail";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9]\d*$/.test(id))notFound();return <TaskDetail id={id}/>;}
