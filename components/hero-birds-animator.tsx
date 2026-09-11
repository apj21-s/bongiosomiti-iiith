// @ts-nocheck
"use client"

import { useEffect } from "react"

export default function HeroBirdsAnimator() {
  useEffect(() => {
    const $ = (selector: string) => document.querySelector(selector) as HTMLElement | null
    const $all = (selector: string) => document.querySelectorAll(selector)

    function initHeroLandingBird() {
    const bird = $(".hero-landing-bird");
    const charA1 = $(".hero-char-a1");
    const charY = $(".hero-char-y");
    const charS = $(".hero-char-s");
    const charT = $(".hero-char-t");
    const sky = $(".home-hero__birds-sky");

    if (!bird || !charA1 || !charY || !charS || !charT || !sky) return;

    let timeoutId = null;
    let currentlyRestingTarget = null; // charA1 | charY | charS | charT | "shoulder" | null

    // Precise calculation of object-fit: cover rendered image box
    function getCoverImageRect(img, container) {
      const cRect = container.getBoundingClientRect();
      const cW = cRect.width;
      const cH = cRect.height || 1;
      const imgW = (img && img.naturalWidth) ? img.naturalWidth : 1792;
      const imgH = (img && img.naturalHeight) ? img.naturalHeight : 592;
      const imgRatio = imgW / imgH;
      const cRatio = cW / cH;

      let renderedW, renderedH, leftOffset, topOffset;

      if (cRatio >= imgRatio) {
        renderedW = cW;
        renderedH = cW / imgRatio;
        leftOffset = 0;
        topOffset = (cH - renderedH) * 0.45; // object-position: right 45%
      } else {
        renderedH = cH;
        renderedW = cH * imgRatio;
        leftOffset = cW - renderedW; // object-position: right
        topOffset = 0;
      }

      return {
        left: leftOffset,
        top: topOffset,
        width: renderedW,
        height: renderedH
      };
    }

    // Real-time dynamic target coordinate getter
    function getCoords(element) {
      const skyRect = sky.getBoundingClientRect();
      const elemRect = element.getBoundingClientRect();
      const birdW = parseFloat(getComputedStyle(bird).width) || 22;
      const birdH = parseFloat(getComputedStyle(bird).height) || 13;

      // If it's the Y character, sit on the left arm of Y (approx 18% width mark)
      const horizontalOffset = (element === charY) ? (elemRect.width * 0.18) : (elemRect.width / 2);
      return {
        x: elemRect.left - skyRect.left + horizontalOffset - (birdW / 2),
        y: elemRect.top - skyRect.top - birdH + 1
      };
    }

    // Dynamic shoulder perch mapping based on image cover geometry
    function getShoulderCoords() {
      const skyRect = sky.getBoundingClientRect();
      const img = $(".home-hero__image--landscape");
      const imgRect = getCoverImageRect(img, sky);

      // Normalized relative shoulder coordinates in raw autumn-landscape.webp (1792 x 592)
      const X_norm = 1508 / 1792; // ~0.8415
      const Y_norm = 237 / 592;   // ~0.4003

      const shoulderX = imgRect.left + (imgRect.width * X_norm);
      const shoulderY = imgRect.top + (imgRect.height * Y_norm);

      const birdW = parseFloat(getComputedStyle(bird).width) || 22;
      const birdH = parseFloat(getComputedStyle(bird).height) || 13;

      const perch = $(".hero-shoulder-perch");
      if (perch && skyRect.width > 0 && skyRect.height > 0) {
        perch.style.left = `${(shoulderX / skyRect.width) * 100}%`;
        perch.style.top = `${(shoulderY / skyRect.height) * 100}%`;
      }

      return {
        x: shoulderX - (birdW / 2),
        y: shoulderY - birdH + 1
      };
    }

    // Lock position to target if window is resized mid-resting
    window.addEventListener("resize", () => {
      if (currentlyRestingTarget && bird.classList.contains("is-resting")) {
        const coords = (currentlyRestingTarget === "shoulder")
          ? getShoulderCoords()
          : getCoords(currentlyRestingTarget);
        bird.style.transition = "none";
        bird.style.left = `${coords.x}px`;
        bird.style.top = `${coords.y}px`;
      }
    }, { passive: true });

    function runAnimationCycle() {
      currentlyRestingTarget = null;
      const skyRect = sky.getBoundingClientRect();
      const skyWidth = skyRect.width;
      const skyHeight = skyRect.height;
      const scaleFactor = Math.min(1.2, Math.max(0.4, skyWidth / 1100));
      const distThreshold = Math.max(65, 140 * scaleFactor);

      // Start position: Off-screen left (high up)
      bird.style.transition = "none";
      bird.style.left = "-50px";
      bird.style.top = "30px";
      bird.style.transform = "rotate(25deg) scale(1.15)";
      bird.style.display = "block";
      bird.classList.remove("is-resting", "is-thrilled", "is-thrilled-y");
      bird.classList.add("is-flying");

      // Real-time flock proximity checker
      let isChecking = true;
      function checkProximity() {
        if (!isChecking) return;

        const landingRect = bird.getBoundingClientRect();

        // Flock 1
        const f1Lead = $(".flock-1 .bird-lead");
        const flock1 = $(".flock-1");
        if (f1Lead && flock1) {
          const leadRect = f1Lead.getBoundingClientRect();
          const dx = (landingRect.left + landingRect.width / 2) - (leadRect.left + leadRect.width / 2);
          const dy = (landingRect.top + landingRect.height / 2) - (leadRect.top + leadRect.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < distThreshold) {
            flock1.classList.add("is-scattered");
          } else {
            flock1.classList.remove("is-scattered");
          }
        }

        // Flock 2
        const f2Lead = $(".flock-2 .bird-lead");
        const flock2 = $(".flock-2");
        if (f2Lead && flock2) {
          const leadRect = f2Lead.getBoundingClientRect();
          const dx = (landingRect.left + landingRect.width / 2) - (leadRect.left + leadRect.width / 2);
          const dy = (landingRect.top + landingRect.height / 2) - (leadRect.top + leadRect.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < distThreshold) {
            flock2.classList.add("is-scattered");
          } else {
            flock2.classList.remove("is-scattered");
          }
        }

        requestAnimationFrame(checkProximity);
      }
      requestAnimationFrame(checkProximity);

      // Small delay before first flight starts
      setTimeout(() => {
        // Step 1: Fly to A (Dramatic swoop down and climb up)
        const coordsA = getCoords(charA1);
        bird.style.transition = "left 1.8s cubic-bezier(0.25, 1, 0.5, 1), top 1.8s cubic-bezier(0.2, 1.8, 0.3, 0.9), transform 1.8s ease";
        bird.style.transform = "rotate(25deg) scale(1.15)";
        bird.style.left = `${coordsA.x}px`;
        bird.style.top = `${coordsA.y}px`;

        // Pitch up halfway through the swoop
        setTimeout(() => {
          if (bird.classList.contains("is-flying")) {
            bird.style.transform = "rotate(-8deg) scale(0.95)";
          }
        }, 900);

        // Land on A
        setTimeout(() => {
          currentlyRestingTarget = charA1;
          bird.classList.remove("is-flying");
          bird.classList.add("is-resting", "is-thrilled");
          bird.style.transform = "rotate(0deg) scale(1)";
          charA1.classList.add("is-thrilled");

          // Remove thrill wobble
          setTimeout(() => {
            charA1.classList.remove("is-thrilled");
            bird.classList.remove("is-thrilled");
          }, 600);

          // Rest on A for 1.1 seconds, then Hop to Y
          setTimeout(() => {
            currentlyRestingTarget = null;
            bird.classList.remove("is-resting", "is-thrilled");
            bird.classList.add("is-flying");

            const coordsY = getCoords(charY);
            // Hop to Y
            bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.7s cubic-bezier(0.1, 1.8, 0.3, 1), transform 0.7s ease";
            bird.style.transform = "rotate(-12deg) scale(1.05)";
            bird.style.left = `${coordsY.x}px`;
            bird.style.top = `${coordsY.y}px`;

            // Settle transformation halfway through the hop
            setTimeout(() => {
              if (bird.classList.contains("is-flying")) {
                bird.style.transform = "rotate(8deg) scale(0.95)";
              }
            }, 350);

            // Land on Y
            setTimeout(() => {
              currentlyRestingTarget = charY;
              bird.classList.remove("is-flying");
              bird.classList.add("is-resting", "is-thrilled-y");
              bird.style.transform = "rotate(14deg) scale(1)";
              charY.classList.add("is-thrilled");

              // Remove thrill
              setTimeout(() => {
                charY.classList.remove("is-thrilled");
                bird.classList.remove("is-thrilled-y");
              }, 600);

              // Rest on Y for 1.1 seconds, then Hop to S
              setTimeout(() => {
                currentlyRestingTarget = null;
                bird.classList.remove("is-resting", "is-thrilled-y");
                bird.classList.add("is-flying");

                const coordsS = getCoords(charS);
                // Hop to S
                bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.7s cubic-bezier(0.1, 1.8, 0.3, 1), transform 0.7s ease";
                bird.style.transform = "rotate(-12deg) scale(1.05)";
                bird.style.left = `${coordsS.x}px`;
                bird.style.top = `${coordsS.y}px`;

                // Settle transformation halfway
                setTimeout(() => {
                  if (bird.classList.contains("is-flying")) {
                    bird.style.transform = "rotate(8deg) scale(0.95)";
                  }
                }, 350);

                // Land on S
                setTimeout(() => {
                  currentlyRestingTarget = charS;
                  bird.classList.remove("is-flying");
                  bird.classList.add("is-resting", "is-thrilled");
                  bird.style.transform = "rotate(0deg) scale(1)";
                  charS.classList.add("is-thrilled");

                  // Remove thrill
                  setTimeout(() => {
                    charS.classList.remove("is-thrilled");
                    bird.classList.remove("is-thrilled");
                  }, 600);

                  // Rest on S for 1.1 seconds, then Hop to T
                  setTimeout(() => {
                    currentlyRestingTarget = null;
                    bird.classList.remove("is-resting", "is-thrilled");
                    bird.classList.add("is-flying");

                    const coordsT = getCoords(charT);
                    // Hop to T
                    bird.style.transition = "left 0.65s cubic-bezier(0.25, 1, 0.5, 1), top 0.65s cubic-bezier(0.1, 1.8, 0.3, 1), transform 0.65s ease";
                    bird.style.transform = "rotate(-12deg) scale(1.05)";
                    bird.style.left = `${coordsT.x}px`;
                    bird.style.top = `${coordsT.y}px`;

                    // Settle transformation halfway
                    setTimeout(() => {
                      if (bird.classList.contains("is-flying")) {
                        bird.style.transform = "rotate(8deg) scale(0.95)";
                      }
                    }, 320);

                    // Land on T
                    setTimeout(() => {
                      currentlyRestingTarget = charT;
                      bird.classList.remove("is-flying");
                      bird.classList.add("is-resting", "is-thrilled");
                      bird.style.transform = "rotate(0deg) scale(1)";
                      charT.classList.add("is-thrilled");

                      // Remove thrill
                      setTimeout(() => {
                        charT.classList.remove("is-thrilled");
                        bird.classList.remove("is-thrilled");
                      }, 600);

                      // ---- DRAMATIC OUTRO SEQUENCE ----
                      // Rests on T briefly...
                      setTimeout(() => {
                        currentlyRestingTarget = null;
                        bird.classList.remove("is-resting", "is-thrilled");
                        bird.classList.add("is-flying");

                        // STEP A: Shoot up & right — as if leaving boldly (scaled proportionally)
                        bird.style.transition = "left 1.0s cubic-bezier(0.4, 0, 0.2, 1), top 1.0s cubic-bezier(0.4, 0, 0.2, 1), transform 1.0s ease";
                        bird.style.transform = "rotate(-30deg) scale(1.2)";
                        const coordsTCurrent = getCoords(charT);
                        bird.style.left = `${coordsTCurrent.x + Math.round(120 * scaleFactor)}px`;
                        bird.style.top = `${coordsTCurrent.y - Math.round(80 * scaleFactor)}px`;

                        // STEP B: Arc back left — like it forgot something (scaled proportionally)
                        setTimeout(() => {
                          bird.style.transition = "left 1.1s cubic-bezier(0.4, 0, 0.6, 1), top 1.1s cubic-bezier(0.4, 0, 0.6, 1), transform 1.1s ease";
                          bird.style.transform = "rotate(180deg) scale(1.05)";
                          bird.style.left = `${coordsTCurrent.x - Math.round(40 * scaleFactor)}px`;
                          bird.style.top = `${coordsTCurrent.y - Math.round(30 * scaleFactor)}px`;
                        }, 950);

                        // STEP C: Swoop down toward the shoulder
                        setTimeout(() => {
                          const shoulderCoords = getShoulderCoords();

                          bird.style.transition = "left 1.4s cubic-bezier(0.25, 1, 0.5, 1), top 1.4s cubic-bezier(0.2, 1.6, 0.3, 0.9), transform 1.4s ease";
                          bird.style.transform = "rotate(15deg) scale(0.95)";
                          bird.style.left = `${shoulderCoords.x}px`;
                          bird.style.top = `${shoulderCoords.y}px`;

                          // Settle on shoulder
                          setTimeout(() => {
                            currentlyRestingTarget = "shoulder";
                            bird.classList.remove("is-flying");
                            bird.classList.add("is-resting");
                            bird.style.transform = "rotate(0deg) scale(1)";

                            // Rest a moment on the shoulder...
                            setTimeout(() => {
                              currentlyRestingTarget = null;
                              bird.classList.remove("is-resting");
                              bird.classList.add("is-flying");

                              // STEP D: Final soar — dramatic swoop-down then climb off-screen
                              bird.style.transition = "left 2.4s cubic-bezier(0.25, 1, 0.5, 1), top 2.4s cubic-bezier(0.3, -0.5, 0.2, 1.1), transform 2.4s ease";
                              bird.style.transform = "rotate(20deg) scale(0.9)";
                              bird.style.left = `${skyWidth + 80}px`;
                              bird.style.top = `${skyHeight * 0.15}px`;

                              // Pitch up to climbing glory halfway
                              setTimeout(() => {
                                if (bird.classList.contains("is-flying")) {
                                  bird.style.transform = "rotate(-32deg) scale(1.25)";
                                }
                              }, 800);

                              // Hide after exiting screen
                              setTimeout(() => {
                                bird.style.display = "none";
                                isChecking = false;
                                const flock1 = $(".flock-1");
                                const flock2 = $(".flock-2");
                                if (flock1) flock1.classList.remove("is-scattered");
                                if (flock2) flock2.classList.remove("is-scattered");
                                timeoutId = setTimeout(runAnimationCycle, 4000);
                              }, 2400);
                            }, 1600);
                          }, 1350);
                        }, 1900);
                      }, 900);
                    }, 650);
                  }, 1750);
                }, 700);
              }, 1750);
            }, 700);
          }, 1750);
        }, 1800);
      }, 100);
    }

    // Initial delay before first animation starts (3 seconds)
    timeoutId = setTimeout(runAnimationCycle, 3000);
  }


    
    // Slight delay to ensure layout is ready
    const timer = setTimeout(() => initHeroLandingBird(), 500)
    return () => clearTimeout(timer)
  }, [])

  return null
}
