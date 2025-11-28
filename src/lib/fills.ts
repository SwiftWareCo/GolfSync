import type { Fill } from "~/server/db/schema";

/**
 * Get the display label for a fill based on its type and custom name
 */
export function getFillLabel(fill: Fill): string {
  // Custom name takes precedence
  if (fill.customName) {
    return fill.customName;
  }

  // Otherwise return label based on fill type
  // Note: DB stores "guest", "reciprocal", "custom" without _fill suffix
  switch (fill.fillType) {
    case "guest_fill":
    case "guest":
      return "Guest Fill";
    case "reciprocal_fill":
    case "reciprocal":
      return "Recip Fill";
    case "custom_fill":
    case "custom":
      return "Custom Fill";
    default:
      return "Fill";
  }
}
