"use client";

import {
  CheckIcon,
  CopyIcon,
  ShieldAlertIcon,
  TextSearchIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ConfigPreviewData {
  version: string;
  configContent: string;
  hasCustomCommands: boolean;
  versionNotes: string | null;
  dependencies: string[] | null;
  minStarshipVersion: string;
  createdAt: string;
}

interface ConfigPreviewModalProps {
  author: string;
  slug: string;
  version: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ConfigPreviewModal({
  author,
  slug,
  version,
  isOpen,
  onClose,
}: ConfigPreviewModalProps) {
  const [data, setData] = useState<ConfigPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && !data) {
      setLoading(true);
      setError(null);
      fetch(`/api/${author}/${slug}/${version}?preview=true`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch config");
          return res.json();
        })
        .then((json) => {
          setData(json);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, author, slug, version, data]);

  const handleCopy = useCallback(() => {
    if (data?.configContent) {
      navigator.clipboard.writeText(data.configContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ctp-crust/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className="bg-ctp-mantle border border-ctp-surface0 rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ctp-surface0">
          <h2 className="text-xl font-semibold">Config Preview - v{version}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ctp-subtext0 hover:text-ctp-text transition-colors p-1"
            aria-label="Close"
          >
            <XIcon size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ctp-text" />
            </div>
          )}

          {error && (
            <div className="text-ctp-red bg-ctp-red/10 rounded-lg p-4">
              {error}
            </div>
          )}

          {data && (
            <>
              {data.hasCustomCommands && (
                <div className="mb-4 p-4 bg-ctp-peach/10 border border-ctp-peach rounded-lg">
                  <div className="flex items-start gap-3">
                    <TriangleAlertIcon className="text-ctp-peach" />
                    <div>
                      <h3 className="font-semibold text-ctp-peach">
                        Custom Commands Detected
                      </h3>
                      <p className="text-ctp-subtext1 text-sm mt-1">
                        This theme contains{" "}
                        <code className="bg-ctp-surface0 px-1 rounded">
                          [custom.*]
                        </code>{" "}
                        sections that can execute arbitrary shell commands on
                        your system. Review the config carefully before
                        applying.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <pre className="bg-ctp-base rounded-lg p-4 overflow-x-auto text-sm font-mono text-ctp-text border border-ctp-surface0">
                  {data.configContent}
                </pre>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ctp-surface0">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2 bg-ctp-surface0 border-2 border-ctp-surface1 text-ctp-text rounded-lg flex items-center gap-2 cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckIcon className="text-ctp-green" size={16} />
                  Copied!
                </>
              ) : (
                <>
                  <CopyIcon size={16} />
                  Copy to Clipboard
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-ctp-text border-2 border-ctp-subtext0 text-ctp-crust rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ViewConfigButtonProps {
  author: string;
  slug: string;
  version: string;
  customCommand: boolean;
}

export function ViewConfigButton({
  author,
  slug,
  version,
  customCommand,
}: ViewConfigButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs cursor-pointer"
      >
        {customCommand ? (
          <ShieldAlertIcon size={20} className="text-ctp-peach" />
        ) : (
          <TextSearchIcon size={20} className="text-ctp-subtext0" />
        )}
      </button>
      <ConfigPreviewModal
        author={author}
        slug={slug}
        version={version}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
