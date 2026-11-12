import type { Metadata } from "next";
import ChatLogsPage from "@/components/chat-logs/ChatLogsPage";

export const metadata: Metadata = {
  title: "Conversations RZBot | RZMedical Admin",
  description: "Historique des conversations entre les clients et le chatbot RZBot",
};

export default function Page() {
  return <ChatLogsPage />;
}
