from PIL import Image
import os

img_path = "/home/arco/.gemini/antigravity-ide/brain/b94d1a9f-d252-438a-9d32-011cb4150187/.user_uploaded/media_1790497999738.png"
if not os.path.exists(img_path):
    print("File not found")
    exit(1)

img = Image.open(img_path).convert("RGBA")
width, height = img.size

# We know from CSS:
# --play-x: 23%
# --play-y: 65%
# --play-w: 6%

cx = int(width * 0.23)
cy = int(height * 0.65)
cw = int(width * 0.06)

# The pause button is a cream circle/square in the middle of the red circle.
# Let's crop a box of width cw*2 around cx, cy just to be safe, then make white transparent?
# Actually, the user says "Both symbols must occupy precisely the same location inside the original red circular Play button."
# If I just use CSS object-fit and clip-path in React, I can use the FULL image for the pause symbol and crop it via CSS!
