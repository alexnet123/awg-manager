import * as React from 'react'
import { X } from 'lucide-react'
import { useDraggableWindow } from './firewall/useDraggableWindow'

type Props = {
  open: boolean
  title: string
  widthClass?: string
  initialPosition?: { x: number; y: number }
  onClose: () => void
  onSubmit: (event: React.FormEvent) => Promise<void> | void
  children: React.ReactNode
  footer: React.ReactNode
}

export function AwgEditorWindow(props: Props) {
  const { winPos, setWinPos, onDragStart } = useDraggableWindow(props.initialPosition ?? { x: 150, y: 88 })
  const windowRef = React.useRef<HTMLDivElement | null>(null)
  const wasOpenRef = React.useRef(false)

  React.useLayoutEffect(() => {
    if (!props.open || wasOpenRef.current) {
      wasOpenRef.current = props.open
      return
    }

    wasOpenRef.current = true
    const editorWindow = windowRef.current
    if (!editorWindow) return

    const mainRect = document.querySelector('main')?.getBoundingClientRect()
    const bounds = mainRect && mainRect.width > 0 && mainRect.height > 0
      ? mainRect
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
    const width = editorWindow.offsetWidth || 680
    const x = Math.max(8, Math.round(bounds.left + Math.max(0, (bounds.width - width) / 2)))
    const y = Math.max(56, Math.round(bounds.top + 56))
    setWinPos({ x, y })
  }, [props.open, setWinPos])

  React.useEffect(() => {
    if (!props.open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  if (!props.open) return null

  return (
    <div className='pointer-events-none fixed inset-0 z-40'>
      <div
        ref={windowRef}
        className={`pointer-events-auto absolute z-50 max-w-[calc(100vw-24px)] rounded-xl border bg-background shadow-2xl ${props.widthClass ?? 'w-[680px]'}`}
        style={{ left: winPos.x, top: winPos.y }}
        role='dialog'
        aria-modal='true'
        aria-label={props.title}
      >
        <div className='cursor-move rounded-t-xl border-b bg-muted/70 px-3 py-2 text-xs font-medium select-none' onMouseDown={onDragStart}>
          <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
              <div className='truncate'>{props.title}</div>
            </div>
            <button type='button' className='rounded p-1 hover:bg-background/70' aria-label='Close' onClick={props.onClose}>
              <X className='size-3.5' />
            </button>
          </div>
        </div>
        <form className='flex max-h-[78vh] min-h-0 flex-col overflow-hidden rounded-b-xl bg-background text-xs' onSubmit={props.onSubmit}>
          <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
            {props.children}
          </div>
          <div className='flex justify-end gap-2 border-t bg-background px-3 py-2'>
            {props.footer}
          </div>
        </form>
      </div>
    </div>
  )
}
