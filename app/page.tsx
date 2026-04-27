"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Download, X, Plus, Move, Check } from "lucide-react"

interface CropOffset {
  x: number // -1 to 1, where 0 is centered
  y: number // -1 to 1, where 0 is centered
}

interface ImageData {
  file: File
  preview: string
  cropOffset: CropOffset
  naturalWidth?: number
  naturalHeight?: number
}

// Crop editor with drag-to-pan functionality
function CropEditor({
  image,
  onSave,
  onClose,
}: {
  image: ImageData
  onSave: (offset: CropOffset) => void
  onClose: () => void
}) {
  const [offset, setOffset] = useState<CropOffset>(image.cropOffset)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startPosRef = useRef({ x: 0, y: 0 })
  const startOffsetRef = useRef({ x: 0, y: 0 })

  // Calculate the aspect ratios to determine pan limits
  const containerAspect = 9 / 5 // Preview aspect (roughly 9:5 for the crop area)
  const imageAspect = (image.naturalWidth || 1) / (image.naturalHeight || 1)
  
  // Determine if image is wider or taller than container aspect
  const canPanX = imageAspect > containerAspect
  const canPanY = imageAspect < containerAspect

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setIsDragging(true)
    startPosRef.current = { x: e.clientX, y: e.clientY }
    startOffsetRef.current = { ...offset }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return
    
    const container = containerRef.current
    const deltaX = e.clientX - startPosRef.current.x
    const deltaY = e.clientY - startPosRef.current.y
    
    // Scale delta to offset range (-1 to 1)
    // More movement needed for larger pans
    const sensitivity = 3
    const newX = canPanX 
      ? Math.max(-1, Math.min(1, startOffsetRef.current.x - (deltaX / container.offsetWidth) * sensitivity))
      : 0
    const newY = canPanY
      ? Math.max(-1, Math.min(1, startOffsetRef.current.y - (deltaY / container.offsetHeight) * sensitivity))
      : 0
    
    setOffset({ x: newX, y: newY })
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Calculate transform for preview
  const getTransform = () => {
    // Scale to cover, then apply offset
    const maxOffsetPercent = 20 // Max pan percentage
    const x = offset.x * maxOffsetPercent
    const y = offset.y * maxOffsetPercent
    return `translate(${-x}%, ${-y}%)`
  }

  return (
    <div className="flex flex-col gap-4">
      <div 
        ref={containerRef}
        className="relative w-full aspect-[9/5] overflow-hidden rounded-lg bg-muted cursor-move touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <img
          src={image.preview}
          alt="Crop preview"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: getTransform() }}
          draggable={false}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5 opacity-60">
            <Move className="w-3 h-3" />
            <span>Drag to adjust</span>
          </div>
        </div>
      </div>
      
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={() => onSave(offset)}>
          <Check className="w-4 h-4 mr-2" />
          Apply
        </Button>
      </DialogFooter>
    </div>
  )
}

export default function CollageCreator() {
  const [images, setImages] = useState<(ImageData | null)[]>([null, null, null])
  const [collageUrl, setCollageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])

  const handleImageUpload = useCallback((index: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const preview = e.target?.result as string
      // Load image to get natural dimensions
      const img = new window.Image()
      img.onload = () => {
        const newImages = [...images]
        newImages[index] = {
          file,
          preview,
          cropOffset: { x: 0, y: 0 },
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        }
        setImages(newImages)
        setCollageUrl(null)
      }
      img.src = preview
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

  const updateCropOffset = useCallback((index: number, offset: CropOffset) => {
    setImages(prev => {
      const newImages = [...prev]
      if (newImages[index]) {
        newImages[index] = { ...newImages[index]!, cropOffset: offset }
      }
      return newImages
    })
    setCollageUrl(null)
  }, [])

  const generateCollage = async () => {
    if (!images.every((img) => img !== null)) return

    setIsGenerating(true)

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const collageWidth = 1800
    const collageHeight = 3200
    const imageHeight = collageHeight / 3

    canvas.width = collageWidth
    canvas.height = collageHeight

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

      loadedImages.forEach((img, index) => {
        const y = index * imageHeight
        const scaleX = collageWidth / img.width
        const scaleY = imageHeight / img.height
        const scale = Math.max(scaleX, scaleY)
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        
        // Apply crop offset
        const imageData = images[index]!
        const maxOffsetX = (scaledWidth - collageWidth) / 2
        const maxOffsetY = (scaledHeight - imageHeight) / 2
        const offsetX = (collageWidth - scaledWidth) / 2 + (imageData.cropOffset.x * maxOffsetX)
        const offsetY = (imageHeight - scaledHeight) / 2 + (imageData.cropOffset.y * maxOffsetY)

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

  const downloadCollage = async () => {
    if (!collageUrl) return

    // Convert data URL to blob for better mobile support
    const response = await fetch(collageUrl)
    const blob = await response.blob()
    const file = new File([blob], "collage-9x16.png", { type: "image/png" })

    // Try Web Share API first (works great on mobile)
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Collage",
        })
        return
      } catch (err) {
        // User cancelled or share failed, fall through to download
        if ((err as Error).name === "AbortError") return
      }
    }

    // Fallback: create blob URL and download
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.download = "collage-9x16.png"
    link.href = blobUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }

  const allImagesUploaded = images.every((img) => img !== null)

  // Auto-generate when all images are uploaded
  const prevAllUploaded = useRef(false)
  if (allImagesUploaded && !prevAllUploaded.current && !collageUrl && !isGenerating) {
    prevAllUploaded.current = true
    generateCollage()
  }
  if (!allImagesUploaded) {
    prevAllUploaded.current = false
  }

  return (
    <main className="bg-background flex items-center justify-center pt-20 p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl uppercase font-semibold tracking-tight text-foreground mb-6 text-center">
          Collage a trois
        </h1>

        <div className="rounded-2xl overflow-hidden border border-border bg-card">
          {[0, 1, 2].map((index) => (
            <div key={index} className={index !== 2 ? "border-b border-border" : ""}>
              {images[index] ? (
                <div className="relative group h-32 bg-muted/30">
                  <img
                    src={images[index]!.preview}
                    alt={`Image ${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                    <button
                      onClick={() => setEditingIndex(index)}
                      className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                      aria-label="Adjust crop"
                    >
                      <Move className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => removeImage(index)}
                      className="rounded-full bg-black/60 p-2 text-white hover:bg-black/80 transition-colors"
                      aria-label="Remove image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex h-32 cursor-pointer items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground/50" />
                  <input
                    ref={(el) => { fileInputRefs.current[index] = el }}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(index, e)}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        {collageUrl && (
          <Button
            onClick={downloadCollage}
            className="w-full mt-6"
            size="lg"
          >
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        )}

        {isGenerating && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            Creating...
          </p>
        )}

        <canvas ref={canvasRef} className="hidden" />

        {/* Crop Editor Dialog */}
        <Dialog open={editingIndex !== null} onOpenChange={(open) => !open && setEditingIndex(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adjust Crop</DialogTitle>
            </DialogHeader>
            {editingIndex !== null && images[editingIndex] && (
              <CropEditor
                image={images[editingIndex]!}
                onSave={(offset) => {
                  updateCropOffset(editingIndex, offset)
                  setEditingIndex(null)
                  // Regenerate collage after crop adjustment
                  setTimeout(() => generateCollage(), 100)
                }}
                onClose={() => setEditingIndex(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
