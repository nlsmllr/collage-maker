"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Plus, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ImageData {
  file: File;
  preview: string;
}

export default function CollageCreator() {
  const [images, setImages] = useState<(ImageData | null)[]>([null, null, null]);
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null]);

  const handleImageUpload = useCallback((index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const newImages = [...images];
      newImages[index] = {
        file,
        preview: e.target?.result as string,
      };
      setImages(newImages);
      setCollageUrl(null);
    };
    reader.readAsDataURL(file);
  }, [images]);

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(index, file);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages[index] = null;
    setImages(newImages);
    setCollageUrl(null);
  };

  const generateCollage = async () => {
    if (!images.every((img) => img !== null)) return;

    setIsGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const collageWidth = 1800;
    const collageHeight = 3200;
    const imageHeight = collageHeight / 3;

    canvas.width = collageWidth;
    canvas.height = collageHeight;

    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      });
    };

    try {
      const loadedImages = await Promise.all(
        images.map((img) => loadImage(img!.preview))
      );

      loadedImages.forEach((img, index) => {
        const y = index * imageHeight;
        const scaleX = collageWidth / img.width;
        const scaleY = imageHeight / img.height;
        const scale = Math.max(scaleX, scaleY);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        const offsetX = (collageWidth - scaledWidth) / 2;
        const offsetY = (imageHeight - scaledHeight) / 2;

        ctx.save();
        ctx.rect(0, y, collageWidth, imageHeight);
        ctx.clip();
        ctx.drawImage(img, offsetX, y + offsetY, scaledWidth, scaledHeight);
        ctx.restore();
      });

      const url = canvas.toDataURL("image/png", 1.0);
      setCollageUrl(url);
    } catch (error) {
      console.error("Error generating collage:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadCollage = async () => {
    if (!collageUrl) return;
    const response = await fetch(collageUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "collage-9x16.png";
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  // Auto-generate when all slots filled
  const allImagesUploaded = images.every((img) => img !== null);
  const prevAllUploaded = useRef(false);

  if (allImagesUploaded && !prevAllUploaded.current && !collageUrl && !isGenerating) {
    prevAllUploaded.current = true;
    generateCollage();
  }
  if (!allImagesUploaded) {
    prevAllUploaded.current = false;
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[320px]">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-light tracking-[0.2em] text-zinc-900 uppercase">Collage a trois</h1>
          <p className="text-xs text-zinc-400 mt-2 tracking-wide uppercase">Select three photos to combine</p>
        </div>

        <div className="grid grid-rows-3 gap-3 aspect-[9/16] w-full">
          {[0, 1, 2].map((index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative rounded-2xl overflow-hidden bg-white border border-zinc-200 shadow-sm group"
            >
              {images[index] ? (
                <div className="absolute inset-0">
                  <img src={images[index]!.preview} alt={`Upload ${index + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/90 text-zinc-900 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 transition-colors">
                  <Plus className="h-6 w-6 text-zinc-300" />
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(index, e)} />
                </label>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex justify-center h-14">
          <AnimatePresence mode="wait">
            {isGenerating ? (
              <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
              </motion.div>
            ) : collageUrl ? (
              <motion.div key="download" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Button 
                  onClick={downloadCollage}
                  className="rounded-full h-14 w-14 bg-zinc-900 hover:bg-black shadow-lg"
                >
                  <Download className="h-6 w-6 text-white" />
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}
