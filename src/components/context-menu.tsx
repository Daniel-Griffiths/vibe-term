import { useEffect, useRef, useCallback } from "react";

interface IContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  children: React.ReactNode;
}

export function ContextMenu({ isOpen, position, onClose, children }: IContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      onClose();
    }
  }, [onClose]);

  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleClickOutside, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-md shadow-lg py-1 min-w-48"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {children}
    </div>
  );
}

interface IContextMenuItemProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function ContextMenuItem({ onClick, disabled = false, children }: IContextMenuItemProps) {
  return (
    <button
      className={`w-full text-left px-3 py-2 text-sm ${
        disabled
          ? "text-gray-500 cursor-not-allowed"
          : "text-gray-200 hover:bg-gray-700 cursor-pointer"
      }`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}