"use client";

import dynamic from "next/dynamic";

const StreamSendPage = dynamic(() => import("../components/StreamSendPage"), { ssr: false });

export default function SendPage() {
    return <StreamSendPage />;
}
