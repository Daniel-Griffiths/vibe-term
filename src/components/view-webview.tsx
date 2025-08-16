import React, { useState, useEffect } from "react";
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
  const [originalUrl] = useState(url);

  const handleWebviewReload = () => {
    if (webviewRef) {
      webviewRef.reload();
    }
  };

  const handleOpenDevTools = () => {
    if (webviewRef) {
      webviewRef.openDevTools();
    }
  };

  const handleGoBack = () => {
    if (webviewRef && webviewRef.canGoBack()) {
      webviewRef.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef && webviewRef.canGoForward()) {
      webviewRef.goForward();
    }
  };

  const handleGoHome = () => {
    if (webviewRef) {
      webviewRef.loadURL(originalUrl);
    }
  };

  return (
    <div className="flex-1 flex flex-col glass-card overflow-hidden">
      {showUrlBar && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleGoBack}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleGoForward}
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
              title="Go forward"
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
              className="h-8 w-8 p-0 bg-gray-600 hover:bg-gray-700 text-white"
              title="Open DevTools"
            >
              <Code className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <webview
        allowpopups
        ref={setWebviewRef}
        src={url}
        className={`flex-1 border-0 bg-black ${
          showUrlBar ? "rounded-b-lg" : "rounded-lg"
        }`}
        title={title}
      />
    </div>
  );
}
