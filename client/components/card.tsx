import * as React from "react";
import { cva } from "class-variance-authority";

const cardVariants = cva("md:rounded-lg text-gray-100 shadow-sm");
const cardHeaderVariants = cva("flex flex-col space-y-1.5 p-3");
const cardTitleVariants = cva("font-semibold leading-none tracking-tight");
const cardDescriptionVariants = cva("text-sm text-gray-400");
const cardContentVariants = cva("pt-0");
const cardFooterVariants = cva("flex items-center p-3 pt-0");

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cardVariants({ className })} {...props} />
));
Card.displayName = "Card";

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cardHeaderVariants({ className })} {...props} />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3 ref={ref} className={cardTitleVariants({ className })} {...props} />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cardDescriptionVariants({ className })} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cardContentVariants({ className })} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cardFooterVariants({ className })} {...props} />
));
CardFooter.displayName = "CardFooter";
