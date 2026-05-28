import * as React from 'react'

export function useDraggableWindow(initial = { x: 120, y: 120 }) {
  const [winPos, setWinPos] = React.useState(initial)
  const dragRef = React.useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  const onDragStart = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    dragRef.current = { sx: event.clientX, sy: event.clientY, ox: winPos.x, oy: winPos.y }

    const onMove = (ev: MouseEvent) => {
      const s = dragRef.current
      if (!s) return
      setWinPos({ x: Math.max(8, s.ox + ev.clientX - s.sx), y: Math.max(8, s.oy + ev.clientY - s.sy) })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [winPos.x, winPos.y])

  return { winPos, setWinPos, onDragStart }
}
