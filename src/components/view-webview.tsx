import React, { useState } from "react";
import { Button } from "./button";
import { RotateCcw, Code, ArrowLeft, ArrowRight, Home } from "lucide-react";

interface IViewWebviewProps {
  url: string;
  title: string;
  showUrlBar?: boolean;
}

export default function ViewWebview({
  url,
  title,
  showUrlBar = true,
}: IViewWebviewProps) {
  const [webviewRef, setWebviewRef] = useState<any>(null);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);
  const [originalUrl] = useState(url);
  const isElectron =
    typeof window !== "undefined" && (window as any).electronAPI;

  const handleWebviewReload = () => {
    if (isElectron && webviewRef) {
      webviewRef.reload();
    } else if (iframeRef) {
      const currentSrc = iframeRef.src;
      iframeRef.src = "";
      setTimeout(() => {
        iframeRef.src = currentSrc;
      }, 10);
    }
  };

  const handleOpenDevTools = () => {
    if (isElectron && webviewRef) {
      webviewRef.openDevTools();
    }
    // No dev tools available for iframe in web
  };

  const handleGoBack = () => {
    if (isElectron && webviewRef && webviewRef.canGoBack()) {
      webviewRef.goBack();
    }
    // No back/forward history for iframe
  };

  const handleGoForward = () => {
    if (isElectron && webviewRef && webviewRef.canGoForward()) {
      webviewRef.goForward();
    }
    // No back/forward history for iframe
  };

  const handleGoHome = () => {
    if (isElectron && webviewRef) {
      webviewRef.loadURL(originalUrl);
    } else if (iframeRef) {
      iframeRef.src = originalUrl;
    }
  };

  return (
    <div className="h-full flex-1 flex flex-col glass-card md:rounded-lg overflow-hidden">
      {showUrlBar && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 md:rounded-t-lg">
          {/* Mobile: Stack navigation and URL bar vertically */}
          <div className="md:hidden space-y-2">
            {/* Navigation buttons row */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleGoBack}
                disabled={!isElectron}
                className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isElectron
                    ? "Go back"
                    : "Navigation not available in web mode"
                }
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleGoForward}
                disabled={!isElectron}
                className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                title={
                  isElectron
                    ? "Go forward"
                    : "Navigation not available in web mode"
                }
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleWebviewReload}
                className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
                title="Reload webview"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleGoHome}
                className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
                title="Go home"
              >
                <Home className="h-4 w-4" />
              </Button>
            </div>
            {/* URL bar row */}
            <div className="bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
              {url}
            </div>
          </div>

          {/* Desktop: Keep original horizontal layout */}
          <div className="hidden md:flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleGoBack}
              disabled={!isElectron}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isElectron ? "Go back" : "Navigation not available in web mode"
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleGoForward}
              disabled={!isElectron}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isElectron
                  ? "Go forward"
                  : "Navigation not available in web mode"
              }
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleWebviewReload}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
              title="Reload webview"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleGoHome}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
              title="Go home"
            >
              <Home className="h-4 w-4" />
            </Button>
            <div className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
              {url}
            </div>
            <Button
              size="sm"
              onClick={handleOpenDevTools}
              disabled={!isElectron}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                isElectron
                  ? "Open DevTools"
                  : "DevTools not available in web mode"
              }
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {isElectron ? (
        <webview
          allowpopups
          ref={setWebviewRef}
          src={url}
          className={`flex-1 bg-black`}
          title={title}
        />
      ) : (
        <iframe
          ref={setIframeRef}
          src={url}
          className={`flex-1 bg-black`}
          title={title}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
        />
      )}
    </div>
  );
}
