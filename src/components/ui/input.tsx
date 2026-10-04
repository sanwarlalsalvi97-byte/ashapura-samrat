import * as React from "react";

import { cn } from "@/lib/utils";

const PRESERVED_CONTROL_TYPES = new Set([
  "checkbox",
  "color",
  "date",
  "datetime-local",
  "file",
  "hidden",
  "month",
  "password",
  "radio",
  "range",
  "time",
  "week",
]);

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", autoComplete, ...props }, ref) => {
    const resolvedType = PRESERVED_CONTROL_TYPES.has(type) ? type : "text";
    const isTextKeyboard = resolvedType === "text" || resolvedType === "password";

    return (
      <input
        type={resolvedType}
        {...props}
        inputMode={isTextKeyboard ? "text" : undefined}
        autoComplete={autoComplete ?? "on"}
        autoCorrect={isTextKeyboard ? "on" : undefined}
        spellCheck={isTextKeyboard}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
