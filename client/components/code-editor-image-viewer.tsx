import { Button } from "./button";
import { api } from "../utils/api";
import { useState, useEffect, useCallback } from "react";
import { Icon } from "./icon";

interface ICodeEditorImageViewerProps {
  filePath: string;
  fileName: string;
  projectPath: string;
}

export function CodeEditorImageViewer({
  filePath,
  projectPath,
  fileName,
}: ICodeEditorImageViewerProps) {
  const [scale, setScale] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });

  const loadImage = useCallback(async () => {
    try {
      const result = await api.readImageFile(projectPath, filePath);
      if (result?.success && result.data) {
        const url = `data:${result.mimeType || "image/jpeg"};base64,${
          result.data
        }`;
        setImageUrl(url);
        setError(null);

        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.width, height: img.height });
        };
        img.src = url;
      } else {
        setError(result?.error || "Failed to load image");
      }
    } catch (err) {
      setError("Error loading image");
      console.error(err);
    }
  }, [projectPath, filePath]);

  useEffect(() => {
    loadImage();
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [loadImage, imageUrl]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setRotation(0);
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load image</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
            title="Zoom Out"
          >
            <Icon name="zoomout" className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-400 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            onClick={handleZoomIn}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
            title="Zoom In"
          >
            <Icon name="zoomin" className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleRotate}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600 ml-2"
            title="Rotate"
          >
            <Icon name="rotatecw" className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleResetView}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
            title="Reset View"
          >
            <Icon name="maximize2" className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {imageDimensions.width} × {imageDimensions.height}px
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-pattern">
        <div
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: "transform 0.2s ease",
            transformOrigin: "center",
          }}
        >
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain shadow-2xl"
            style={{
              imageRendering: scale > 2 ? "pixelated" : "auto",
            }}
          />
        </div>
      </div>

      <style>{`
        .bg-pattern {
          background-image: 
            linear-gradient(45deg, #1a1a1a 25%, transparent 25%),
            linear-gradient(-45deg, #1a1a1a 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #1a1a1a 75%),
            linear-gradient(-45deg, transparent 75%, #1a1a1a 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </div>
  );
}
