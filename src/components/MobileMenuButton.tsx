"use client";

import { useState } from "react";

interface MobileMenuButtonProps {
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
}

const MobileMenuButton = ({ isOpen, onToggle }: MobileMenuButtonProps) => {
  return (
    <button
      onClick={() => onToggle(!isOpen)}
      className="rounded-full p-2.5 text-white transition-colors hover:bg-white/10 md:hidden"
    >
      <div className="space-y-1.5">
        <div
          className={`h-0.5 w-5 bg-current transition-all duration-200 ${isOpen ? "translate-y-2 rotate-45" : ""}`}
        ></div>
        <div
          className={`h-0.5 w-5 bg-current transition-all duration-200 ${isOpen ? "opacity-0" : ""}`}
        ></div>
        <div
          className={`h-0.5 w-5 bg-current transition-all duration-200 ${isOpen ? "-translate-y-2 -rotate-45" : ""}`}
        ></div>
      </div>
    </button>
  );
};

export default MobileMenuButton;
