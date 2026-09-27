'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import initialConfig from '@/components/radio-buttons.json'

type ButtonConfig = { left: number; width: number; height: number; top: number; iconSize?: number; iconColor?: string; iconOffsetX?: number; iconOffsetY?: number }
type ConfigMap = Record<string, ButtonConfig>

const BUTTON_KEYS = ['shuffle', 'prev', 'play', 'next', 'repeat']
const SWITCH_KEYS = ['switchTop', 'switchBottom']
const ALL_KEYS = [...BUTTON_KEYS, ...SWITCH_KEYS]

const KEY_COLORS: Record<string, string> = {
  shuffle: 'rgba(255,0,0,0.5)',
  prev: 'rgba(255,0,0,0.5)',
  play: 'rgba(255,0,0,0.5)',
  next: 'rgba(255,0,0,0.5)',
  repeat: 'rgba(255,0,0,0.5)',
  switchTop: 'rgba(0,180,255,0.5)',
  switchBottom: 'rgba(0,255,100,0.5)',
}

export default function RadioAlignerClient() {
  const [config, setConfig] = useState<ConfigMap>(initialConfig as ConfigMap)
  const [history, setHistory] = useState<ConfigMap[]>([initialConfig as ConfigMap])
  const [historyIndex, setHistoryIndex] = useState(0)
  
  const [selectedKey, setSelectedKey] = useState<string>('switchTop')
  const [isSaving, setIsSaving] = useState(false)
  const [showOverlays, setShowOverlays] = useState(true)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag state
  const dragState = useRef<{ isDragging: boolean; type: 'move' | 'resize'; startX: number; startY: number; startLeft: number; startTop: number; startWidth: number; startHeight: number } | null>(null)

  const pushHistory = (newConfig: ConfigMap) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newConfig)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handlePointerDown = (e: React.PointerEvent, key: string, type: 'move' | 'resize') => {
    if (!showOverlays) return
    e.stopPropagation()
    e.preventDefault()
    setSelectedKey(key)
    dragState.current = {
      isDragging: true,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: config[key].left,
      startTop: config[key].top,
      startWidth: config[key].width,
      startHeight: config[key].height,
    }
  }

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragState.current?.isDragging || !containerRef.current) return
    const container = containerRef.current.getBoundingClientRect()
    
    const deltaX = e.clientX - dragState.current.startX
    const deltaY = e.clientY - dragState.current.startY
    
    const deltaXPct = (deltaX / container.width) * 100
    const deltaYPct = (deltaY / container.height) * 100
    // Buttons inside vp-ctrls are relative to that 13% zone, so divide
    const isSwitch = SWITCH_KEYS.includes(selectedKey)
    const deltaYFinal = isSwitch ? deltaYPct : deltaYPct / 0.13

    setConfig(prev => {
      const newConf = { ...prev }
      const btn = { ...newConf[selectedKey] }
      
      if (dragState.current!.type === 'move') {
        btn.left = Number((dragState.current!.startLeft + deltaXPct).toFixed(2))
        btn.top = Number((dragState.current!.startTop + deltaYFinal).toFixed(2))
      } else {
        btn.width = Math.max(1, Number((dragState.current!.startWidth + deltaXPct).toFixed(2)))
        btn.height = Math.max(1, Number((dragState.current!.startHeight + deltaYFinal).toFixed(2)))
      }
      
      newConf[selectedKey] = btn
      return newConf
    })
  }, [selectedKey])

  const handlePointerUp = useCallback(() => {
    if (dragState.current?.isDragging) {
      dragState.current.isDragging = false
      // Push to history after drag ends, using the latest config state
      setConfig(currentConfig => {
        pushHistory(currentConfig)
        return currentConfig
      })
    }
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/dev/radio-aligner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      if (!res.ok) throw new Error('Failed to save')
      alert('Saved successfully! The live radio will now use these coordinates.')
    } catch (err) {
      console.error(err)
      alert('Error saving config')
    } finally {
      setIsSaving(false)
    }
  }

  const handleManualInput = (prop: string, val: number) => {
    const newConf = { ...config, [selectedKey]: { ...config[selectedKey], [prop]: val } }
    setConfig(newConf)
    pushHistory(newConf)
  }

  const exportJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    alert('JSON copied to clipboard')
  }

  const exportCSS = () => {
    const css = Object.entries(config).map(([key, val]) => 
      `.vp-frame-${key} { left: ${val.left}%; width: ${val.width}%; height: ${val.height}%; top: ${val.top}%; }`
    ).join('\n')
    navigator.clipboard.writeText(css)
    alert('CSS copied to clipboard')
  }

  return (
    <div className="flex h-screen w-full bg-slate-900 text-white font-sans overflow-hidden">
      {/* Editor Canvas */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-800 relative">
        <div 
          ref={containerRef}
          style={{ 
            position: 'relative', 
            width: '100%', 
            maxWidth: '1200px',
            aspectRatio: '1520 / 476',
            backgroundImage: 'url("/assets/music player.png")',
            backgroundSize: '100% 100%',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
          }}
        >
          {showOverlays && (
            <>
              {/* Playback buttons overlay — inside the vp-ctrls zone (64%–77% of radio height) */}
              <div style={{
                position: 'absolute',
                top: '64.0%',
                left: 0,
                width: '100%',
                height: '13.0%',
                border: '1px dashed rgba(255,255,255,0.2)',
                pointerEvents: 'none'
              }}>
                {BUTTON_KEYS.map(key => {
                  const btn = config[key]
                  const isSelected = key === selectedKey
                  return (
                    <div 
                      key={key}
                      onPointerDown={(e) => handlePointerDown(e, key, 'move')}
                      style={{
                        position: 'absolute',
                        left: `${btn.left}%`,
                        top: `${btn.top}%`,
                        width: `${btn.width}%`,
                        height: `${btn.height}%`,
                        backgroundColor: isSelected ? KEY_COLORS[key] : 'rgba(255,255,255,0.2)',
                        border: isSelected ? '2px solid red' : '1px solid rgba(255,255,255,0.5)',
                        cursor: 'move',
                        pointerEvents: 'auto',
                      }}
                    >
                      <span className="absolute -top-6 left-0 bg-black text-xs px-1 py-0.5 rounded shadow whitespace-nowrap z-10">
                        {key.toUpperCase()}
                      </span>
                      {isSelected && (
                        <div 
                          onPointerDown={(e) => handlePointerDown(e, key, 'resize')}
                          style={{
                            position: 'absolute',
                            right: '-6px',
                            bottom: '-6px',
                            width: '12px',
                            height: '12px',
                            backgroundColor: 'white',
                            border: '2px solid red',
                            borderRadius: '50%',
                            cursor: 'nwse-resize',
                            zIndex: 10
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Switch panel overlays — directly on radio container using full radio % coords */}
              {SWITCH_KEYS.map(key => {
                const btn = config[key]
                const isSelected = key === selectedKey
                const color = KEY_COLORS[key]
                return (
                  <div
                    key={key}
                    onPointerDown={(e) => handlePointerDown(e, key, 'move')}
                    style={{
                      position: 'absolute',
                      left: `${btn.left}%`,
                      top: `${btn.top}%`,
                      width: `${btn.width}%`,
                      height: `${btn.height}%`,
                      backgroundColor: isSelected ? color : 'rgba(255,255,100,0.2)',
                      border: isSelected ? `2px solid ${key === 'switchTop' ? '#00cfff' : '#00ff64'}` : '1px dashed rgba(255,255,100,0.6)',
                      cursor: 'move',
                    }}
                  >
                    <span className="absolute -top-6 left-0 bg-black text-xs px-1 py-0.5 rounded shadow whitespace-nowrap z-10">
                      {key === 'switchTop' ? '🎵 QUEUE' : '🎛 CUSTOMISE'}
                    </span>
                    {isSelected && (
                      <div
                        onPointerDown={(e) => handlePointerDown(e, key, 'resize')}
                        style={{
                          position: 'absolute',
                          right: '-6px',
                          bottom: '-6px',
                          width: '12px',
                          height: '12px',
                          backgroundColor: 'white',
                          border: `2px solid ${key === 'switchTop' ? '#00cfff' : '#00ff64'}`,
                          borderRadius: '50%',
                          cursor: 'nwse-resize',
                          zIndex: 10
                        }}
                      />
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* Sidebar Controls */}
      <div className="w-80 bg-slate-950 p-6 flex flex-col gap-5 border-l border-slate-700 overflow-y-auto">
        <div>
          <h2 className="text-xl font-bold mb-1">Radio Aligner</h2>
          <p className="text-xs text-slate-400 mb-3">Adjust the red overlays to perfectly cover the vintage radio buttons.</p>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setShowOverlays(!showOverlays)}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs rounded border border-slate-600"
            >
              {showOverlays ? 'Hide Overlays' : 'Show Overlays'}
            </button>
            <button 
              onClick={() => {
                if (historyIndex > 0) {
                  setHistoryIndex(i => i - 1)
                  setConfig(history[historyIndex - 1])
                }
              }}
              disabled={historyIndex === 0}
              className="px-3 py-1 bg-slate-800 disabled:opacity-50 text-xs rounded border border-slate-600"
            >
              Undo
            </button>
            <button 
              onClick={() => {
                if (historyIndex < history.length - 1) {
                  setHistoryIndex(i => i + 1)
                  setConfig(history[historyIndex + 1])
                }
              }}
              disabled={historyIndex === history.length - 1}
              className="px-3 py-1 bg-slate-800 disabled:opacity-50 text-xs rounded border border-slate-600"
            >
              Redo
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold text-slate-300">Selected Element</label>
          <select 
            value={selectedKey}
            onChange={e => setSelectedKey(e.target.value)}
            className="p-2 bg-slate-800 rounded border border-slate-700 text-white outline-none"
          >
            <optgroup label="Playback Buttons">
              {BUTTON_KEYS.map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
            </optgroup>
            <optgroup label="Panel Switches">
              {SWITCH_KEYS.map(k => <option key={k} value={k}>{k === 'switchTop' ? '🎵 Queue Toggle' : '🎛 Customise Toggle'}</option>)}
            </optgroup>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-slate-900 p-4 rounded border border-slate-800">
          {(['left', 'top', 'width', 'height'] as const).map(prop => (
            <div key={prop} className="flex flex-col gap-1">
              <label className="text-xs text-slate-400 uppercase">{prop} (%)</label>
              <input
                type="number"
                step="0.1"
                value={config[selectedKey][prop]}
                onChange={e => handleManualInput(prop, Number(e.target.value))}
                className="p-1.5 bg-slate-800 rounded border border-slate-700 text-white font-mono text-sm w-full"
              />
            </div>
          ))}
        </div>

        {/* Icon size + color — only for switch buttons */}
        {SWITCH_KEYS.includes(selectedKey) && (
          <div className="flex flex-col gap-3 bg-slate-900 p-4 rounded border border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-300">Icon Size</label>
              <span className="text-xs font-mono text-slate-400">
                {config[selectedKey].iconSize ?? 65}%
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="120"
              step="1"
              value={config[selectedKey].iconSize ?? 65}
              onChange={e => handleManualInput('iconSize', Number(e.target.value))}
              className="w-full accent-yellow-400"
            />
            <div className="flex gap-2">
              {[40, 55, 65, 80, 100].map(v => (
                <button
                  key={v}
                  onClick={() => handleManualInput('iconSize', v)}
                  className={`flex-1 py-1 text-xs rounded border transition-colors ${(config[selectedKey].iconSize ?? 65) === v ? 'bg-yellow-500 border-yellow-400 text-black font-bold' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                >
                  {v}%
                </button>
              ))}
            </div>

            <div className="border-t border-slate-700 pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-300">Icon Color</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{(config[selectedKey] as any).iconColor ?? '#8a4a2a'}</span>
                  <input
                    type="color"
                    value={(config[selectedKey] as any).iconColor ?? '#8a4a2a'}
                    onChange={e => handleManualInput('iconColor' as any, e.target.value as any)}
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                </div>
              </div>
              {/* Color swatches */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'Brown', color: '#8a4a2a' },
                  { label: 'Dark Brown', color: '#5c2e0e' },
                  { label: 'Gold', color: '#f5e0a0' },
                  { label: 'Amber', color: '#d4a73a' },
                  { label: 'Cream', color: '#f0dcc0' },
                  { label: 'Rust', color: '#9b3a1a' },
                ].map(({ label, color }) => (
                  <button
                    key={color}
                    title={label}
                    onClick={() => handleManualInput('iconColor' as any, color as any)}
                    style={{ backgroundColor: color }}
                    className="w-7 h-7 rounded-full border-2 border-slate-600 hover:scale-110 transition-transform"
                  />
                ))}
              </div>
            </div>

            {/* Icon position nudge */}
            <div className="border-t border-slate-700 pt-3 flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-300">Icon Position Offset</label>
              {(['iconOffsetX', 'iconOffsetY'] as const).map(prop => (
                <div key={prop} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{prop === 'iconOffsetX' ? '← X →' : '↑ Y ↓'}</span>
                    <span className="text-xs font-mono text-slate-400">
                      {(config[selectedKey] as any)[prop] ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleManualInput(prop as any, ((config[selectedKey] as any)[prop] ?? 0) - 5 as any)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">−5</button>
                    <button onClick={() => handleManualInput(prop as any, ((config[selectedKey] as any)[prop] ?? 0) - 1 as any)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">−1</button>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={(config[selectedKey] as any)[prop] ?? 0}
                      onChange={e => handleManualInput(prop as any, Number(e.target.value) as any)}
                      className="flex-1 accent-blue-400"
                    />
                    <button onClick={() => handleManualInput(prop as any, ((config[selectedKey] as any)[prop] ?? 0) + 1 as any)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">+1</button>
                    <button onClick={() => handleManualInput(prop as any, ((config[selectedKey] as any)[prop] ?? 0) + 5 as any)} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-xs border border-slate-600">+5</button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  handleManualInput('iconOffsetX' as any, 0 as any)
                  handleManualInput('iconOffsetY' as any, 0 as any)
                }}
                className="text-xs text-slate-500 hover:text-slate-300 underline self-start"
              >
                Reset offset to center
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-slate-800">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow-lg transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save to Project'}
          </button>
          
          <div className="grid grid-cols-2 gap-2">
            <button onClick={exportJSON} className="py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs transition-colors">Copy JSON</button>
            <button onClick={exportCSS} className="py-2 bg-slate-800 hover:bg-slate-700 rounded text-xs transition-colors">Copy CSS</button>
          </div>
          
          <button 
            onClick={() => {
              setConfig(initialConfig as ConfigMap)
              pushHistory(initialConfig as ConfigMap)
            }}
            className="w-full py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded text-xs transition-colors"
          >
            Reset to Original Project State
          </button>
        </div>
      </div>
    </div>
  )
}
