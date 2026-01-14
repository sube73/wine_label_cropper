import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CropResult {
  id: string;
  url: string;
  bbox: [number, number, number, number];
}

interface ProcessingState {
  originalUrl: string;
  crops: CropResult[];
  bboxes: [number, number, number, number][];
  isProcessing: boolean;
}

export default function Home() {
  const [state, setState] = useState<ProcessingState | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const uploadMutation = trpc.wine.processImage.useMutation();

  useEffect(() => {
    if (state && imgRef.current) {
      const img = imgRef.current;
      const updateDimensions = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      if (img.complete) {
        updateDimensions();
      } else {
        img.addEventListener("load", updateDimensions);
        return () => img.removeEventListener("load", updateDimensions);
      }
    }
  }, [state]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      setState({
        originalUrl: imageData,
        crops: [],
        bboxes: [],
        isProcessing: true,
      });
      setImageDimensions(null);

      try {
        const result = await uploadMutation.mutateAsync({ imageData });
        setState((prev) => ({
          ...prev!,
          crops: result.crops,
          bboxes: result.bboxes,
          isProcessing: false,
        }));
        toast.success(`Detected ${result.crops.length} wine labels`);
      } catch (error) {
        toast.error("Failed to process image");
        setState(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files?.length) {
      handleFileSelect(files[0]);
    }
  };

  const downloadCrop = async (crop: CropResult) => {
    try {
      const response = await fetch(crop.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wine-label-${crop.id}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      toast.error("Failed to download crop");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Wine Label Cropper</h1>
          <p className="text-slate-600">Upload images to automatically detect and extract wine bottle labels</p>
        </div>

        {!state ? (
          // Upload Section
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center cursor-pointer hover:border-slate-400 transition-colors bg-white"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <Upload className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Drop your image here</h2>
            <p className="text-slate-600 mb-4">or click to browse from your computer</p>
            <Button variant="outline">Select Image</Button>
          </div>
        ) : (
          // Results Section
          <div className="space-y-8">
            {/* Original Image with Overlay */}
            <Card className="p-6 bg-white shadow-lg">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Original Image with Detection</h2>
              <div className="relative inline-block w-full max-w-3xl mx-auto">
                <img
                  ref={imgRef}
                  src={state.originalUrl}
                  alt="Original"
                  className="w-full rounded-lg shadow-md"
                />
                {/* Bounding Box Overlay */}
                {imageDimensions && (
                  <svg
                    className="absolute top-0 left-0 w-full h-full rounded-lg pointer-events-none"
                    viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                  >
                    {state.bboxes.map((bbox, idx) => {
                      const [ymin, xmin, ymax, xmax] = bbox;
                      const x1 = (xmin / 1000) * imageDimensions.width;
                      const y1 = (ymin / 1000) * imageDimensions.height;
                      const x2 = (xmax / 1000) * imageDimensions.width;
                      const y2 = (ymax / 1000) * imageDimensions.height;
                      const width = x2 - x1;
                      const height = y2 - y1;

                      return (
                        <g key={idx}>
                          <rect
                            x={x1}
                            y={y1}
                            width={width}
                            height={height}
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3"
                            rx="4"
                          />
                          <circle
                            cx={x1}
                            cy={y1}
                            r="4"
                            fill="#10b981"
                          />
                          <text
                            x={x1 + 8}
                            y={y1 - 8}
                            fill="#10b981"
                            fontSize="14"
                            fontWeight="bold"
                            fontFamily="sans-serif"
                          >
                            {idx + 1}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => setState(null)}
              >
                Upload Another Image
              </Button>
            </Card>

            {/* Crops Gallery */}
            {state.crops.length > 0 && (
              <Card className="p-6 bg-white shadow-lg">
                <h2 className="text-xl font-semibold text-slate-900 mb-4">
                  Detected Labels ({state.crops.length})
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {state.crops.map((crop, idx) => (
                    <div
                      key={crop.id}
                      className="group relative rounded-lg overflow-hidden bg-slate-100 shadow-md hover:shadow-lg transition-shadow"
                    >
                      <img
                        src={crop.url}
                        alt={`Crop ${idx + 1}`}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-white hover:bg-white/20"
                          onClick={() => downloadCrop(crop)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* No Crops Message */}
            {!state.isProcessing && state.crops.length === 0 && (
              <Card className="p-8 bg-white shadow-lg text-center">
                <p className="text-slate-600 text-lg">No wine labels detected in this image. Try another image with clearer bottle labels.</p>
              </Card>
            )}

            {/* Processing State */}
            {state.isProcessing && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mr-3" />
                <span className="text-slate-600 font-medium">Processing image with AI...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
