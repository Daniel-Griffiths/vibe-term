import React, { useState } from "react";
import { Button } from "./ui/button";
import { RotateCcw, Code } from "lucide-react";

interface SharedWebViewProps {
  url: string;
  title: string;
  showUrlBar?: boolean;
}

export default function SharedWebView({
  url,
  title,
  showUrlBar = true,
}: SharedWebViewProps) {
  const [webviewRef, setWebviewRef] = useState<any>(null);

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

  return (
    <div className="flex-1 flex flex-col glass-card overflow-hidden">
      {showUrlBar && (
        <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
              {url}
            </div>
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
        ref={setWebviewRef}
        src={url}
        className={`flex-1 border-0 bg-black ${showUrlBar ? 'rounded-b-lg' : 'rounded-lg'}`}
        title={title}
      />
    </div>
  );
}