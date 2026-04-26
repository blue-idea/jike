from PIL import Image
import os

input_path = r"e:\NextCloud\coding\mobile\jike\assets\images\branding\jike_logo_option_5_landscape_v2_1777199172924.png"
output_path = r"e:\NextCloud\coding\mobile\jike\assets\images\branding\logo_landscape_transparent.png"

def make_transparent_and_crop(img_path, out_path):
    img = Image.open(img_path).convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # Make white (and near-white) transparent
    for item in datas:
        # Check if the pixel is close to white (e.g., > 240, 240, 240)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
            
    img.putdata(newData)
    
    # Crop to bounding box
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(out_path, "PNG")
    print(f"Processed image saved to {out_path}")

make_transparent_and_crop(input_path, output_path)
