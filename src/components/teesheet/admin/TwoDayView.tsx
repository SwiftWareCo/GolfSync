"use client";

import { useEffect, useRef, useState, CSSProperties } from "react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { disableNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/disable-native-drag-preview";
import { preventUnhandled } from "@atlaskit/pragmatic-drag-and-drop/prevent-unhandled";
import { TeesheetTable } from "./TeesheetTable";
import { addDays, formatDate, parseDate } from "~/lib/dates";

interface TwoDayViewProps {
  currentDateString: string;
}

const DEFAULT_LEFT_WIDTH = 50;
const MIN_WIDTH = 30;
const MAX_WIDTH = 70;
const STORAGE_KEY = "two-day-left-panel-width";

export function TwoDayView({ currentDateString }: TwoDayViewProps) {
  const dividerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);

  // Load saved width from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const width = parseInt(saved, 10);
      if (!isNaN(width) && width >= MIN_WIDTH && width <= MAX_WIDTH) {
        setLeftWidth(width);
      }
    }
  }, []);

  // Setup drag handler for divider
  useEffect(() => {
    const divider = dividerRef.current;
    if (!divider) return;

    return draggable({
      element: divider,
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        disableNativeDragPreview({ nativeSetDragImage });
        preventUnhandled.start();
      },
      onDragStart() {
        setIsDragging(true);
      },
      onDrag({ location }) {
        const container = containerRef.current;
        if (!container) return;

        const containerRect = container.getBoundingClientRect();
        const currentX = location.current.input.clientX;
        const containerLeft = containerRect.left;
        const newWidth =
          ((currentX - containerLeft) / containerRect.width) * 100;

        const constrainedWidth = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, newWidth)
        );

        setLeftWidth(constrainedWidth);
      },
      onDrop() {
        preventUnhandled.stop();
        setIsDragging(false);

        // Persist width to localStorage
        localStorage.setItem(STORAGE_KEY, Math.round(leftWidth).toString());
      },
    });
  }, [leftWidth]);

  const nextDateString = formatDate(
    addDays(parseDate(currentDateString), 1),
    "yyyy-MM-dd"
  );

  return (
    <div
      ref={containerRef}
      className="flex h-full w-full gap-0 overflow-hidden"
      style={
        {
          "--left-panel-width": `${leftWidth}%`,
        } as CSSProperties
      }
    >
      {/* Left Panel - Current Date */}
      <div className="min-h-0 flex-shrink-0 overflow-y-auto border-r border-gray-200" style={{ width: "var(--left-panel-width)" }}>
        <div className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            {formatDate(parseDate(currentDateString))}
          </h3>
          <TeesheetTable dateString={currentDateString} />
        </div>
      </div>

      {/* Resizable Divider */}
      <div
        ref={dividerRef}
        className={`w-1 flex-shrink-0 cursor-ew-resize select-none bg-gray-300 transition-colors hover:bg-blue-400 ${
          isDragging ? "bg-blue-500" : ""
        }`}
      />

      {/* Right Panel - Next Date */}
      <div className="min-h-0 flex-1 overflow-y-auto" style={{ width: `${100 - leftWidth}%` }}>
        <div className="p-4">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            {formatDate(addDays(parseDate(currentDateString), 1))}
          </h3>
          <TeesheetTable dateString={nextDateString} />
        </div>
      </div>
    </div>
  );
}
