"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Download, X, Plus, Move } from "lucide-react"

interface ImageData {
  file: File
  preview: string
  positionX: number
  positionY: number
}

export default function CollageCreator() {
  const [images, setImages] = useState<(ImageData | null)[]>([null, null, null])
  const [collageUrl, setCollageUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])
  
  // Ref für die Drag & Drop Logik
  const dragRef = useRef<{
    index: number
    startX: number
    startY: number
    initPosX: number
    initPosY: number
  } | null>(null)

  const handleImageUpload = useCallback((index: number, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const newImages = [...images]
      newImages[index] = {
        file,
        preview: e.target?.result as string,
        positionX: 50, // Standardmäßig zentriert
        positionY: 50,
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

  // --- Drag & Drop Handler für den Bildausschnitt ---
  const handlePointerDown = (index: number, e: React.PointerEvent<HTMLImageElement>) => {
    if (!images[index]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      initPosX: images[index]!.positionX,
      initPosY: images[index]!.positionY,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragRef.current) return
    const { index, startX, startY, initPosX, initPosY } = dragRef.current

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    // Empfindlichkeit für das Ziehen (anpassbar)
    const sensitivity = 0.5

    const newX = Math.max(0, Math.min(100, initPosX - dx * sensitivity))
    const newY = Math.max(0, Math.min(100, initPosY - dy * sensitivity))

    setImages((prev) => {
      const newImages = [...prev]
      if (newImages[index]) {
        newImages[index] = { ...newImages[index]!, positionX: newX, positionY: newY }
      }
      return newImages
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLImageElement>) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      dragRef.current = null
      // Collage invalidieren, damit sie mit neuem Ausschnitt generiert wird
      setCollageUrl(null) 
    }
  }
  // ------------------------------------------------

  const generateCollage = useCallback(async () => {
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
        const imgData = images[index]!
        const posX = imgData.positionX
        const posY = imgData.positionY

        const y = index * imageHeight
        const scaleX = collageWidth / img.width
        const scaleY = imageHeight / img.height
        const scale = Math.max(scaleX, scaleY)
        
        const scaledWidth = img.width * scale
        const scaledHeight = img.height * scale
        
        // Maximal möglicher Offset (Überhang des Bildes über den Container)
        const maxOffsetX = scaledWidth - collageWidth
        const maxOffsetY = scaledHeight - imageHeight

        // Offset basierend auf Prozentwert berechnen
        const offsetX = -(posX / 100) * maxOffsetX
        const offsetY = -(posY / 100) * maxOffsetY

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
  }, [images])

  const downloadCollage = async () => {
    if (!collageUrl) return

    const response = await fetch(collageUrl)
    const blob = await response.blob()
    const file = new File([blob], "collage-a-trois.png", { type: "image/png" })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (err) {
        if ((err as Error).name === "AbortError") return
      }
    }

    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.download = "collage-a-trois.png"
    link.href = blobUrl
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)
  }

  // Automatische Generierung durch sauberen useEffect ersetzt
  useEffect(() => {
    const allImagesUploaded = images.every((img) => img !== null)
    if (allImagesUploaded && !collageUrl && !isGenerating) {
      generateCollage()
    }
  }, [images, collageUrl, isGenerating, generateCollage])

  const allImagesUploaded = images.every((img) => img !== null)

  return (
    <main className="fixed inset-0 overflow-hidden bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[min(100%,350px)] flex flex-col h-full max-h-[850px] justify-center">
        <h1 className="text-3xl uppercase font-semibold tracking-tight text-foreground mb-4 md:mb-6 text-center shrink-0">
          Collage a trois
        </h1>

        <div className="rounded-2xl overflow-hidden border border-border bg-card w-full aspect-[9/16] flex flex-col shrink">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`relative flex-1 ${index !== 2 ? "border-b border-border" : ""}`}>
              {images[index] ? (
                <div className="absolute inset-0 group">
                  <img
                    src={images[index]!.preview}
                    alt={`Image ${index + 1}`}
                    // touch-none ist wichtig, damit das Handy beim Wischen nicht scrollt
                    className="h-full w-full object-cover cursor-move touch-none select-none"
                    style={{
                      objectPosition: `${images[index]!.positionX}% ${images[index]!.positionY}%`
                    }}
                    onPointerDown={(e) => handlePointerDown(index, e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    draggable={false}
                  />
                  
                  {/* Visueller Hinweis, dass man das Bild bewegen kann */}
                  <div className="absolute top-2 left-2 rounded-full bg-black/30 p-1.5 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Move className="h-3.5 w-3.5" />
                  </div>

                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
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

        <div className="shrink-0 flex flex-col items-center w-full">
          <Button
            onClick={downloadCollage}
            className="rounded-3xl h-12 w-full font-semibold uppercase mt-4 md:mt-6"
            disabled={!allImagesUploaded || isGenerating || !collageUrl}
          >Download
          </Button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  )
}
