import {SearchPage} from "@/components/layout/SearchPage";
export default async function Page({searchParams}:{searchParams:Promise<{q?:string}>}){
  const {q}=await searchParams;const query=typeof q==="string"?q.slice(0,100):"";
  return <SearchPage key={query} query={query}/>;
}
