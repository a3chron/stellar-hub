import {
  Info,
  Lightbulb,
  MessageSquareWarning,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

export type CalloutType = "note" | "tip" | "important" | "warning" | "caution";

const CALLOUT_CONFIG: Record<
  CalloutType,
  {
    icon: typeof Info;
    colorClass: string;
    borderClass: string;
    defaultTitle: string;
  }
> = {
  note: {
    icon: Info,
    colorClass: "text-ctp-blue",
    borderClass: "border-l-ctp-blue",
    defaultTitle: "Note",
  },
  tip: {
    icon: Lightbulb,
    colorClass: "text-ctp-green",
    borderClass: "border-l-ctp-green",
    defaultTitle: "Tip",
  },
  important: {
    icon: MessageSquareWarning,
    colorClass: "text-ctp-mauve",
    borderClass: "border-l-ctp-mauve",
    defaultTitle: "Important",
  },
  warning: {
    icon: TriangleAlert,
    colorClass: "text-ctp-yellow",
    borderClass: "border-l-ctp-yellow",
    defaultTitle: "Warning",
  },
  caution: {
    icon: OctagonAlert,
    colorClass: "text-ctp-red",
    borderClass: "border-l-ctp-red",
    defaultTitle: "Caution",
  },
};

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

export default function Callout({
  type = "note",
  title,
  children,
}: CalloutProps) {
  const {
    icon: Icon,
    colorClass,
    borderClass,
    defaultTitle,
  } = CALLOUT_CONFIG[type];

  return (
    <div
      className={`rounded-lg border-2 border-ctp-crust border-l-4 ${borderClass} bg-ctp-mantle p-4 my-6`}
    >
      {/* Title stays text-ctp-text: the accent colors don't reach AA contrast
          on the mantle background in Latte, so color lives in icon + border. */}
      <div className="flex items-center gap-2 font-medium text-ctp-text">
        <Icon size={16} className={colorClass} aria-hidden="true" />
        <span>{title ?? defaultTitle}</span>
      </div>
      <div className="text-sm text-ctp-subtext1 [&>p]:mb-0 mt-2">
        {children}
      </div>
    </div>
  );
}
