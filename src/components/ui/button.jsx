import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-nunito font-700 transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-habit-purple text-white shadow-sm hover:bg-[#4e42a0] rounded-full",
        destructive:
          "bg-habit-red text-white shadow-sm hover:bg-red-600 rounded-full",
        outline:
          "border-2 border-habit-purple bg-white text-habit-purple hover:bg-habit-purple-light rounded-full",
        secondary:
          "bg-[#e8e4ff] text-habit-purple shadow-sm hover:bg-[#d8d2ff] rounded-full",
        ghost: "hover:bg-[#e8e4ff] text-habit-purple rounded-xl",
        link: "text-habit-purple underline-offset-4 hover:underline",
        fantasy:
          "bg-habit-purple text-white rounded-full hover:bg-[#4e42a0] shadow-sm",
        pixel:
          "border-2 border-habit-purple bg-white text-habit-purple rounded-full hover:bg-habit-purple-light",
      },
      size: {
        default: "h-9 px-5 py-2 text-sm",
        sm: "h-8 px-4 text-xs",
        lg: "h-11 px-8 text-base",
        icon: "h-9 w-9 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = React.forwardRef(
  /**
   * @param {any} props
   * @param {React.ForwardedRef<any>} ref
   */
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    (<Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}>
      {children}
    </Comp>)
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }