"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, Download, X, ImageIcon } from "lucide-react"

interface ImageData {
  file: File
  preview: string
}

export default function CollageCreator() {
  const [images, setImages] = useState<(ImageData | null)[]>([null, null, null])
  const [collageUrl, setCollageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])

  const handleImageUpload = useCallback((index: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const newImages = [...images]
      newImages[index] = {
        file,
        preview: e.target?.result as string,
      }
      setImages(newImages)
      setCollageUrl(null)
    }
    reader.readAsDataURL(file)
  }, [images])

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(index, file)
    }
  }

  const removeImage = (index: number) => {
    const newImages = [...images]
    newImages[index] = null
    setImages(newImages)
    setCollageUrl(null)
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = ""
    }
  }

  const generateCollage = async () => {
    if (!images.every((img) => img !== null)) return

    setIsGenerating(true)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 9:16 aspect ratio - high resolution output
    const collageWidth = 1800
    const collageHeight = 3200
    const imageHeight = collageHeight / 3

    canvas.width = collageWidth
    canvas.height = collageHeight

    // Load all images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
      })
    }

    try {
      const loadedImages = await Promise.all(
        images.map((img) => loadImage(img!.preview))
      )

      // Draw each image to fill its section (cover behavior)
      loadedImages.forEach((img, index) => {
        const y = index * imageHeight

        // Calculate scaling to cover the section
        const scaleX = collageWidth / img.width
        const scaleY = imageHeight / img.height
        const scale = Math.max(scaleX, scaleY)

        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale

        // Center the image
        const offsetX = (collageWidth - scaledWidth) / 2
        const offsetY = (imageHeight - scaledHeight) / 2

        ctx.save()
        ctx.beginPath()
        ctx.rect(0, y, collageWidth, imageHeight)
        ctx.clip()
        ctx.drawImage(img, offsetX, y + offsetY, scaledWidth, scaledHeight)
        ctx.restore()
      })

      const url = canvas.toDataURL("image/png", 1.0)
      setCollageUrl(url)
    } catch (error) {
      console.error("Error generating collage:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadCollage = () => {
    if (!collageUrl) return

    const link = document.createElement("a")
    link.download = "collage-9x16.png"
    link.href = collageUrl
    link.click()
  }

  const allImagesUploaded = images.every((img) => img !== null)

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            9:16 Collage Creator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload 3 images to create a vertical collage
          </p>
        </div>

        <div className="space-y-4">
          {[0, 1, 2].map((index) => (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-0">
                {images[index] ? (
                  <div className="relative">
                    <img
                      src={images[index]!.preview}
                      alt={`Image ${index + 1}`}
                      className="h-40 w-full object-cover"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/80"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                      {index === 0 ? "Top" : index === 1 ? "Middle" : "Bottom"}
                    </div>
                  </div>
                ) : (
                  <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted">
                    <div className="rounded-full bg-muted-foreground/10 p-3">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {index === 0 ? "Top Image" : index === 1 ? "Middle Image" : "Bottom Image"}
                    </span>
                    <span className="text-xs text-muted-foreground/70">
                      Click to upload
                    </span>
                    <input
                      ref={(el) => { fileInputRefs.current[index] = el }}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(index, e)}
                      className="hidden"
                    />
                  </label>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button
            onClick={generateCollage}
            disabled={!allImagesUploaded || isGenerating}
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isGenerating ? "Generating..." : "Create Collage"}
          </Button>

          {collageUrl && (
            <Button
              onClick={downloadCollage}
              variant="outline"
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Collage (1080×1920)
            </Button>
          )}
        </div>

        {collageUrl && (
          <Card className="mt-6 overflow-hidden">
            <CardContent className="p-4">
              <p className="mb-3 text-center text-sm font-medium text-muted-foreground">
                Preview
              </p>
              <div className="flex justify-center">
                <img
                  src={collageUrl}
                  alt="Generated collage"
                  className="max-h-[500px] rounded-lg shadow-lg"
                  style={{ aspectRatio: "9/16" }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hidden canvas for generating the collage */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  )
}
