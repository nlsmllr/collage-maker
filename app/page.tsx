"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { X, Plus, Move } from "lucide-react"

interface MediaData {
  file: File
  preview: string
  type: 'image' | 'video'
  positionX: number
  positionY: number
}

export default function CollageCreator() {
  const [media, setMedia] = useState<(MediaData | null)[]>([null, null, null])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingProgress, setRecordingProgress] = useState(0)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null])
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([null, null, null])
  
  // Ref for Drag & Drop logic
  const dragRef = useRef<{
    index: number
    startX: number
    startY: number
    initPosX: number
    initPosY: number
  } | null>(null)

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const isVideo = file.type.startsWith('video/')
      const newMedia = [...media]
      
      // Cleanup old URL to prevent memory leaks
      if (newMedia[index]?.preview) {
        URL.revokeObjectURL(newMedia[index]!.preview)
      }

      newMedia[index] = {
        file,
        preview: URL.createObjectURL(file),
        type: isVideo ? 'video' : 'image',
        positionX: 50, // Center by default
        positionY: 50,
      }
      setMedia(newMedia)
    }
  }

  const removeMedia = (index: number) => {
    const newMedia = [...media]
    if (newMedia[index]?.preview) {
      URL.revokeObjectURL(newMedia[index]!.preview)
    }
    newMedia[index] = null
    setMedia(newMedia)
    
    if (fileInputRefs.current[index]) {
      fileInputRefs.current[index]!.value = ""
    }
  }

  // --- Drag & Drop Handler for Image/Video Framing ---
  const handlePointerDown = (index: number, e: React.PointerEvent<HTMLElement>) => {
    if (!media[index]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      initPosX: media[index]!.positionX,
      initPosY: media[index]!.positionY,
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    const { index, startX, startY, initPosX, initPosY } = dragRef.current

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    // Sensitivity for dragging
    const sensitivity = 0.25

    const newX = Math.max(0, Math.min(100, initPosX - dx * sensitivity))
    const newY = Math.max(0, Math.min(100, initPosY - dy * sensitivity))

    setMedia((prev) => {
      const newMedia = [...prev]
      if (newMedia[index]) {
        newMedia[index] = { ...newMedia[index]!, positionX: newX, positionY: newY }
      }
      return newMedia
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    if (dragRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId)
      dragRef.current = null
    }
  }
  // ------------------------------------------------

  const drawToCanvas = useCallback((ctx: CanvasRenderingContext2D, canvasWidth: number, mediaHeight: number) => {
    ctx.fillStyle = '#0a0a0a' // Background fill
    ctx.fillRect(0, 0, canvasWidth, canvasWidth * (16 / 9))

    media.forEach((m, index) => {
      if (!m) return
      const el = mediaRefs.current[index]
      if (!el) return

      const posX = m.positionX
      const posY = m.positionY
      const y = index * mediaHeight

      let natWidth, natHeight

      if (m.type === 'video') {
        const v = el as HTMLVideoElement
        natWidth = v.videoWidth
        natHeight = v.videoHeight
      } else {
        const i = el as HTMLImageElement
        natWidth = i.naturalWidth
        natHeight = i.naturalHeight
      }

      // Element might not be fully loaded yet
      if (!natWidth || !natHeight) return

      const scaleX = canvasWidth / natWidth
      const scaleY = mediaHeight / natHeight
      const scale = Math.max(scaleX, scaleY)
      
      const scaledWidth = natWidth * scale
      const scaledHeight = natHeight * scale
      
      const maxOffsetX = scaledWidth - canvasWidth
      const maxOffsetY = scaledHeight - mediaHeight

      const offsetX = -(posX / 100) * maxOffsetX
      const offsetY = -(posY / 100) * maxOffsetY

      ctx.save()
      ctx.beginPath()
      ctx.rect(0, y, canvasWidth, mediaHeight)
      ctx.clip()
      ctx.drawImage(el, offsetX, y + offsetY, scaledWidth, scaledHeight)
      ctx.restore()
    })
  }, [media])

  const exportFile = async (blob: Blob, extension: string, mimeType: string) => {
    const filename = `collage-a-trois-by-nlsmllr.${extension}`
    const file = new File([blob], filename, { type: mimeType })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] })
        return
      } catch (err) {
        if ((err as Error).name === "AbortError") return
      }
    }

    // Fallback: Force a direct download by disguising the file as a generic binary stream
    // This prevents the browser from trying to "play" the video in a new tab
    const forceDownloadBlob = new Blob([blob], { type: 'application/octet-stream' });
    const blobUrl = URL.createObjectURL(forceDownloadBlob)
    
    const link = document.createElement("a")
    link.style.display = "none"
    link.href = blobUrl
    link.download = filename
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
  }

  const generateAndDownloadStatic = async () => {
    setIsGenerating(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const collageWidth = 1080
    const collageHeight = 1920
    const mediaHeight = collageHeight / 3

    canvas.width = collageWidth
    canvas.height = collageHeight

    drawToCanvas(ctx, collageWidth, mediaHeight)

    canvas.toBlob((blob) => {
      if (blob) exportFile(blob, "png", "image/png")
      setIsGenerating(false)
    }, "image/png", 1.0)
  }

  const getSupportedMimeType = () => {
    // Prioritize MP4 and MOV formats
    const types = ['video/mp4', 'video/quicktime', 'video/webm']
    return types.find(type => MediaRecorder.isTypeSupported(type)) || ''
  }

  const recordAndDownloadVideo = async () => {
    setIsRecording(true)
    setRecordingProgress(0)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const collageWidth = 1080
    const collageHeight = 1920
    const mediaHeight = collageHeight / 3

    canvas.width = collageWidth
    canvas.height = collageHeight

    const stream = canvas.captureStream(30)
    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: BlobPart[] = []

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      const exportMime = mimeType || 'video/mp4'
      const blob = new Blob(chunks, { type: exportMime })
      const ext = exportMime.includes('quicktime') ? 'mov' : exportMime.includes('webm') ? 'webm' : 'mp4'
      
      exportFile(blob, ext, exportMime)
      
      setIsRecording(false)
      setRecordingProgress(0)
    }

    // Reset all videos to the beginning right before we start recording
    media.forEach((m, index) => {
      if (m?.type === 'video') {
        const videoEl = mediaRefs.current[index] as HTMLVideoElement;
        if (videoEl) {
          videoEl.currentTime = 0;
          videoEl.play().catch(e => console.error("Playback failed:", e));
        }
      }
    });

    let animationFrameId: number
    const drawFrame = () => {
      drawToCanvas(ctx, collageWidth, mediaHeight)
      animationFrameId = requestAnimationFrame(drawFrame)
    }

    recorder.start()
    drawFrame()

    const duration = 5000 // Fixed 5 second export duration
    const startTime = Date.now()

    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      if (elapsed >= duration) {
         cancelAnimationFrame(animationFrameId)
         recorder.stop()
      } else {
         setRecordingProgress(Math.floor((elapsed / duration) * 100))
         requestAnimationFrame(updateProgress)
      }
    }
    updateProgress()
  }

  const handleDownload = async () => {
    const hasVideo = media.some(m => m?.type === 'video')
    if (hasVideo) {
      await recordAndDownloadVideo()
    } else {
      await generateAndDownloadStatic()
    }
  }

  const allMediaUploaded = media.every((m) => m !== null)

  return (
    <main className="fixed inset-0 overflow-hidden bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-[min(100%,350px)] flex flex-col h-full max-h-[850px] justify-center">
        <h1 className="text-3xl uppercase font-semibold tracking-tight text-foreground mb-4 md:mb-6 text-center shrink-0">
          Collage a trois
        </h1>

        <div className="rounded-2xl overflow-hidden border border-border bg-card w-full aspect-[9/16] flex flex-col shrink">
          {[0, 1, 2].map((index) => (
            <div key={index} className={`relative flex-1 ${index !== 2 ? "border-b border-border" : ""}`}>
              {media[index] ? (
                <div className="absolute inset-0 group">
                  {media[index]!.type === 'video' ? (
                    <video
                      ref={(el) => { mediaRefs.current[index] = el }}
                      src={media[index]!.preview}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-full w-full object-cover cursor-move touch-none select-none"
                      style={{ objectPosition: `${media[index]!.positionX}% ${media[index]!.positionY}%` }}
                      onPointerDown={(e) => handlePointerDown(index, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    />
                  ) : (
                    <img
                      ref={(el) => { mediaRefs.current[index] = el }}
                      src={media[index]!.preview}
                      alt={`Image ${index + 1}`}
                      className="h-full w-full object-cover cursor-move touch-none select-none"
                      style={{ objectPosition: `${media[index]!.positionX}% ${media[index]!.positionY}%` }}
                      onPointerDown={(e) => handlePointerDown(index, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      draggable={false}
                    />
                  )}
                  
                  <div className="absolute top-2 left-2 rounded-full bg-black/30 p-1.5 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Move className="h-3.5 w-3.5" />
                  </div>

                  <button
                    onClick={() => removeMedia(index)}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    aria-label="Remove item"
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
                    accept="image/*,video/*"
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
            onClick={handleDownload}
            className="rounded-3xl h-12 w-full font-semibold uppercase mt-4 md:mt-6 relative overflow-hidden"
            disabled={!allMediaUploaded || isGenerating || isRecording}
          >
            {isRecording ? (
              <>
                <span className="relative z-10">Recording... {recordingProgress}%</span>
                <div 
                  className="absolute inset-y-0 left-0 bg-primary-foreground/20 z-0 transition-all duration-75" 
                  style={{ width: `${recordingProgress}%` }} 
                />
              </>
            ) : isGenerating ? (
              'Generating...'
            ) : media.some(m => m?.type === 'video') ? (
              'Record & Download'
            ) : (
              'Download'
            )}
          </Button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </main>
  )
}
