"use client";

import { useEffect } from "react";

import { captureAttribution } from "@/lib/analytics/attribution";

export default function AttributionCapture() {
  useEffect(() => {
    captureAttribution();
  }, []);

  return null;
}
