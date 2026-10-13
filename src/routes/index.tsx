import { createFileRoute } from "@tanstack/react-router";
import { VisorApp } from "@/components/visor-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <VisorApp />;
}
