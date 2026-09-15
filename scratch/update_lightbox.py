import re

css_file = "app/globals.css"

with open(css_file, "r") as f:
    content = f.read()

start_marker = "/* =========================================================================\n   GOOGLE PHOTOS SMART LIGHTBOX VIEWER\n   ========================================================================= */"
end_marker = "/* Developer / Admin Mode Toast Notification */"

new_css = """/* =========================================================================
   GOOGLE PHOTOS SMART LIGHTBOX VIEWER
   ========================================================================= */

.story-lightbox {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(15, 10, 7, 0.82);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  opacity: 0;
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  overflow: hidden;
}

.story-lightbox.is-open {
  opacity: 1;
}

.story-lightbox[hidden] {
  display: none !important;
}

.story-lightbox__container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

/* Topbar */
.story-lightbox__topbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px 20px 8px;
  background: transparent;
  z-index: 10;
}

.story-lightbox__info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.story-lightbox__album-name {
  font-family: "Noto Serif Bengali", Georgia, serif;
  font-size: 0.72rem;
  color: #d69a3a;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  letter-spacing: 0.02em;
}

.story-lightbox__title {
  margin: 4px 0 0;
  font-family: "Noto Serif Bengali", Georgia, serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #fff9ee;
  letter-spacing: 0.01em;
}

.story-lightbox__date {
  font-size: 0.75rem;
  color: rgba(255, 235, 195, 0.7);
  font-weight: 500;
  margin-top: 2px;
}

.story-lightbox__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.story-lightbox__counter {
  font-size: 0.75rem;
  font-weight: 700;
  color: #ffd89a;
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
}

.story-lightbox__action-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: rgba(255, 235, 195, 0.8);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
}

.story-lightbox__action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: scale(1.08);
}

.story-lightbox__action-btn:active {
  transform: scale(0.95);
}

/* Viewport Area */
.story-lightbox__viewport {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0 16px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
}

.story-lightbox__media {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.story-lightbox__image {
  width: min(88vw, 420px);
  max-height: 58vh;
  object-fit: contain !important;
  display: block;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
  transition: opacity 0.18s ease, transform 0.18s ease;
}
@media (min-width: 768px) {
  .story-lightbox__image {
    width: auto;
    max-width: 80vw;
    max-height: 75vh;
  }
}

.story-lightbox__image.is-changing {
  opacity: 0;
  transform: scale(0.98);
}

/* Nav Chevron Buttons */
.story-lightbox__nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(45, 25, 15, 0.65);
  border: 1px solid rgba(255, 230, 190, 0.3);
  color: #fff9ee;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  flex-shrink: 0;
  padding: 0;
}

.story-lightbox__prev {
  left: -20px;
}
.story-lightbox__next {
  right: -20px;
}
@media (min-width: 768px) {
  .story-lightbox__prev { left: -60px; }
  .story-lightbox__next { right: -60px; }
}

.story-lightbox__nav:hover {
  background: rgba(184, 92, 38, 0.8);
  border-color: rgba(255, 235, 195, 0.6);
  transform: translateY(-50%) scale(1.1);
}

.story-lightbox__nav:disabled {
  opacity: 0.2;
  cursor: not-allowed;
  pointer-events: none;
}

/* Google Photos Filmstrip Preview Bar */
.story-lightbox__filmstrip-bar {
  padding: 8px 12px 16px;
  display: flex;
  justify-content: center;
  z-index: 10;
}

.story-lightbox__filmstrip {
  display: flex;
  gap: 8px;
  max-width: 100vw;
  overflow-x: auto;
  padding: 8px 4px;
  justify-content: flex-start;
  scrollbar-width: none;
}

.story-lightbox__filmstrip::-webkit-scrollbar {
  display: none;
}

.story-lightbox__thumb {
  width: 72px;
  height: 52px;
  flex: 0 0 72px;
  border-radius: 7px;
  overflow: hidden;
  border: none;
  background: #140d07;
  padding: 0;
  margin: 0;
  cursor: pointer;
  opacity: 0.5;
  transition: all 0.22s ease;
}

.story-lightbox__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.story-lightbox__thumb:hover {
  opacity: 0.92;
  transform: translateY(-2px);
}

.story-lightbox__thumb.is-active {
  opacity: 1;
  outline: 2px solid #d69a3a;
  outline-offset: 2px;
}

"""

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_css + content[end_idx:]
    with open(css_file, "w") as f:
        f.write(new_content)
    print("CSS replaced successfully!")
else:
    print(f"Error: start={start_idx}, end={end_idx}")
