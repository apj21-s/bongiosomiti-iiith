import os
from PIL import Image

def generate_favicons():
    src_path = 'assets/logo.png'
    if not os.path.exists(src_path):
        print(f"Source file {src_path} not found.")
        return

    im = Image.open(src_path)
    print("Opened image:", im.size, im.mode)

    # Get bounding box of non-zero alpha channel to crop tightly around artwork
    if im.mode != 'RGBA':
        im = im.convert('RGBA')

    alpha = im.getchannel('A')
    bbox = alpha.getbbox()
    print("Bounding box:", bbox)

    if bbox:
        cropped = im.crop(bbox)
    else:
        cropped = im

    # Square canvas with padding
    w, h = cropped.size
    max_dim = max(w, h)
    # Add small padding around cropped artwork (e.g. 5%)
    pad = int(max_dim * 0.05)
    size = max_dim + 2 * pad

    square = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    paste_x = (size - w) // 2
    paste_y = (size - h) // 2
    square.paste(cropped, (paste_x, paste_y), cropped)

    # Sizes to generate
    sizes = {
        'assets/favicon-16x16.png': (16, 16),
        'assets/favicon-32x32.png': (32, 32),
        'assets/favicon-48x48.png': (48, 48),
        'assets/apple-touch-icon.png': (180, 180),
        'assets/android-chrome-192x192.png': (192, 192),
    }

    for path, sz in sizes.items():
        resized = square.resize(sz, Image.Resampling.LANCZOS)
        resized.save(path)
        print(f"Saved {path} {sz}")

    # Also save favicon.ico
    ico_img = square.resize((32, 32), Image.Resampling.LANCZOS)
    ico_img.save('assets/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print("Saved assets/favicon.ico")

if __name__ == '__main__':
    generate_favicons()
