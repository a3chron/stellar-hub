"use client";

import { LogOut, Settings, Upload, User, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function ProfileDropdown({
  userImage,
  userName,
  handleSignout,
}: {
  userImage?: string | null;
  userName: string;
  handleSignout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        className="cursor-pointer"
        onClick={() => setIsOpen((prevBool) => !prevBool)}
        onKeyDown={(e) => e.key === "p" && setIsOpen((prevBool) => !prevBool)}
      >
        {userImage ? (
          <Image
            src={userImage}
            alt={userName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full cursor-pointer hover:ring-2 ring-offset-2 ring-offset-ctp-mantle hover:ring-ctp-surface0 transition-all"
          />
        ) : (
          <div className="flex items-center justify-center bg-ctp-crust w-8 h-8 rounded-full border border-ctp-surface1 hover:border-ctp-lavender transition-all">
            <UserIcon size={24} className="text-ctp-text" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-ctp-base border border-ctp-surface0 rounded-lg shadow-lg overflow-hidden z-50">
          {/* Username Header */}
          <div className="px-4 py-3 border-b border-ctp-surface0">
            <p className="text-sm text-ctp-subtext0">{userName}</p>
          </div>

          {/* Menu Items */}
          <Link
            href="/upload"
            className="flex items-center gap-3 px-4 py-3 text-sm text-ctp-text hover:bg-ctp-surface0 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Upload size={16} className="text-ctp-subtext0" />
            <span>Publish</span>
          </Link>

          <Link
            href={`/${userName}`}
            className="flex items-center gap-3 px-4 py-3 text-sm text-ctp-text hover:bg-ctp-surface0 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <User size={16} className="text-ctp-subtext0" />
            <span>Profile</span>
          </Link>

          <Link
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 text-sm text-ctp-text hover:bg-ctp-surface0 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            <Settings size={16} className="text-ctp-subtext0" />
            <span>Settings</span>
          </Link>

          {/* Divider */}
          <div className="border-t border-ctp-surface0"></div>

          {/* Logout Button */}
          <button
            onClick={() => {
              handleSignout();
              setIsOpen(false);
            }}
            type="submit"
            className="flex items-center gap-3 w-full px-4 py-3 text-sm text-ctp-red hover:bg-ctp-surface0 transition-colors cursor-pointer"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
}
