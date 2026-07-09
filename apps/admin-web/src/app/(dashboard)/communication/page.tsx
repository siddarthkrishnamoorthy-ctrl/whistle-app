"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui";
import { ChatTab } from "./chat-tab";
import { NoticeBoardTab } from "./notice-board-tab";
import { WhatsappTab } from "./whatsapp-tab";

type Tab = "chat" | "notices" | "whatsapp";

export default function CommunicationPage() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Communication</h1>
        <p className="text-sm text-text-secondary">Chat, Notice Board, and WhatsApp settings</p>
      </div>

      <Tabs
        tabs={[
          { key: "chat", label: "Chat" },
          { key: "notices", label: "Notice Board" },
          { key: "whatsapp", label: "WhatsApp" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "chat" && <ChatTab />}
      {tab === "notices" && <NoticeBoardTab />}
      {tab === "whatsapp" && <WhatsappTab />}
    </div>
  );
}
