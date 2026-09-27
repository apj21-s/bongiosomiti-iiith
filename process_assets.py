from PIL import Image
import os

def make_transparent(input_path, output_path):
    if not os.path.exists(input_path):
        print(f"Missing {input_path}")
        return
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    new_data = []
    # Assuming white/light background
    for item in datas:
        # change all white (also shades of whites)
        # to transparent
        if item[0] > 220 and item[1] > 220 and item[2] > 220:
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    img.putdata(new_data)
    img.save(output_path, "PNG")
    print(f"Saved {output_path}")

make_transparent("public/assets/vintage_play_button.jpg", "public/assets/play-symbol.png")
make_transparent("public/assets/vintage_pause_button.jpg", "public/assets/pause-symbol.png")
make_transparent("public/assets/vintage_slider_knob.jpg", "public/assets/progress-knob.png")
make_transparent("public/assets/vintage_slider_knob.jpg", "public/assets/volume-knob.png")
