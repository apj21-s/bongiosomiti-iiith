// @ts-nocheck
"use client"

import { useEffect } from "react"

export default function HeroBirdsAnimator() {
  useEffect(() => {
    const $ = (selector: string) => document.querySelector(selector) as HTMLElement | null
    const $all = (selector: string) => document.querySelectorAll(selector)

    // Everything started here has to be stoppable.
    //
    // The flight is a chain of about twenty timeouts, and nothing used to
    // cancel them: a remount - a Fast Refresh while editing, a navigation
    // back to the homepage - left the old chain running and started a second
    // one on the same bird. Two schedules writing the same element is why a
    // freshly loaded page and a page that had been sitting there did not fly
    // the same flight. Every timeout now goes through after(), which drops it
    // the moment the effect is torn down.
    let stopped = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let detach = null;

    function after(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!stopped) fn();
      }, ms);
      timers.add(id);
      return id;
    }

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

    // Which way the bird is pointing: 1 heading right, -1 heading left.
    //
    // Birds do not fly backwards and do not roll onto their backs. Every leg
    // either keeps the heading or turns into the new one first, and the sprite
    // is mirrored to match, so the bird is always facing where it is going.
    let facing = 1;
    // The x it is flying to, so a turn can be worked out before the move.
    let currentX = 0;

    // scaleX first, so the bank angle is read in the bird's own frame: the
    // same number means nose-down whichever way it is pointing.
    function pose(bank, size) {
      // Mirrored through a custom property as well, because the thrill
      // keyframes are animations and so outrank this inline transform.
      bird.style.setProperty("--bird-facing", String(facing));
      return "scaleX(" + facing + ") rotate(" + bank + "deg) scale(" + size + ")";
    }

    // Turns to face a target. Returns how long to leave for the turn - zero
    // when it is already heading that way, which on a wide screen is every
    // time, since the whole flight runs left to right.
    function faceTowards(targetX) {
      const dir = targetX >= currentX ? 1 : -1;
      if (dir === facing) return 0;
      facing = dir;
      return 300;
    }

    // Precise calculation of object-fit: cover rendered image box.
    //
    // Measured from the image element itself and returned in the sky box's
    // coordinates. The sky spans the whole hero while the painting occupies
    // only the bottom band, so running this against the sky put the cyclist
    // up in the flat sky; the image's own rect is the painting wherever it
    // sits.
    function getCoverImageRect(img, container) {
      const skyRect = sky.getBoundingClientRect();
      const cRect = (img || container).getBoundingClientRect();
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
        left: (cRect.left - skyRect.left) + leftOffset,
        top: (cRect.top - skyRect.top) + topOffset,
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
    function onResize() {
      if (currentlyRestingTarget && bird.classList.contains("is-resting")) {
        const coords = (currentlyRestingTarget === "shoulder")
          ? getShoulderCoords()
          : getCoords(currentlyRestingTarget);
        bird.style.transition = "none";
        bird.style.left = `${coords.x}px`;
        bird.style.top = `${coords.y}px`;
        currentX = coords.x;
      }
    }
    window.addEventListener("resize", onResize, { passive: true });

    // Puts the hero back the way it was found, so a torn-down flight cannot
    // leave a letter lit up or a flock stuck mid-scatter.
    detach = () => {
      window.removeEventListener("resize", onResize);
      bird.style.display = "none";
      bird.classList.remove("is-flying", "is-resting", "is-thrilled", "is-thrilled-y");
      [charA1, charY, charS, charT].forEach((letter) => letter.classList.remove("is-thrilled"));
      const flock1 = $(".flock-1");
      const flock2 = $(".flock-2");
      if (flock1) flock1.classList.remove("is-scattered");
      if (flock2) flock2.classList.remove("is-scattered");
    };

    function runAnimationCycle() {
      currentlyRestingTarget = null;
      const skyRect = sky.getBoundingClientRect();
      const skyWidth = skyRect.width;
      const skyHeight = skyRect.height;
      const scaleFactor = Math.min(1.2, Math.max(0.4, skyWidth / 1100));
      const distThreshold = Math.max(65, 140 * scaleFactor);

      // Start position: Off-screen left (high up), heading right.
      facing = 1;
      currentX = -50;
      bird.style.transition = "none";
      bird.style.left = "-50px";
      bird.style.top = "30px";
      bird.style.transform = pose(25, 1.15);
      bird.style.display = "block";
      bird.classList.remove("is-resting", "is-thrilled", "is-thrilled-y");
      bird.classList.add("is-flying");

      // Real-time flock proximity checker
      let isChecking = true;
      function checkProximity() {
        if (!isChecking || stopped) return;

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
      after(() => {
        // Step 1: Fly to A (Dramatic swoop down and climb up)
        const coordsA = getCoords(charA1);
        currentX = coordsA.x;
        // The overshoot on top is the flare: it sinks just under the letter
        // and rises onto it, the way a bird arrives on a perch. Kept, but
        // softened - the old curve bounced.
        bird.style.transition = "left 1.8s cubic-bezier(0.25, 1, 0.5, 1), top 1.8s cubic-bezier(0.2, 1.25, 0.3, 0.95), transform 1.8s ease";
        bird.style.transform = pose(25, 1.15);
        bird.style.left = `${coordsA.x}px`;
        bird.style.top = `${coordsA.y}px`;

        // Pitch up halfway through the swoop
        after(() => {
          if (bird.classList.contains("is-flying")) {
            bird.style.transform = pose(-8, 0.95);
          }
        }, 900);

        // Land on A
        after(() => {
          currentlyRestingTarget = charA1;
          bird.classList.remove("is-flying");
          bird.classList.add("is-resting", "is-thrilled");
          bird.style.transform = pose(0, 1);
          charA1.classList.add("is-thrilled");

          // Remove thrill wobble
          after(() => {
            charA1.classList.remove("is-thrilled");
            bird.classList.remove("is-thrilled");
          }, 600);

          // Rest on A for 1.1 seconds, then Hop to Y
          after(() => {
            currentlyRestingTarget = null;
            bird.classList.remove("is-resting", "is-thrilled");
            bird.classList.add("is-flying");

            const coordsY = getCoords(charY);
            // Hop to Y, as an arc: up first, then down onto the letter.
            // The letters share a line, so one tween on a springy curve sagged
            // the bird below the word and pulled it back up - downwards is the
            // one direction a hop does not start in.
            const arcY = Math.round(30 * scaleFactor);
            faceTowards(coordsY.x);
            currentX = coordsY.x;
            bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.35s ease";
            bird.style.transform = pose(-14, 1.05);
            bird.style.left = `${coordsY.x}px`;
            bird.style.top = `${coordsY.y - arcY}px`;

            // Over the top of the arc and down. left is restated unchanged, so
            // the transition already running on it is left alone.
            after(() => {
              if (bird.classList.contains("is-flying")) {
                bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.4, 0, 0.55, 1), transform 0.35s ease";
                bird.style.transform = pose(10, 0.97);
                bird.style.top = `${coordsY.y}px`;
              }
            }, 350);

            // Land on Y
            after(() => {
              currentlyRestingTarget = charY;
              bird.classList.remove("is-flying");
              bird.classList.add("is-resting", "is-thrilled-y");
              bird.style.transform = pose(14, 1);
              charY.classList.add("is-thrilled");

              // Remove thrill
              after(() => {
                charY.classList.remove("is-thrilled");
                bird.classList.remove("is-thrilled-y");
              }, 600);

              // Rest on Y for 1.1 seconds, then Hop to S
              after(() => {
                currentlyRestingTarget = null;
                bird.classList.remove("is-resting", "is-thrilled-y");
                bird.classList.add("is-flying");

                const coordsS = getCoords(charS);
                // Hop to S, as an arc: up first, then down onto the letter.
                // The letters share a line, so one tween on a springy curve sagged
                // the bird below the word and pulled it back up - downwards is the
                // one direction a hop does not start in.
                const arcS = Math.round(30 * scaleFactor);
                faceTowards(coordsS.x);
                currentX = coordsS.x;
                bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.35s ease";
                bird.style.transform = pose(-14, 1.05);
                bird.style.left = `${coordsS.x}px`;
                bird.style.top = `${coordsS.y - arcS}px`;

                // Over the top of the arc and down. left is restated unchanged, so
                // the transition already running on it is left alone.
                after(() => {
                  if (bird.classList.contains("is-flying")) {
                    bird.style.transition = "left 0.7s cubic-bezier(0.25, 1, 0.5, 1), top 0.35s cubic-bezier(0.4, 0, 0.55, 1), transform 0.35s ease";
                    bird.style.transform = pose(10, 0.97);
                    bird.style.top = `${coordsS.y}px`;
                  }
                }, 350);

                // Land on S
                after(() => {
                  currentlyRestingTarget = charS;
                  bird.classList.remove("is-flying");
                  bird.classList.add("is-resting", "is-thrilled");
                  bird.style.transform = pose(0, 1);
                  charS.classList.add("is-thrilled");

                  // Remove thrill
                  after(() => {
                    charS.classList.remove("is-thrilled");
                    bird.classList.remove("is-thrilled");
                  }, 600);

                  // Rest on S for 1.1 seconds, then Hop to T
                  after(() => {
                    currentlyRestingTarget = null;
                    bird.classList.remove("is-resting", "is-thrilled");
                    bird.classList.add("is-flying");

                    const coordsT = getCoords(charT);
                    // Hop to T, as an arc: up first, then down onto the letter.
                    // The letters share a line, so one tween on a springy curve sagged
                    // the bird below the word and pulled it back up - downwards is the
                    // one direction a hop does not start in.
                    const arcT = Math.round(30 * scaleFactor);
                    faceTowards(coordsT.x);
                    currentX = coordsT.x;
                    bird.style.transition = "left 0.65s cubic-bezier(0.25, 1, 0.5, 1), top 0.325s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.325s ease";
                    bird.style.transform = pose(-14, 1.05);
                    bird.style.left = `${coordsT.x}px`;
                    bird.style.top = `${coordsT.y - arcT}px`;

                    // Over the top of the arc and down. left is restated unchanged, so
                    // the transition already running on it is left alone.
                    after(() => {
                      if (bird.classList.contains("is-flying")) {
                        bird.style.transition = "left 0.65s cubic-bezier(0.25, 1, 0.5, 1), top 0.325s cubic-bezier(0.4, 0, 0.55, 1), transform 0.325s ease";
                        bird.style.transform = pose(10, 0.97);
                        bird.style.top = `${coordsT.y}px`;
                      }
                    }, 320);

                    // Land on T
                    after(() => {
                      currentlyRestingTarget = charT;
                      bird.classList.remove("is-flying");
                      bird.classList.add("is-resting", "is-thrilled");
                      bird.style.transform = pose(0, 1);
                      charT.classList.add("is-thrilled");

                      // Remove thrill
                      after(() => {
                        charT.classList.remove("is-thrilled");
                        bird.classList.remove("is-thrilled");
                      }, 600);

                      // ---- DRAMATIC OUTRO SEQUENCE ----
                      // Rests on T briefly...
                      after(() => {
                        currentlyRestingTarget = null;
                        bird.classList.remove("is-resting", "is-thrilled");
                        bird.classList.add("is-flying");

                        // STEP A: climb away from the title, still heading the way it
                        // was already going.
                        const coordsTCurrent = getCoords(charT);
                        const climbX = coordsTCurrent.x + Math.round(120 * scaleFactor);
                        currentX = climbX;
                        bird.style.transition = "left 1.0s cubic-bezier(0.4, 0, 0.2, 1), top 1.0s cubic-bezier(0.4, 0, 0.2, 1), transform 1.0s ease";
                        bird.style.transform = pose(-26, 1.18);
                        bird.style.left = `${climbX}px`;
                        bird.style.top = `${coordsTCurrent.y - Math.round(80 * scaleFactor)}px`;

                        // STEP B: bank round at the top of the climb.
                        //
                        // This used to roll the bird through rotate(180deg) and slide it
                        // back the way it came, upside down and tail first. Now it turns
                        // on the wing towards wherever the cyclist is, and the sprite is
                        // mirrored if that reverses the heading. On a wide screen the
                        // cyclist is right of the T and there is no turn to make at all.
                        after(() => {
                          faceTowards(getShoulderCoords().x);
                          const turnX = climbX + facing * Math.round(34 * scaleFactor);
                          currentX = turnX;
                          // The bank itself is quick; the glide out of it is not.
                          bird.style.transition = "left 1.1s cubic-bezier(0.4, 0, 0.6, 1), top 1.1s cubic-bezier(0.4, 0, 0.6, 1), transform 0.45s ease";
                          bird.style.transform = pose(-6, 1.08);
                          bird.style.left = `${turnX}px`;
                          bird.style.top = `${coordsTCurrent.y - Math.round(40 * scaleFactor)}px`;
                        }, 950);

                        // STEP C: Swoop down toward the shoulder
                        after(() => {
                          const shoulderCoords = getShoulderCoords();
                          currentX = shoulderCoords.x;

                          // One descending glide, in the heading the turn set. The old curve
                          // overshot the shoulder and pulled back up to it, which put the
                          // bird briefly below the man it was landing on.
                          bird.style.transition = "left 1.4s cubic-bezier(0.25, 1, 0.5, 1), top 1.4s cubic-bezier(0.3, 0.7, 0.4, 1), transform 1.4s ease";
                          bird.style.transform = pose(14, 0.95);
                          bird.style.left = `${shoulderCoords.x}px`;
                          bird.style.top = `${shoulderCoords.y}px`;

                          // Settle on shoulder
                          after(() => {
                            currentlyRestingTarget = "shoulder";
                            bird.classList.remove("is-flying");
                            bird.classList.add("is-resting");
                            bird.style.transform = pose(0, 1);

                            // Rest a moment on the shoulder...
                            after(() => {
                              currentlyRestingTarget = null;
                              bird.classList.remove("is-resting");
                              bird.classList.add("is-flying");

                              // STEP D: Final soar. It leaves to the right, so if it landed
                              // facing left it turns on the perch first - a bird takes off the
                              // way it is pointing rather than reversing off a shoulder.
                              const exitX = skyWidth + 80;
                              const turnPause = faceTowards(exitX);
                              bird.style.transition = "transform 0.3s ease";
                              bird.style.transform = pose(-4, 1.02);

                              after(() => {
                                currentX = exitX;
                                // The dip before the climb is deliberate: the negative control
                                // point drops it off the shoulder before the wings take hold.
                                bird.style.transition = "left 2.4s cubic-bezier(0.25, 1, 0.5, 1), top 2.4s cubic-bezier(0.3, -0.5, 0.2, 1.1), transform 2.4s ease";
                                bird.style.transform = pose(18, 0.9);
                                bird.style.left = `${exitX}px`;
                                bird.style.top = `${skyHeight * 0.15}px`;

                                // Pitch up to climbing glory halfway
                                after(() => {
                                  if (bird.classList.contains("is-flying")) {
                                    bird.style.transform = pose(-30, 1.25);
                                  }
                                }, 800);
                              }, turnPause);

                              // Hide after exiting screen
                              after(() => {
                                bird.style.display = "none";
                                isChecking = false;
                                const flock1 = $(".flock-1");
                                const flock2 = $(".flock-2");
                                if (flock1) flock1.classList.remove("is-scattered");
                                if (flock2) flock2.classList.remove("is-scattered");
                                timeoutId = after(runAnimationCycle, 4000);
                              }, 2400 + turnPause);
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
    timeoutId = after(runAnimationCycle, 3000);
  }


    
    // Slight delay to ensure layout is ready
    const timer = setTimeout(() => initHeroLandingBird(), 500)

    return () => {
      stopped = true
      clearTimeout(timer)
      timers.forEach((id) => clearTimeout(id))
      timers.clear()
      if (detach) detach()
    }
  }, [])

  return null
}
