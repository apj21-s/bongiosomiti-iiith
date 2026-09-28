'use client'

import { useEffect, useState, useRef } from 'react'
import pujasData from './data/pujas.json'

// TypeScript declarations for vanilla Leaflet
declare global {
  interface Window {
    L: any;
  }
}

export default function ClientMap() {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markerGroupRef = useRef<any>(null)
  const markersRef = useRef<{ [key: number]: any }>({})
  
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('ALL')
  const [activePuja, setActivePuja] = useState<number | null>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  // Load Leaflet dynamically
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.L) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)

      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.onload = () => setScriptLoaded(true)
      document.head.appendChild(script)
    } else if (window.L) {
      setScriptLoaded(true)
    }
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!scriptLoaded || !mapContainerRef.current) return
    
    // Only init once
    if (mapRef.current) return

    const L = window.L

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
    }).setView([17.4065, 78.4772], 11) // Centered on Hyderabad
    
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    // Base map using Carto Light (clean, muted)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map)

    markerGroupRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    renderMarkers()
  }, [scriptLoaded])

  // Filter Data
  const filteredPujas = pujasData.filter((puja: any) => {
    const matchesSearch = (puja.name + ' ' + puja.locality).toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = activeFilter === 'ALL' || puja.region.toUpperCase() === activeFilter
    return matchesSearch && matchesFilter
  })

  const renderMarkers = () => {
    if (!mapRef.current || !markerGroupRef.current) return
    const L = window.L
    
    // Clear existing
    markerGroupRef.current.clearLayers()
    markersRef.current = {}

    filteredPujas.forEach((puja: any, index) => {
      const icon = L.divIcon({
        className: 'custom-map-icon',
        html: `<div class="custom-map-marker ${activePuja === index ? 'active-marker' : ''}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      })

      const marker = L.marker([puja.lat, puja.lng], { icon })
      
      const popupContent = `
        <div class="dp-popup">
          <span class="dp-popup-eyebrow">DURGA PUJA &middot; 2026</span>
          <h3 class="dp-popup-name">${puja.name}</h3>
          <p class="dp-popup-loc">${puja.locality}</p>
          <a href="${puja.directions}" target="_blank" rel="noopener noreferrer" class="dp-popup-action">GET DIRECTIONS ↗</a>
        </div>
      `
      
      marker.bindPopup(popupContent, {
        offset: [0, -4]
      })
      
      marker.on('click', () => {
        setActivePuja(index)
        // Scroll directory item into view
        const dirEl = document.getElementById(`puja-item-${index}`)
        if (dirEl) dirEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })

      markerGroupRef.current.addLayer(marker)
      markersRef.current[index] = marker
    })
  }

  // Re-render markers on filter/search or active change
  useEffect(() => {
    renderMarkers()
  }, [filteredPujas.length, activePuja, scriptLoaded])

  const handleCardClick = (puja: any, index: number) => {
    setActivePuja(index)
    if (mapRef.current && markersRef.current[index]) {
      const map = mapRef.current
      map.setView([puja.lat, puja.lng], 14, { animate: true, duration: 1 })
      markersRef.current[index].openPopup()
    }
  }

  return (
    <>
      <div className="dp-map-container">
        <div ref={mapContainerRef} className="dp-map-el"></div>
      </div>
      
      <div className="dp-directory">
        <div className="dp-dir-header">
          <p className="dp-dir-eyebrow">PUJA DIRECTORY</p>
          <h2 className="dp-dir-title">{filteredPujas.length} locations</h2>
          
          <input 
            type="text" 
            placeholder="Search a puja or locality..." 
            className="dp-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="dp-filters">
            {['ALL', 'WEST', 'CENTRAL', 'NORTH', 'EAST', 'SOUTH'].map(f => (
              <button 
                key={f}
                className={`dp-filter-btn ${activeFilter === f ? 'active' : ''}`}
                onClick={() => setActiveFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        <ul className="dp-list">
          {filteredPujas.length > 0 ? (
            filteredPujas.map((puja: any, i) => (
              <li 
                key={i} 
                id={`puja-item-${i}`}
                className={`dp-card ${activePuja === i ? 'active' : ''}`}
                onClick={() => handleCardClick(puja, i)}
              >
                <div className="dp-card-num">{String(i + 1).padStart(2, '0')}</div>
                <div className="dp-card-content">
                  <h4 className="dp-card-name">{puja.name}</h4>
                  <p className="dp-card-loc">{puja.locality}</p>
                  <span className="dp-card-action">VIEW ON MAP ↗</span>
                </div>
              </li>
            ))
          ) : (
            <div className="dp-empty-state">
              <div className="dp-empty-icon">✧</div>
              <h3 className="dp-empty-title">
                {searchTerm ? 'No results found' : 'Curating locations'}
              </h3>
              <p className="dp-empty-desc">
                {searchTerm 
                  ? 'Try a different search term or clear the filters.' 
                  : 'We are currently adding verified Puja locations to our 2026 directory. Check back soon.'}
              </p>
            </div>
          )}
        </ul>
      </div>
    </>
  )
}
