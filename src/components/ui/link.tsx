"use client";

import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import React, { forwardRef } from "react";

export type LinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextLinkProps> &
  Omit<NextLinkProps, "href"> & {
    href?: string;
    to?: string;
  };

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ href, to, ...props }, ref) => {
  const target = href || to || "#";
  return <NextLink ref={ref} href={target} {...props} />;
});

Link.displayName = "Link";

export default Link;
