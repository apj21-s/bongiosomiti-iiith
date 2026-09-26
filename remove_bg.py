import sys
from PIL import Image

def remove_background(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()

    # The background is a checkerboard of grey and white. 
    # To remove it properly, we can do a flood fill from the corners.
    # We will treat any pixel that is "grey-ish" and "light" as background if it's connected to the edges.
    
    def is_bg(r, g, b, a):
        if a < 255:
            return True
        # Check if it's greyscale (r, g, b are close to each other) and light
        if abs(r - g) < 15 and abs(g - b) < 15 and abs(r - b) < 15 and r > 160:
            return True
        return False

    visited = set()
    queue = []
    
    # Add borders to queue
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
        
    for start_node in queue:
        if start_node not in visited:
            r, g, b, a = pixels[start_node[0], start_node[1]]
            if is_bg(r, g, b, a):
                q = [start_node]
                visited.add(start_node)
                while q:
                    cx, cy = q.pop()
                    pixels[cx, cy] = (0, 0, 0, 0)
                    
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                            nr, ng, nb, na = pixels[nx, ny]
                            if is_bg(nr, ng, nb, na):
                                visited.add((nx, ny))
                                q.append((nx, ny))

    img.save(out_path)
    print("Done")

if __name__ == "__main__":
    remove_background("public/assets/mic.png", "public/assets/mic-nobg.png")
