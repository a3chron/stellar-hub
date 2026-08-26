"use client";

import type { ReactElement, ReactNode } from "react";
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

type OS = "linux-macos" | "windows";

interface OSTabProps {
  os: OS;
  children: ReactNode;
}

export function OSTab({ children }: OSTabProps) {
  return <>{children}</>;
}

interface OSTabsProps {
  children: ReactNode;
}

const TAB_LABELS: Record<OS, string> = {
  "linux-macos": "Linux / macOS",
  windows: "Windows",
};

const TABS: OS[] = ["linux-macos", "windows"];

export function OSTabs({ children }: OSTabsProps) {
  const [active, setActive] = useState<OS>("linux-macos");
  const tabRefs = useRef<Partial<Record<OS, HTMLButtonElement | null>>>({});
  const baseId = useId();

  useEffect(() => {
    const uad = (navigator as { userAgentData?: { platform?: string } })
      .userAgentData;
    if (
      uad?.platform === "Windows" ||
      /Win(dows|32|64)/i.test(navigator.userAgent)
    ) {
      setActive("windows");
    }
  }, []);

  const tabId = (os: OS) => `${baseId}-tab-${os}`;
  const panelId = (os: OS) => `${baseId}-panel-${os}`;

  // Every panel is rendered and the inactive ones hidden, rather than
  // rendering only the active one, so that each tab's aria-controls points at
  // an element that actually exists in the DOM.
  const panels = Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child)) return [];
    const element = child as ReactElement<OSTabProps>;
    return TABS.includes(element.props.os) ? [element] : [];
  });

  // Only offer tabs a panel was supplied for, in TABS order. A block with
  // just a linux-macos tab would otherwise render an empty panel for
  // visitors auto-switched to Windows.
  const tabs = TABS.filter((os) => panels.some((p) => p.props.os === os));
  const activeTab = tabs.includes(active) ? active : tabs[0];

  // WAI-ARIA tabs pattern: Left/Right (and Home/End) move focus and
  // selection between tabs; only the active tab sits in the Tab order.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex = -1;

    switch (e.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    e.preventDefault();
    const next = tabs[nextIndex];
    setActive(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Operating system"
        className="flex gap-2 mb-4"
      >
        {tabs.map((os) => (
          <button
            key={os}
            ref={(el) => {
              tabRefs.current[os] = el;
            }}
            type="button"
            role="tab"
            id={tabId(os)}
            aria-selected={activeTab === os}
            aria-controls={panelId(os)}
            tabIndex={activeTab === os ? 0 : -1}
            onClick={() => setActive(os)}
            onKeyDown={handleKeyDown}
            className={cn(
              "border-2 rounded-lg px-4 py-2 text-sm font-medium transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base",
              activeTab === os
                ? "bg-ctp-text text-ctp-base border-ctp-subtext0"
                : "bg-ctp-mantle text-ctp-text border-ctp-crust hover:ring-2 hover:ring-ctp-surface0",
            )}
          >
            {TAB_LABELS[os]}
          </button>
        ))}
      </div>
      {panels.map((panel) => (
        <div
          key={panel.props.os}
          role="tabpanel"
          id={panelId(panel.props.os)}
          aria-labelledby={tabId(panel.props.os)}
          hidden={panel.props.os !== activeTab}
        >
          {panel}
        </div>
      ))}
    </div>
  );
}
