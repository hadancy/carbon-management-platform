"use client";

import { useEffect, useRef } from "react";
import { App } from "antd";
import { useRouter } from "next/navigation";
import {
  NAVIGATION_REQUEST,
  type NavigationRequest,
} from "@/components/backend/navigation-guard";

export function useUnsavedChangesWarning(active: boolean) {
  const router = useRouter();
  const { modal } = App.useApp();
  const leaving = useRef(false);

  useEffect(() => {
    if (!active) return;

    function beforeUnload(event: BeforeUnloadEvent) {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    }

    function confirmLeave(proceed: () => void) {
      modal.confirm({
        title: "有尚未保存的修改",
        content: "离开页面将丢失这些修改。可以先取消并保存草稿。",
        okText: "放弃修改并离开",
        okButtonProps: { danger: true },
        cancelText: "继续编辑",
        onOk: () => {
          leaving.current = true;
          proceed();
        },
      });
    }

    function onNavigationRequest(event: Event) {
      event.preventDefault();
      confirmLeave((event as NavigationRequest).detail.proceed);
    }

    function onLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        link.getAttribute("target") === "_blank"
      )
        return;
      const destination = new URL(
        link.getAttribute("href")!,
        window.location.href,
      );
      if (destination.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      confirmLeave(() => {
        if (destination.origin === window.location.origin)
          router.push(
            destination.pathname + destination.search + destination.hash,
          );
        else window.location.assign(destination.href);
      });
    }

    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener(NAVIGATION_REQUEST, onNavigationRequest);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener(NAVIGATION_REQUEST, onNavigationRequest);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [active, modal, router]);
}
