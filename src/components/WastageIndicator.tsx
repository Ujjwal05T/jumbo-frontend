/**
 * Wastage Indicator Component
 * Shows a badge when an inventory item is from wastage
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { Recycle } from "lucide-react";

interface WastageIndicatorProps {
  isWastageRoll?: boolean;
  variant?: "default" | "secondary" | "outline";
  size?: "sm" | "default" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function WastageIndicator({
  isWastageRoll = false,
  variant = "secondary",
  size = "sm",
  showIcon = true,
  className = ""
}: WastageIndicatorProps) {
  if (!isWastageRoll) {
    return null;
  }

  return (
    <Badge 
      variant={variant} 
      className={`inline-flex items-center gap-1 ${className}`}
    >
      {showIcon && <Recycle className="h-3 w-3" />}
      WASTAGE
    </Badge>
  );
}

export default WastageIndicator;