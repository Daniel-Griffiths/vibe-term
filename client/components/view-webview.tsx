import { useState } from "react";
import { Button } from "./button";
import { NonIdealState } from "./non-ideal-state";
import { Icon } from "./icon";

interface IViewWebviewProps {
  url?: string;
  title?: string;
  showUrlBar?: boolean;
}

export function ViewWebview({
  url,
  title,
  showUrlBar = true,
}: IViewWebviewProps) {
  const [webviewRef, setWebviewRef] = useState<any>(null);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);
  const [originalUrl] = useState(url);
  const isElectron =
    typeof window !== "undefined" && (window as any).electronAPI;

  // Handle undefined URL
  if (!url) {
    return (
      <NonIdealState
        icon={() => <Icon name="globe" className="h-16 w-16 opacity-50" />}
        title="No URL Configured"
        description={
          title
            ? `Configure a URL for ${title}`
            : "Configure a URL to display content here"
        }
      />
    );
  }

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
                icon="arrowleft"
                onClick={handleGoBack}
                disabled={!isElectron}
                className="p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                size="sm"
                icon="arrowright"
                onClick={handleGoForward}
                disabled={!isElectron}
                className="p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button
                size="sm"
                icon="rotateccw"
                onClick={handleWebviewReload}
                className="p-0 bg-gray-600 hover:bg-gray-700 text-white"
              />
              <Button
                size="sm"
                icon="home"
                onClick={handleGoHome}
                className="p-0 bg-gray-600 hover:bg-gray-700 text-white"
              />
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
              icon="arrowleft"
              iconClassName="h-5 w-5"
              onClick={handleGoBack}
              disabled={!isElectron}
              className="p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              size="sm"
              icon="arrowright"
              iconClassName="h-5 w-5"
              onClick={handleGoForward}
              disabled={!isElectron}
              className="p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              size="sm"
              icon="rotateccw"
              iconClassName="h-5 w-5"
              onClick={handleWebviewReload}
              className="p-0 bg-gray-600 hover:bg-gray-700 text-white"
            />
            <Button
              size="sm"
              icon="home"
              iconClassName="h-5 w-5"
              onClick={handleGoHome}
              className="p-0 bg-gray-600 hover:bg-gray-700 text-white"
            />
            <div className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1 text-sm text-gray-300 font-mono">
              {url}
            </div>
            <Button
              size="sm"
              icon="code"
              iconClassName="h-5 w-5"
              onClick={handleOpenDevTools}
              disabled={!isElectron}
              className="p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      )}

      {isElectron ? (
        <webview
          allowpopups
          ref={setWebviewRef}
          src={url}
          className={`flex-1 bg-black`}
        />
      ) : (
        <iframe
          ref={setIframeRef}
          src={url}
          className={`flex-1 bg-black`}
          allow="fullscreen"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
        />
      )}
    </div>
  );
}
