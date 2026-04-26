from PIL import Image
import argparse

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

def parse_args():
    parser = argparse.ArgumentParser(description="Make white background transparent and crop image.")
    parser.add_argument("-i", "--input", required=True, help="Path to the input image file")
    parser.add_argument("-o", "--output", required=True, help="Path to save the processed image file")
    return parser.parse_args()

if __name__ == "__main__":
    args = parse_args()
    make_transparent_and_crop(args.input, args.output)
