import { useState, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, Maximize2 } from "lucide-react";
import { Button } from "./button";

interface ICodeEditorImageViewerProps {
  filePath: string;
  projectPath: string;
  fileName: string;
}

export function CodeEditorImageViewer({ filePath, projectPath, fileName }: ICodeEditorImageViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const loadImage = useCallback(async () => {
    try {
      // Read the image file as base64
      const result = await window.electronAPI?.readImageFile(projectPath, filePath);
      if (result?.success && result.data) {
        // Create a data URL from the base64 string
        const url = `data:${result.mimeType || 'image/jpeg'};base64,${result.data}`;
        setImageUrl(url);
        setError(null);
        
        // Load image to get dimensions
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
      // Clean up the object URL when component unmounts
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [loadImage, imageUrl]);


  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleResetView = useCallback(() => {
    setScale(1);
    setRotation(0);
  }, []);

  const handleDownload = useCallback(() => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [imageUrl, fileName]);

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
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleZoomOut}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
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
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleRotate}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600 ml-2"
            title="Rotate"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={handleResetView}
            className="h-8 w-8 p-0 bg-gray-700 hover:bg-gray-600"
            title="Reset View"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {imageDimensions.width} × {imageDimensions.height}px
          </span>
          <Button
            size="sm"
            onClick={handleDownload}
            className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
            title="Download"
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Image Display Area */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-pattern">
        <div
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease',
            transformOrigin: 'center',
          }}
        >
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-full max-h-full object-contain shadow-2xl"
            style={{
              imageRendering: scale > 2 ? 'pixelated' : 'auto',
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