import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        options: {
          sitekey: string;
          action: string;
          theme: "light";
          size: "normal";
          appearance: "interaction-only";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  action: "create_room" | "join_room";
  siteKey: string;
  onToken: (token: string | null) => void;
};

export function TurnstileWidget({ action, siteKey, onToken }: TurnstileWidgetProps) {
  const targetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let widgetId: string | null = null;
    let attempts = 0;
    const mount = () => {
      if (!targetRef.current || !window.turnstile) {
        attempts += 1;
        if (attempts < 100) window.setTimeout(mount, 100);
        return;
      }
      widgetId = window.turnstile.render(targetRef.current, {
        sitekey: siteKey,
        action,
        theme: "light",
        size: "normal",
        appearance: "interaction-only",
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    };

    mount();
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      onToken(null);
    };
  }, [action, onToken, siteKey]);

  return <div ref={targetRef} className="turnstile-slot" aria-label="人机验证" />;
}
