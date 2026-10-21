import { questionBank } from "@/lib/data.ts";
import Discover from "./Discover.tsx";

export default function Home() {
  return <Discover bank={questionBank} />;
}
