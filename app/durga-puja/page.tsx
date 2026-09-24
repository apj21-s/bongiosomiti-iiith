'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SiteHeader from '@/components/site-header'
import SiteFooter from '@/components/site-footer'
import './durga-puja.css'

import pujasRawData from '../../public/data/pujas-raw-65.json'

export default function DurgaPujaPage() {
  notFound()
  
  const [activeRegion, setActiveRegion] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPuja, setSelectedPuja] = useState<any>(null)
  
  // Directly use the imported JSON to avoid client-side fetch errors
  const pujas = pujasRawData || []
  
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<any>(null)

  // Load MapLibre JS & CSS dynamically
  useEffect(() => {
    if (document.getElementById('maplibre-script')) {
      if ((window as any).maplibregl) setMapLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'maplibre-script'
    script.src = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js'
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css'
    document.head.appendChild(link)
  }, [])

  // Dynamically assign region if missing based on coordinates (Hussain Sagar center ~17.42, 78.47)
  const processedPujas = pujas.map((p: any) => {
    if (p.region || !p.lat || !p.lng) return p;
    let assigned = 'CENTRAL';
    if (p.lng < 78.43) assigned = 'WEST'; // Gachibowli, Kukatpally, Jubilee Hills
    else if (p.lng > 78.51) assigned = 'EAST'; // Uppal, LB Nagar
    else if (p.lat > 17.45) assigned = 'NORTH'; // Secunderabad, Alwal
    else if (p.lat < 17.38) assigned = 'SOUTH'; // Old City, Falaknuma
    return { ...p, region: assigned };
  });

  // Derived filtered pujas
  const filteredPujas = processedPujas.filter((p: any) => {
    if (!p.lat || !p.lng) return false
    const matchRegion = activeRegion === 'ALL' || (p.region && p.region.toUpperCase() === activeRegion)
    const q = searchQuery.toLowerCase()
    const matchSearch = (p.puja && p.puja.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.venue && p.venue.toLowerCase().includes(q)) ||
      (p.locality && p.locality.toLowerCase().includes(q)) ||
      (p.region && p.region.toLowerCase().includes(q))
    return matchRegion && matchSearch
  })

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current || !pujas.length) return
    const maplibregl = (window as any).maplibregl
    if (mapRef.current) return // already initialized

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'osm': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm',
            paint: {
              'raster-opacity': 1,
              'raster-saturation': 0.2
            }
          }
        ]
      },
      center: [78.4867, 17.3850],
      zoom: 10,
      scrollZoom: false
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map

    map.on('load', () => {
      // Create custom marker image
      const markerSvg = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="#c83b22" stroke="#fdfaf6" stroke-width="2"/>
        <circle cx="12" cy="12" r="3" fill="#fdfaf6"/>
      </svg>`
      const img = new Image(24, 24)
      img.onload = () => map.addImage('custom-marker', img)
      img.src = 'data:image/svg+xml;base64,' + btoa(markerSvg)

      updateMapData(filteredPujas)

      map.on('click', 'clusters', (e: any) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] })
        const clusterId = features[0].properties.cluster_id
        map.getSource('pujas').getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom
          })
        })
      })

      map.on('click', 'unclustered-point', (e: any) => {
        const coords = e.features[0].geometry.coordinates.slice()
        const props = e.features[0].properties

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
        }

        setSelectedPuja(props)
        showPopup(coords, props)

        // Scroll directory to item
        const item = document.getElementById(`puja-item-${props.id}`)
        if (item) item.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })

      map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })
      map.on('mouseenter', 'unclustered-point', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'unclustered-point', () => { map.getCanvas().style.cursor = '' })
    })
  }, [mapLoaded, pujas]) // Init once when data loads

  // Update map when filters change
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateMapData(filteredPujas)
    }
  }, [filteredPujas])

  const updateMapData = (data: any[]) => {
    const map = mapRef.current
    if (!map) return

    const geojson = {
      type: 'FeatureCollection',
      features: data.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: p
      }))
    }

    if (!map.getSource('pujas')) {
      map.addSource('pujas', {
        type: 'geojson',
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50
      })

      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'pujas',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#c83b22',
          'circle-radius': 18,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fdfaf6'
        }
      })

      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'pujas',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12
        },
        paint: {
          'text-color': '#fdfaf6'
        }
      })

      map.addLayer({
        id: 'unclustered-point',
        type: 'symbol',
        source: 'pujas',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': 'custom-marker',
          'icon-size': 1,
          'icon-allow-overlap': true
        }
      })
    } else {
      map.getSource('pujas').setData(geojson)
    }
  }

  const showPopup = (coords: number[], props: any) => {
    const maplibregl = (window as any).maplibregl
    if (!mapRef.current) return

    if (popupRef.current) {
      popupRef.current.remove()
    }

    const approxText = props.coordinate_status === 'approximate'
      ? `<div style="font-size: 0.75rem; color: #8b4513; margin-top: 4px; font-style: italic;">* Approximate Location</div>`
      : ''

    const loc = props.locality ? `${props.locality}${props.region ? `, ${props.region}` : ''}` : (props.region || '')

    const popupHtml = `
      <div class="dp-popup-content">
        <h4 style="margin: 0 0 4px; font-family: var(--font-serif, 'Cinzel', serif); font-size: 1.1rem; color: var(--brand);">${props.puja || props.name}</h4>
        <div style="font-size: 0.85rem; color: #3c2a21; margin-bottom: 2px;"><strong>Venue:</strong> ${props.venue}</div>
        ${loc ? `<div style="font-size: 0.85rem; color: #3c2a21; margin-bottom: 8px;"><strong>Area:</strong> ${loc}</div>` : '<div style="margin-bottom: 8px;"></div>'}
        ${approxText}
        <a href="${props.directions}" target="_blank" rel="noopener noreferrer" 
           style="display: inline-block; margin-top: 10px; background: var(--brand); color: #fff; padding: 6px 12px; text-decoration: none; border-radius: 20px; font-size: 0.8rem; font-weight: bold;">
          GET DIRECTIONS &nearr;
        </a>
      </div>
    `

    popupRef.current = new maplibregl.Popup({ offset: 15, closeButton: false, className: 'dp-custom-popup' })
      .setLngLat(coords as any)
      .setHTML(popupHtml)
      .addTo(mapRef.current)
  }

  const handleDirectoryClick = (puja: any) => {
    setSelectedPuja(puja)
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [puja.lng, puja.lat], zoom: 15 })
      showPopup([puja.lng, puja.lat], puja)
    }
  }

  return (
    <main className="dp-page">
      <SiteHeader />

      {/* 06. HERO SECTION */}
      <section className="dp-cinematic dp-hero-cinematic dp-animate-fade">
        <img src="/assets/dp/01_hero_landscape_2d_21x9.png" alt="Durga Puja Hero Illustration" className="dp-cinematic__img" />
        <div className="dp-cinematic__overlay">
          <div className="dp-eyebrow" style={{ color: 'var(--accent)', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
            HYDERABAD &middot; SHARODOTSAV 2026
          </div>
          <h2>60+ PUJAS.<br />ONE CITY.</h2>
          <p>From Gachibowli to Secunderabad, Sharodotsav comes alive across Hyderabad.</p>
          <div style={{ marginTop: '2rem' }}>
            <a href="#explore-map" className="dp-cta-btn">EXPLORE THE MAP &rarr;</a>
          </div>
        </div>
      </section>

      {/* 09. FROM BENGAL TO HYDERABAD */}
      <section className="dp-section dp-travel-typography scroll-reveal">
        <div className="dp-travel-bg-left"></div>
        <div className="dp-travel-bg-right"></div>
        <svg className="dp-travel-svg" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid meet">
          <path id="flightRoute" d="M 100 150 C 400 -50, 800 450, 1100 250" fill="transparent" stroke="var(--brand)" strokeWidth="2" strokeDasharray="8,8" opacity="0.3" />
        </svg>
        <div className="dp-travel-grid">
          <div className="dp-travel-word dp-travel-word--from scroll-reveal">FROM</div>
          <div className="dp-travel-word dp-travel-word--bengal scroll-reveal">BENGAL</div>
          <div className="dp-travel-word dp-travel-word--to scroll-reveal">TO</div>
          <div className="dp-travel-word dp-travel-word--hyd scroll-reveal">HYDERABAD</div>
          <div className="dp-travel-sub scroll-reveal">A tradition travels, finding new homes across the city.</div>
        </div>
        <svg className="dp-travel-svg dp-travel-plane-container" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid meet">
          <g>
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" transform="translate(-12, -12) scale(1.5)">
              <animate attributeName="fill" values="#1a5b82;#c83b22" dur="4s" repeatCount="indefinite" />
            </path>
            <animateMotion dur="4s" repeatCount="indefinite" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.55 1">
              <mpath href="#flightRoute" />
            </animateMotion>
          </g>
        </svg>
      </section>

      {/* MAP & DIRECTORY */}
      <section id="explore-map" className="dp-map-container scroll-reveal">
        <div className="dp-map-header">
          <div>
            <h3 className="dp-section-title" style={{ fontSize: '2.8rem', marginBottom: '0.8rem' }}>EXPLORE THE PUJAS</h3>
            <p className="dp-body-text" style={{ fontSize: '1.2rem', color: 'rgba(60, 42, 33, 0.8)' }}>65 Durga Puja celebrations across Hyderabad.</p>
          </div>
          <div className="dp-map-filters">
            {['ALL', 'NORTH', 'WEST', 'CENTRAL', 'EAST', 'SOUTH'].map(region => (
              <button
                key={region}
                className={`dp-filter-btn ${activeRegion === region ? 'active' : ''}`}
                onClick={() => setActiveRegion(region)}
              >
                {region}
              </button>
            ))}
          </div>
        </div>

        <div className="dp-map-layout">
          <div className="dp-map-view">
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#e3dfd3' }} className="dp-real-map" />
          </div>
          <div className="dp-map-sidebar">
            <div className="dp-map-search">
              <input
                type="text"
                placeholder="Search puja, locality..."
                className="dp-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <ul className="dp-puja-list">
              <li style={{ padding: '0.75rem 1.5rem', background: 'var(--bg)', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--brand)', borderBottom: '1px solid rgba(139, 69, 19, 0.1)' }}>
                {filteredPujas.length} PUJAS
              </li>
              {filteredPujas.map((puja: any, index: number) => (
                <li
                  key={puja.id}
                  id={`puja-item-${puja.id}`}
                  className="dp-puja-item"
                  onClick={() => handleDirectoryClick(puja)}
                  style={{ background: selectedPuja?.id === puja.id ? 'rgba(212, 136, 6, 0.08)' : '' }}
                >
                  <div className="dp-puja-item-num">{String(index + 1).padStart(2, '0')}</div>
                  <div className="dp-puja-item-content">
                    <h4>{puja.puja || puja.name}</h4>
                    <p style={{ marginBottom: '2px', color: '#3c2a21', fontWeight: 500 }}>{puja.venue}</p>
                    {puja.locality && (
                      <p>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        {puja.locality}{puja.region ? `, ${puja.region}` : ''}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="dp-section dp-final-cta scroll-reveal">
        <h2 className="dp-section-title" style={{ fontSize: '3rem', margin: '0 auto 1rem', textAlign: 'center' }}>FIND YOUR PUJA</h2>
        <p className="dp-body-text" style={{ margin: '0 auto', textAlign: 'center' }}>
          Explore the celebrations happening across Hyderabad.
        </p>
        <div className="dp-final-cta__buttons">
          <a href="#explore-map" className="dp-cta-btn">EXPLORE THE MAP &rarr;</a>
          <a href="https://maps.app.goo.gl/a6x62s2dvXVXKy1Y8" target="_blank" rel="noopener noreferrer" className="dp-cta-btn dp-cta-btn--outline">
            OPEN IN GOOGLE MAPS ↗
          </a>
        </div>
      </section>

      <SiteFooter />
    </main>
  )
}
